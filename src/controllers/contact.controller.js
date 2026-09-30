import { pool } from '../db/pool.js'
import { sendContactNotification } from '../utils/mailer.js'

// POST /api/contact  (public)
export async function submitContactMessage(req, res, next) {
  try {
    const { name, email, phone, subject, message } = req.body

    if (!name || !email || !subject || !message) {
      return res.status(400).json({ error: 'Name, email, subject and message are required.' })
    }
    if (!email.includes('@')) {
      return res.status(400).json({ error: 'Please enter a valid email address.' })
    }

    const result = await pool.query(
      `INSERT INTO contact_messages (name, email, phone, subject, message)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [name.trim(), email.toLowerCase().trim(), phone || null, subject.trim(), message.trim()]
    )

    // Best-effort email notification — the inquiry is already saved even if this fails.
    try {
      await sendContactNotification(result.rows[0])
    } catch (mailErr) {
      console.error('Could not send contact notification email:', mailErr.message)
    }

    res.status(201).json({ message: 'Thanks for reaching out — our team will get back to you within 24 hours.' })
  } catch (err) {
    next(err)
  }
}
