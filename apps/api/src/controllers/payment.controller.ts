import type { Request, Response } from 'express';
import Container from 'typedi';
import { PaymentService, stripeClient } from '../services/payment.service';
import { env } from '../config/env.config';
import { requireThat } from '../exceptions/http.exception';
import { Order, Pack } from '../models';
import { page } from '../middlewares/http';
export class PaymentController {
  service = Container.get(PaymentService);
  packs = async (_req: Request, res: Response) => {
    res.json({
      items: await Pack.findAll({ where: { active: true }, order: [['amount', 'ASC']] }),
      test_mode: !env.LIVE_PAYMENTS_ENABLED,
      available: !!env.STRIPE_SECRET_KEY,
    });
  };
  wallet = async (req: Request, res: Response) => {
    res.json(await this.service.wallet(req.actor!.id, page(req.query)));
  };
  orders = async (req: Request, res: Response) => {
    res.json(
      await Order.findAndCountAll({
        where: { user_id: req.actor!.id },
        ...page(req.query),
        order: [['created_at', 'DESC']],
      }),
    );
  };
  checkout = async (req: Request, res: Response) => {
    res.json(await this.service.checkout(req.actor!.id, req.body.pack_id));
  };
  webhook = async (req: Request, res: Response) => {
    requireThat(env.STRIPE_WEBHOOK_SECRET, 503, 'WEBHOOK_UNAVAILABLE', '付款通知尚未設定');
    const signature = req.get('stripe-signature');
    requireThat(signature, 400, 'INVALID_SIGNATURE', '缺少付款簽章');
    let event;
    try {
      event = stripeClient().webhooks.constructEvent(req.body, signature, env.STRIPE_WEBHOOK_SECRET);
    } catch {
      requireThat(false, 400, 'INVALID_SIGNATURE', '付款簽章無效');
    }
    requireThat(event.livemode === env.LIVE_PAYMENTS_ENABLED, 400, 'PAYMENT_MODE_MISMATCH', '付款模式不符');
    res.json(await this.service.webhook(event));
  };
}
