import { Service } from 'typedi';
import { randomUUID } from 'node:crypto';
import Stripe from 'stripe';
import { Op } from 'sequelize';
import { env } from '../config/env.config';
import { atomic } from '../database/connection';
import { Batch, Ledger, Order, Pack, PaymentEvent, Refund, ReviewCase } from '../models';
import { requireThat } from '../exceptions/http.exception';
import { lockUser } from './course.service';
import { audit, enqueue } from './job.service';
export const stripeClient = () => {
  requireThat(env.STRIPE_SECRET_KEY, 503, 'PAYMENTS_UNAVAILABLE', '付款服務尚未啟用');
  return new Stripe(env.STRIPE_SECRET_KEY);
};
@Service()
export class PaymentService {
  async wallet(userId: string, pagination: { limit: number; offset: number }) {
    const batches = await Batch.findAll({ where: { user_id: userId, remaining: { [Op.gt]: 0 } } });
    const ledger = await Ledger.findAndCountAll({
      where: { user_id: userId },
      ...pagination,
      order: [['created_at', 'DESC']],
    });
    return {
      balance: batches.filter((b) => !b.get('frozen')).reduce((n, b) => n + b.get('remaining'), 0),
      frozen: batches.filter((b) => b.get('frozen')).reduce((n, b) => n + b.get('remaining'), 0),
      items: ledger.rows,
      total: ledger.count,
    };
  }
  async checkout(userId: string, packId: string) {
    const stripe = stripeClient();
    requireThat(
      !env.STRIPE_SECRET_KEY.startsWith('sk_live_') || env.LIVE_PAYMENTS_ENABLED,
      503,
      'LIVE_PAYMENTS_DISABLED',
      '正式收費尚未啟用',
    );
    const pack = await Pack.findOne({ where: { id: packId, active: true } });
    requireThat(pack, 404, 'NOT_FOUND', '找不到點數套裝');
    const id = randomUUID();
    await Order.create({
      id,
      user_id: userId,
      pack_id: packId,
      credits: pack.get('credits'),
      amount: pack.get('amount'),
      status: 'pending',
    });
    const session = await stripe.checkout.sessions.create(
      {
        mode: 'payment',
        payment_method_types: ['card'],
        client_reference_id: id,
        metadata: { order_id: id },
        line_items: [
          {
            price_data: { currency: 'hkd', unit_amount: pack.get('amount'), product_data: { name: pack.get('name') } },
            quantity: 1,
          },
        ],
        success_url: `${env.APP_URL}/?page=wallet&payment=return`,
        cancel_url: `${env.APP_URL}/?page=wallet&payment=cancelled`,
      },
      { idempotencyKey: `checkout:${id}` },
    );
    await Order.update({ stripe_session_id: session.id }, { where: { id } });
    return { url: session.url, order_id: id };
  }
  async fulfill(session: Stripe.Checkout.Session, eventId: string) {
    const orderId = session.client_reference_id;
    requireThat(orderId, 400, 'INVALID_PAYMENT', '付款缺少訂單編號');
    const found = await Order.findByPk(orderId);
    requireThat(found, 404, 'NOT_FOUND', '找不到訂單');
    return atomic(async (tx) => {
      await lockUser(found.get('user_id'), tx);
      const order = (await Order.findByPk(orderId, { transaction: tx, lock: tx.LOCK.UPDATE }))!;
      if (await PaymentEvent.findByPk(eventId, { transaction: tx })) return { received: true };
      requireThat(
        session.payment_status === 'paid' &&
          session.currency === 'hkd' &&
          session.amount_total === order.get('amount') &&
          session.metadata?.order_id === orderId &&
          (!order.get('stripe_session_id') || session.id === order.get('stripe_session_id')),
        400,
        'PAYMENT_MISMATCH',
        '付款資料與訂單不符',
      );
      if (order.get('status') === 'pending' || order.get('status') === 'expired') {
        const batchId = randomUUID();
        await Batch.create(
          {
            id: batchId,
            user_id: order.get('user_id'),
            order_id: orderId,
            original: order.get('credits'),
            remaining: order.get('credits'),
            frozen: false,
          },
          { transaction: tx },
        );
        await Ledger.create(
          {
            id: randomUUID(),
            user_id: order.get('user_id'),
            batch_id: batchId,
            delta: order.get('credits'),
            kind: 'purchase',
            reference_id: orderId,
          },
          { transaction: tx },
        );
        await order.update(
          {
            status: 'paid',
            stripe_session_id: session.id,
            payment_intent:
              typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id,
          },
          { transaction: tx },
        );
      }
      await PaymentEvent.create(
        { id: eventId, type: 'checkout.paid', object_id: session.id, status: 'processed' },
        { transaction: tx },
      );
      return { received: true };
    });
  }
  async webhook(event: Stripe.Event) {
    if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.payment_status === 'paid') return this.fulfill(session, event.id);
    }
    if (event.type === 'checkout.session.expired') {
      const s = event.data.object as Stripe.Checkout.Session;
      await Order.update({ status: 'expired' }, { where: { stripe_session_id: s.id, status: 'pending' } });
    }
    if (event.type === 'refund.updated' || event.type === 'refund.created' || event.type === 'refund.failed') {
      const refund = event.data.object as Stripe.Refund;
      await this.settleRefund(refund);
    }
    if (event.type === 'charge.dispute.created' || event.type === 'charge.refunded') {
      const object = event.data.object as unknown as { id: string; payment_intent: string };
      await atomic(async (tx) => {
        if (await PaymentEvent.findByPk(event.id, { transaction: tx })) return;
        const order = object.payment_intent
          ? await Order.findOne({ where: { payment_intent: object.payment_intent }, transaction: tx })
          : null;
        const internal = order && (await Refund.findOne({ where: { order_id: order.get('id') }, transaction: tx }));
        if (!internal || event.type === 'charge.dispute.created')
          await ReviewCase.create(
            {
              id: randomUUID(),
              order_id: order?.get('id'),
              kind: event.type,
              status: 'open',
              detail: `Stripe 事件 ${event.id}；請人工核對並處理權益。`,
            },
            { transaction: tx },
          );
        await PaymentEvent.create(
          { id: event.id, type: event.type, object_id: object.id, status: 'processed' },
          { transaction: tx },
        );
      });
    }
    return { received: true };
  }
  async refund(actorId: string, orderId: string, reason: string) {
    const found = await Order.findByPk(orderId);
    requireThat(found, 404, 'NOT_FOUND', '找不到訂單');
    return atomic(async (tx) => {
      await lockUser(found.get('user_id'), tx);
      const order = (await Order.findByPk(orderId, { transaction: tx, lock: tx.LOCK.UPDATE }))!;
      const prior = await Refund.findOne({ where: { order_id: orderId }, transaction: tx });
      if (prior && prior.get('status') !== 'failed') return prior.get();
      requireThat(
        order.get('status') === 'paid' && order.get('payment_intent'),
        409,
        'NOT_REFUNDABLE',
        '訂單狀態不可退款',
      );
      const batch = await Batch.findOne({ where: { order_id: orderId }, transaction: tx, lock: tx.LOCK.UPDATE });
      requireThat(
        batch && batch.get('remaining') === batch.get('original') && !batch.get('frozen'),
        409,
        'CREDITS_ALREADY_USED',
        '此訂單點數已使用或已凍結，請人工處理',
      );
      await batch.update({ frozen: true }, { transaction: tx });
      await order.update({ status: 'refund_pending' }, { transaction: tx });
      const request_key = randomUUID();
      const r = prior
        ? await prior.update({ status: 'pending', reason, stripe_refund_id: null, request_key }, { transaction: tx })
        : await Refund.create(
            { id: randomUUID(), order_id: orderId, status: 'pending', reason, request_key },
            { transaction: tx },
          );
      await enqueue('refund', { refund_id: r.get('id'), request_key }, tx);
      await audit(actorId, 'refund.requested', orderId, { reason }, tx);
      return r.get();
    });
  }
  async executeRefund(refundId: string, requestKey: string) {
    const refund = await Refund.findByPk(refundId);
    if (!refund || refund.get('status') !== 'pending' || refund.get('request_key') !== requestKey) return;
    const order = (await Order.findByPk(refund.get('order_id')))!;
    const stripe = stripeClient();
    try {
      const result = refund.get('stripe_refund_id')
        ? await stripe.refunds.retrieve(refund.get('stripe_refund_id')!)
        : await stripe.refunds.create(
            {
              payment_intent: order.get('payment_intent')!,
              metadata: { refund_id: refundId, request_key: requestKey },
            },
            { idempotencyKey: `refund:${requestKey}` },
          );
      await Refund.update({ stripe_refund_id: result.id }, { where: { id: refundId, request_key: requestKey } });
      await this.settleRefund(result);
    } catch (error) {
      // Ambiguous network failures must keep credits frozen and retry with the same key.
      if (error instanceof Stripe.errors.StripeInvalidRequestError && error.code !== 'charge_already_refunded')
        await this.failRefund(refundId, requestKey);
      else throw error;
    }
  }
  async failRefund(id: string, requestKey?: string | null) {
    const r = await Refund.findByPk(id);
    if (!r) return;
    const o = (await Order.findByPk(r.get('order_id')))!;
    await atomic(async (tx) => {
      await lockUser(o.get('user_id'), tx);
      const locked = (await Refund.findByPk(id, { transaction: tx, lock: tx.LOCK.UPDATE }))!;
      if (locked.get('status') === 'succeeded' || (requestKey && locked.get('request_key') !== requestKey)) return;
      await locked.update({ status: 'failed' }, { transaction: tx });
      await Order.update({ status: 'paid' }, { where: { id: o.get('id') }, transaction: tx });
      await Batch.update({ frozen: false }, { where: { order_id: o.get('id') }, transaction: tx });
    });
  }
  async settleRefund(result: Stripe.Refund) {
    const refund = await Refund.findOne({
      where: {
        [Op.or]: [
          { stripe_refund_id: result.id },
          ...(result.metadata?.refund_id ? [{ id: result.metadata.refund_id }] : []),
        ],
      },
    });
    if (!refund) return;
    if (refund.get('request_key') && result.metadata?.request_key !== refund.get('request_key')) return;
    if (result.status === 'failed' || result.status === 'canceled')
      return this.failRefund(refund.get('id'), refund.get('request_key'));
    if (result.status !== 'succeeded') return;
    const order = (await Order.findByPk(refund.get('order_id')))!;
    requireThat(
      result.amount === order.get('amount') &&
        result.currency === 'hkd' &&
        (typeof result.payment_intent === 'string' ? result.payment_intent : result.payment_intent?.id) ===
          order.get('payment_intent'),
      400,
      'REFUND_MISMATCH',
      '退款資料不符',
    );
    await atomic(async (tx) => {
      await lockUser(order.get('user_id'), tx);
      const locked = (await Refund.findByPk(refund.get('id'), { transaction: tx, lock: tx.LOCK.UPDATE }))!;
      if (
        locked.get('status') === 'succeeded' ||
        (locked.get('request_key') && result.metadata?.request_key !== locked.get('request_key'))
      )
        return;
      const batch = (await Batch.findOne({
        where: { order_id: order.get('id') },
        transaction: tx,
        lock: tx.LOCK.UPDATE,
      }))!;
      requireThat(
        batch.get('remaining') === batch.get('original'),
        409,
        'REFUND_REVIEW_REQUIRED',
        '點數狀態有異，需人工對帳',
      );
      await Ledger.create(
        {
          id: randomUUID(),
          user_id: order.get('user_id'),
          batch_id: batch.get('id'),
          delta: -batch.get('remaining'),
          kind: 'refund',
          reference_id: refund.get('id'),
        },
        { transaction: tx },
      );
      await batch.update({ remaining: 0, frozen: false }, { transaction: tx });
      await locked.update({ status: 'succeeded', stripe_refund_id: result.id }, { transaction: tx });
      await Order.update({ status: 'refunded' }, { where: { id: order.get('id') }, transaction: tx });
    });
  }
  async reconcile(orderId: string) {
    const order = await Order.findByPk(orderId);
    requireThat(order && order.get('stripe_session_id'), 404, 'NOT_FOUND', '沒有可核對的付款');
    const session = await stripeClient().checkout.sessions.retrieve(order.get('stripe_session_id')!);
    if (session.payment_status === 'paid') await this.fulfill(session, `reconcile:${session.id}`);
    const refund = await Refund.findOne({ where: { order_id: orderId } });
    if (refund?.get('stripe_refund_id'))
      await this.settleRefund(await stripeClient().refunds.retrieve(refund.get('stripe_refund_id')!));
    return { status: 'checked' };
  }
}
