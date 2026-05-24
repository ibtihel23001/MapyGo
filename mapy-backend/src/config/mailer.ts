import nodemailer from 'nodemailer';
import { env } from './env';

export const transporter = nodemailer.createTransport({
  host: env.MAIL_HOST,
  port: env.MAIL_PORT,
  secure: env.MAIL_PORT === 465,
  connectionTimeout: 5000,
  greetingTimeout: 5000,
  socketTimeout: 5000,
  auth: {
    user: env.MAIL_USER,
    pass: env.MAIL_PASS,
  },
});

interface MailOptions {
  to: string;
  subject: string;
  html: string;
}

export async function sendMail({ to, subject, html }: MailOptions): Promise<void> {
  await transporter.sendMail({
    from: `"${env.MAIL_FROM_NAME}" <${env.MAIL_USER}>`,
    to,
    subject,
    html,
  });
}

// ─── Templates ───────────────────────────────────────────────

export function passwordResetTemplate(name: string, resetUrl: string): string {
  return `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto;">
      <h2 style="color:#1e293b;">Reset your password</h2>
      <p>Hi ${name},</p>
      <p>Click the button below to reset your password. This link expires in <strong>1 hour</strong>.</p>
      <a href="${resetUrl}"
         style="display:inline-block;padding:12px 24px;background:#6366f1;color:#fff;border-radius:6px;text-decoration:none;font-weight:600;margin:16px 0;">
        Reset Password
      </a>
      <p style="color:#64748b;font-size:13px;">If you did not request a password reset, ignore this email.</p>
      <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;">
      <p style="color:#94a3b8;font-size:12px;">MAP eTicket Platform</p>
    </div>
  `;
}

export function registrationApprovedTemplate(agencyName: string, loginUrl: string): string {
  return `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto;">
      <h2 style="color:#16a34a;">Your agency has been approved! 🎉</h2>
      <p>Hi,</p>
      <p><strong>${agencyName}</strong> has been approved on MAP eTicket Platform.</p>
      <p>You can now log in and start managing your tickets.</p>
      <a href="${loginUrl}"
         style="display:inline-block;padding:12px 24px;background:#16a34a;color:#fff;border-radius:6px;text-decoration:none;font-weight:600;margin:16px 0;">
        Go to Login
      </a>
    </div>
  `;
}
