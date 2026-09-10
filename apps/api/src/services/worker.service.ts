import Container, { Service } from 'typedi';
import { randomUUID } from 'node:crypto';
import { Op } from 'sequelize';
import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import path from 'node:path';
import fs from 'node:fs/promises';
import { atomic } from '../database/connection';
import { Job, Certificate, Enrollment, User } from '../models';
import { env } from '../config/env.config';
import { StorageService } from './storage.service';
import { PaymentService } from './payment.service';
import { enqueue } from './job.service';
import { logger } from '../utils/logger';
const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
@Service()
export class WorkerService {
  private storage = Container.get(StorageService);
  private payments = Container.get(PaymentService);
  async once() {
    const job = await atomic(async (tx) => {
      const row = await Job.findOne({
        where: {
          [Op.or]: [
            { status: 'pending', available_at: { [Op.lte]: new Date() } },
            { status: 'running', locked_at: { [Op.lt]: new Date(Date.now() - 10 * 60000) } },
          ],
        },
        order: [['created_at', 'ASC']],
        transaction: tx,
        lock: tx.LOCK.UPDATE,
        skipLocked: true,
      });
      if (!row) return null;
      await row.update(
        { status: 'running', locked_at: new Date(), lock_token: randomUUID(), attempts: row.get('attempts') + 1 },
        { transaction: tx },
      );
      return row.get();
    });
    if (!job) return false;
    try {
      if (job.kind === 'certificate') await this.certificate(String(job.payload.certificate_id));
      else if (job.kind === 'mail') await this.mail(job.id, job.payload);
      else if (job.kind === 'refund')
        await this.payments.executeRefund(String(job.payload.refund_id), String(job.payload.request_key));
      else throw new Error('unknown_job');
      await Job.update(
        { status: 'done', payload: {}, locked_at: null, lock_token: null, last_error: null },
        { where: { id: job.id, lock_token: job.lock_token } },
      );
    } catch (error) {
      const code = error instanceof Error ? error.name : 'WorkerError';
      await Job.update(
        {
          status: job.attempts >= 8 ? 'failed' : 'pending',
          available_at: new Date(Date.now() + Math.min(3600000, 2 ** job.attempts * 1000)),
          locked_at: null,
          lock_token: null,
          last_error: code,
        },
        { where: { id: job.id, lock_token: job.lock_token } },
      );
      logger.error('job_failed', { job_id: job.id, kind: job.kind, attempts: job.attempts, error_type: code });
    }
    return true;
  }
  async certificate(id: string) {
    const c = await Certificate.findByPk(id);
    if (!c || c.get('revoked_at') || c.get('pdf_key')) return;
    const doc = new PDFDocument({
      size: 'A4',
      layout: 'landscape',
      margin: 50,
      info: { Title: '課程完成證書', Author: c.get('issuer') },
    });
    const chunks: Buffer[] = [];
    const done = new Promise<Buffer>((resolve, reject) => {
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
    });
    const font = env.CERTIFICATE_FONT_PATH || path.resolve(__dirname, '../../assets/NotoSansTC-Regular.otf');
    doc.font(font);
    doc.rect(24, 24, 794, 547).lineWidth(2).stroke('#235449');
    const fitted = (text: string, x: number, y: number, width: number, height: number, max: number) => {
      let size = max;
      doc.fontSize(size);
      while (size > 8 && doc.heightOfString(text, { width }) > height) doc.fontSize(--size);
      doc.text(text, x, y, { width, height, align: 'center' });
    };
    doc.fillColor('#235449');
    fitted(c.get('issuer'), 50, 62, 742, 44, 16);
    doc.fontSize(34).text('課程完成證書', 50, 125, { align: 'center' });
    doc
      .fillColor('#64716c')
      .fontSize(12)
      .text('CERTIFICATE OF COMPLETION', 50, 176, { align: 'center', characterSpacing: 2 });
    doc.fillColor('#182f29');
    fitted(c.get('name'), 50, 222, 742, 51, 28);
    doc.fontSize(13).text('已通過以下課程評核', 50, 279, { align: 'center' });
    fitted(c.get('title'), 65, 312, 712, 59, 20);
    doc
      .fontSize(12)
      .text(`完成日期：${c.get('completed_at').toLocaleDateString('zh-HK', { timeZone: 'Asia/Hong_Kong' })}`, 50, 379, {
        align: 'center',
      });
    doc.fontSize(11).text('此為課程完成證明，不代表已獲正式 CPD 學分認可。', 50, 414, { align: 'center' });
    const qr = await QRCode.toBuffer(`${env.APP_URL}/?verify=${id}`, { width: 160, margin: 0 });
    doc.image(qr, 687, 449, { width: 75 });
    doc.fontSize(9).fillColor('#64716c').text(`證書編號 ${id}`, 60, 489).text('掃描 QR 碼查核證書狀態', 60, 507);
    doc.end();
    const pdf = await done;
    const key = `certificates/${id}.pdf`;
    await this.storage.put(key, pdf, 'application/pdf');
    await atomic(async (tx) => {
      const locked = (await Certificate.findByPk(id, { transaction: tx, lock: tx.LOCK.UPDATE }))!;
      if (locked.get('pdf_key') || locked.get('revoked_at')) return;
      await locked.update({ pdf_key: key }, { transaction: tx });
      const e = (await Enrollment.findByPk(c.get('enrollment_id'), { transaction: tx }))!;
      const u = (await User.findByPk(e.get('user_id'), { transaction: tx }))!;
      await enqueue(
        'mail',
        { to: u.get('email'), name: u.get('name'), template: 'certificate', url: `${env.APP_URL}/?page=certificates` },
        tx,
      );
    });
  }
  async mail(id: string, payload: Record<string, unknown>) {
    const title =
      payload.template === 'verify'
        ? '驗證你的電郵'
        : payload.template === 'reset'
          ? '重設密碼'
          : '你的完成證書已準備好';
    const html = `<div style="font-family:sans-serif"><h2>${title}</h2><p>${escapeHtml(String(payload.name))}，你好！</p><p><a href="${escapeHtml(String(payload.url))}">${title}</a></p><p>知行 AI · 醫護學習平台</p></div>`;
    if (!env.RESEND_API_KEY) {
      if (env.NODE_ENV === 'production') throw new Error('mail_unconfigured');
      const dir = path.resolve(env.LOCAL_STORAGE_PATH, '../mail');
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(path.join(dir, `${id}.html`), html);
      return;
    }
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': id,
      },
      body: JSON.stringify({ from: env.MAIL_FROM, to: [payload.to], subject: title, html }),
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) throw new Error('mail_delivery_failed');
  }
}
