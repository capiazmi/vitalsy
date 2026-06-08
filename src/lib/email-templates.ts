// Plain, dependency-free email templates. Each returns { subject, html }.

function layout(title: string, body: string): string {
  return `<!doctype html><html><body style="margin:0;background:#f3faf5;font-family:system-ui,sans-serif;color:#173a40">
  <div style="max-width:520px;margin:0 auto;padding:24px">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px">
      <div style="width:32px;height:32px;border-radius:8px;background:#0f766e"></div>
      <strong style="font-size:18px">BP Monitor</strong>
    </div>
    <div style="background:#fff;border:1px solid rgba(23,58,64,.12);border-radius:12px;padding:20px">
      <h1 style="margin:0 0 12px;font-size:18px">${title}</h1>
      ${body}
    </div>
    <p style="margin-top:16px;font-size:12px;color:#416166">This is an automated message from BP Monitor.</p>
  </div></body></html>`
}

function button(href: string, label: string): string {
  return `<a href="${href}" style="display:inline-block;margin-top:8px;background:#0f766e;color:#fff;text-decoration:none;padding:10px 16px;border-radius:8px;font-weight:600">${label}</a>`
}

export function accountCreated(opts: {
  name: string
  email: string
  password?: string
  appUrl: string
}) {
  const creds = opts.password
    ? `<p style="margin:8px 0">Your temporary password is:
       <code style="background:#e7f0e8;padding:2px 8px;border-radius:6px">${opts.password}</code></p>
       <p style="margin:8px 0;color:#416166;font-size:13px">Please change it after signing in.</p>`
    : ''
  return {
    subject: 'Your BP Monitor account is ready',
    html: layout(
      `Welcome, ${opts.name}`,
      `<p style="margin:8px 0">An administrator created a BP Monitor account for you.</p>
       <p style="margin:8px 0">Email: <strong>${opts.email}</strong></p>
       ${creds}
       <p style="margin:12px 0 0">${button(`${opts.appUrl}/login`, 'Sign in')}</p>`,
    ),
  }
}

export function passwordResetByAdmin(opts: {
  name: string
  password?: string
  appUrl: string
}) {
  const creds = opts.password
    ? `<p style="margin:8px 0">Your new password is:
       <code style="background:#e7f0e8;padding:2px 8px;border-radius:6px">${opts.password}</code></p>
       <p style="margin:8px 0;color:#416166;font-size:13px">Please change it after signing in.</p>`
    : `<p style="margin:8px 0">Please sign in with your new password.</p>`
  return {
    subject: 'Your BP Monitor password was reset',
    html: layout(
      `Password reset, ${opts.name}`,
      `<p style="margin:8px 0">An administrator reset your BP Monitor password.</p>
       ${creds}
       <p style="margin:12px 0 0">${button(`${opts.appUrl}/login`, 'Sign in')}</p>`,
    ),
  }
}

export function passwordResetRequest(opts: { name: string; url: string }) {
  return {
    subject: 'Reset your BP Monitor password',
    html: layout(
      `Reset your password`,
      `<p style="margin:8px 0">Hi ${opts.name}, we received a request to reset your password.</p>
       <p style="margin:8px 0">This link expires soon. If you didn't request it, ignore this email.</p>
       <p style="margin:12px 0 0">${button(opts.url, 'Reset password')}</p>`,
    ),
  }
}

export function testEmail() {
  return {
    subject: 'BP Monitor SMTP test',
    html: layout(
      'SMTP test successful',
      `<p style="margin:8px 0">If you're reading this, your SMTP settings work. 🎉</p>`,
    ),
  }
}
