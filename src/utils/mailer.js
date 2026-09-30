import nodemailer from 'nodemailer'
import dotenv from 'dotenv'

dotenv.config()

const transporter = nodemailer.createTransport(
  process.env.SMTP_HOST === 'json'
    ? { jsonTransport: true } // for local testing only — logs the "email" instead of sending it
    : {
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === 'true', // true for port 465, false for 587/25
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      }
)

const FROM = process.env.SMTP_FROM || '"Insaf Sand Trading Company" <no-reply@insaf.ae>'

function wrapper(title, name, code, footer) {
  return `
  <div style="font-family: Arial, Helvetica, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; background:#F8F6F2;">
    <h2 style="color:#14202B; margin-bottom: 4px;">${title}</h2>
    <p style="color:#20262E; font-size: 14px;">Hi ${name || 'there'},</p>
    <p style="color:#20262E; font-size: 14px;">${footer}</p>
    <div style="font-size: 34px; font-weight: bold; letter-spacing: 10px; color:#C89249; text-align:center; padding: 24px 0; background:#14202B; border-radius: 12px; margin: 20px 0;">
      ${code}
    </div>
    <p style="color:#666; font-size: 12px;">This code expires in 15 minutes. If you did not request this, you can safely ignore this email.</p>
    <hr style="border:none;border-top:1px solid #ddd;margin:24px 0;" />
    <p style="color:#999; font-size: 11px;">Insaf Sand Trading Company LLC SPC</p>
  </div>`
}

export async function sendVerificationEmail(to, name, code) {
  await transporter.sendMail({
    from: FROM,
    to,
    subject: 'Verify your email — Insaf Sand Trading Company',
    html: wrapper(
      'Verify Your Email',
      name,
      code,
      'Thanks for registering with Insaf Sand Trading Company. Use the code below to verify your email address:'
    ),
  })
}

export async function sendPasswordResetEmail(to, name, code) {
  await transporter.sendMail({
    from: FROM,
    to,
    subject: 'Reset your password — Insaf Sand Trading Company',
    html: wrapper(
      'Reset Your Password',
      name,
      code,
      'We received a request to reset your password. Use the code below to continue:'
    ),
  })
}

// Notifies the business (CONTACT_EMAIL, falling back to SMTP_USER) whenever the Contact page form is submitted.
export async function sendContactNotification({ name, email, phone, subject, message }) {
  const notifyTo = process.env.CONTACT_EMAIL || process.env.SMTP_USER
  if (!notifyTo) return // no inbox configured — the message is still saved in the database

  const html = `
  <div style="font-family: Arial, Helvetica, sans-serif; max-width: 520px; margin: 0 auto; padding: 32px 24px; background:#F8F6F2;">
    <h2 style="color:#14202B; margin-bottom: 4px;">New Contact Form Submission</h2>
    <p style="color:#20262E; font-size: 14px;"><strong>From:</strong> ${name} (${email})</p>
    ${phone ? `<p style="color:#20262E; font-size: 14px;"><strong>Phone:</strong> ${phone}</p>` : ''}
    <p style="color:#20262E; font-size: 14px;"><strong>Subject:</strong> ${subject}</p>
    <div style="background:#fff; border:1px solid #eee; border-radius:12px; padding:16px; margin-top:12px; white-space:pre-wrap; color:#20262E; font-size: 14px;">${message}</div>
    <hr style="border:none;border-top:1px solid #ddd;margin:24px 0;" />
    <p style="color:#999; font-size: 11px;">Insaf Sand Trading Company LLC SPC — sent from the website contact form</p>
  </div>`

  await transporter.sendMail({
    from: FROM,
    to: notifyTo,
    replyTo: email,
    subject: `Website inquiry: ${subject}`,
    html,
  })
}
