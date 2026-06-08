import {
  getEffectiveSmtp,
  type EffectiveSmtp,
} from '#/server/smtp-settings'

// Server-only mailer. nodemailer is loaded lazily so it stays out of any
// client/SSR analysis and only initialises when an email is actually sent.

export interface MailMessage {
  to: string
  subject: string
  html: string
  text?: string
}

async function sendWith(cfg: EffectiveSmtp, msg: MailMessage): Promise<void> {
  const nodemailer = (await import('nodemailer')).default
  const transport = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: cfg.user ? { user: cfg.user, pass: cfg.pass } : undefined,
  })
  await transport.sendMail({
    from: `"${cfg.fromName}" <${cfg.fromEmail}>`,
    to: msg.to,
    subject: msg.subject,
    html: msg.html,
    text: msg.text ?? msg.html.replace(/<[^>]+>/g, ''),
  })
}

/**
 * Sends a notification email — but only if SMTP is configured AND the master
 * notifications toggle is on. Never throws (a failed email must not break the
 * triggering action); returns whether it was sent.
 */
export async function notify(msg: MailMessage): Promise<boolean> {
  try {
    const cfg = await getEffectiveSmtp()
    if (!cfg.notificationsEnabled) return false
    await sendWith(cfg, msg)
    return true
  } catch (err) {
    console.error('[mailer] notify failed', err)
    return false
  }
}

/** Sends regardless of the master toggle (used by the admin "send test"). */
export async function sendTest(msg: MailMessage): Promise<void> {
  const cfg = await getEffectiveSmtp()
  if (!cfg.configured) throw new Error('SMTP host and from-address are required.')
  await sendWith(cfg, msg)
}
