
export function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    }
    return entities[character]
  })
}

export function emailLayout(title: string, inner: string) {
  return `
    <div style="margin:0;background:#f7f4fb;padding:32px 16px;font-family:Arial,sans-serif;color:#201750">
      <div style="max-width:640px;margin:0 auto;background:white;border:1px solid #ddd5e8;border-radius:20px;overflow:hidden">
        <div style="background:#1b0c67;padding:28px;color:white">
          <p style="margin:0 0 8px;color:#fbb257;font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase">Concours Authentique Homme</p>
          <h1 style="margin:0;font-family:Georgia,serif;font-size:26px">${escapeHtml(title)}</h1>
        </div>
        <div style="padding:24px;font-size:15px;line-height:1.6">${inner}</div>
        <div style="padding:16px 24px;border-top:1px solid #ddd5e8;font-size:12px;color:#665e78">Ministère Porteur d’Amour — 3 Jours de Reconnaissance 2026</div>
      </div>
    </div>`
}

export function codeBlock(label: string, code: string) {
  return `<p style="margin:24px 0;padding:16px;border-radius:14px;background:#fff0df;text-align:center">
    ${escapeHtml(label)}<br/>
    <strong style="font-size:26px;letter-spacing:4px;color:#1b0c67;font-family:monospace">${escapeHtml(code)}</strong>
  </p>`
}

/** Gmail (adresse officielle du Ministère + mot de passe d’application) ou, à défaut, Resend. */
function gmailConfigured() {
  return Boolean(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD)
}

export function emailConfigured() {
  return gmailConfigured() || Boolean(process.env.RESEND_API_KEY)
}

let transporter: import('nodemailer').Transporter | null = null

async function sendWithGmail(to: string, subject: string, html: string, replyTo?: string) {
  const nodemailer = await import('nodemailer')
  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        // Le mot de passe d’application Google s’affiche avec des espaces : on les retire.
        pass: String(process.env.GMAIL_APP_PASSWORD).replace(/\s/g, ''),
      },
    })
  }
  await transporter.sendMail({
    from: `"Concours Authentique Homme" <${process.env.GMAIL_USER}>`,
    to,
    subject,
    html,
    replyTo: replyTo || process.env.GMAIL_USER,
  })
  return true
}

/** Envoie un e-mail. Renvoie false si l’envoi est impossible ou a échoué. */
export async function sendEmail(to: string, subject: string, html: string, replyTo?: string) {
  try {
    if (gmailConfigured()) return await sendWithGmail(to, subject, html, replyTo)
    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) return false
    const from =
      process.env.MINISTRY_FROM_EMAIL || 'Concours Authentique Homme <onboarding@resend.dev>'
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [to], subject, html, reply_to: replyTo }),
    })
    return response.ok
  } catch (error) {
    console.error('Envoi d’e-mail impossible :', error instanceof Error ? error.message : error)
    return false
  }
}
