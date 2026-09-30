import bcrypt from 'bcryptjs'
import { pool } from '../db/pool.js'
import { generateOTP, getExpiryDate } from '../utils/otp.js'
import { signToken } from '../utils/jwt.js'
import { sendVerificationEmail, sendPasswordResetEmail } from '../utils/mailer.js'

function publicUser(u) {
  return {
    id: u.id,
    fullName: u.full_name,
    email: u.email,
    phone: u.phone,
    company: u.company,
    isVerified: u.is_verified,
    createdAt: u.created_at,
  }
}

// POST /api/auth/register
export async function register(req, res, next) {
  try {
    const { fullName, email, phone, company, password } = req.body

    if (!fullName || !email || !password) {
      return res.status(400).json({ error: 'Full name, email and password are required.' })
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters.' })
    }

    const normalizedEmail = email.toLowerCase().trim()
    const existing = await pool.query('SELECT * FROM users WHERE email = $1', [normalizedEmail])

    if (existing.rows.length && existing.rows[0].is_verified) {
      return res.status(409).json({ error: 'An account with this email already exists. Try logging in instead.' })
    }

    const passwordHash = await bcrypt.hash(password, 10)
    const code = generateOTP()
    const expires = getExpiryDate(15)

    let user
    if (existing.rows.length) {
      // Unverified account already exists (abandoned signup) — update details & resend a fresh code
      const result = await pool.query(
        `UPDATE users SET full_name=$1, phone=$2, company=$3, password_hash=$4,
         verification_code=$5, verification_code_expires=$6 WHERE email=$7 RETURNING *`,
        [fullName, phone || null, company || null, passwordHash, code, expires, normalizedEmail]
      )
      user = result.rows[0]
    } else {
      const result = await pool.query(
        `INSERT INTO users (full_name, email, phone, company, password_hash, verification_code, verification_code_expires)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
        [fullName, normalizedEmail, phone || null, company || null, passwordHash, code, expires]
      )
      user = result.rows[0]
    }

    await sendVerificationEmail(user.email, user.full_name, code)

    res.status(201).json({ message: 'A 6-digit verification code has been sent to your email.', email: user.email })
  } catch (err) {
    next(err)
  }
}

// POST /api/auth/verify-email
export async function verifyEmail(req, res, next) {
  try {
    const { email, code } = req.body
    if (!email || !code) return res.status(400).json({ error: 'Email and code are required.' })

    const normalizedEmail = email.toLowerCase().trim()
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [normalizedEmail])
    const user = result.rows[0]

    if (!user) return res.status(404).json({ error: 'Account not found.' })
    if (user.is_verified) return res.status(400).json({ error: 'Email is already verified. Please log in.' })
    if (!user.verification_code || user.verification_code !== String(code)) {
      return res.status(400).json({ error: 'Invalid verification code.' })
    }
    if (new Date(user.verification_code_expires) < new Date()) {
      return res.status(400).json({ error: 'Verification code has expired. Please request a new one.' })
    }

    const updated = await pool.query(
      `UPDATE users SET is_verified = true, verification_code = NULL, verification_code_expires = NULL
       WHERE id = $1 RETURNING *`,
      [user.id]
    )
    const verifiedUser = updated.rows[0]
    const token = signToken({ userId: verifiedUser.id, email: verifiedUser.email })

    res.json({ token, user: publicUser(verifiedUser) })
  } catch (err) {
    next(err)
  }
}

// POST /api/auth/resend-verification
export async function resendVerification(req, res, next) {
  try {
    const { email } = req.body
    if (!email) return res.status(400).json({ error: 'Email is required.' })

    const normalizedEmail = email.toLowerCase().trim()
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [normalizedEmail])
    const user = result.rows[0]

    if (!user) return res.status(404).json({ error: 'Account not found.' })
    if (user.is_verified) return res.status(400).json({ error: 'Email is already verified.' })

    const code = generateOTP()
    const expires = getExpiryDate(15)
    await pool.query(
      'UPDATE users SET verification_code = $1, verification_code_expires = $2 WHERE id = $3',
      [code, expires, user.id]
    )
    await sendVerificationEmail(user.email, user.full_name, code)

    res.json({ message: 'A new verification code has been sent.' })
  } catch (err) {
    next(err)
  }
}

// POST /api/auth/login
export async function login(req, res, next) {
  try {
    const { email, password } = req.body
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required.' })

    const normalizedEmail = email.toLowerCase().trim()
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [normalizedEmail])
    const user = result.rows[0]

    if (!user) return res.status(401).json({ error: 'Invalid email or password.' })

    const match = await bcrypt.compare(password, user.password_hash)
    if (!match) return res.status(401).json({ error: 'Invalid email or password.' })

    if (!user.is_verified) {
      return res.status(403).json({
        error: 'Please verify your email before logging in.',
        unverified: true,
        email: user.email,
      })
    }

    const token = signToken({ userId: user.id, email: user.email })
    res.json({ token, user: publicUser(user) })
  } catch (err) {
    next(err)
  }
}

// POST /api/auth/forgot-password
export async function forgotPassword(req, res, next) {
  try {
    const { email } = req.body
    if (!email) return res.status(400).json({ error: 'Email is required.' })

    const normalizedEmail = email.toLowerCase().trim()
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [normalizedEmail])
    const user = result.rows[0]

    // Always respond the same way whether or not the account exists (avoids leaking registered emails)
    if (user) {
      const code = generateOTP()
      const expires = getExpiryDate(15)
      await pool.query('UPDATE users SET reset_code = $1, reset_code_expires = $2 WHERE id = $3', [code, expires, user.id])
      await sendPasswordResetEmail(user.email, user.full_name, code)
    }

    res.json({ message: 'If an account exists with this email, a reset code has been sent.' })
  } catch (err) {
    next(err)
  }
}

// POST /api/auth/reset-password
export async function resetPassword(req, res, next) {
  try {
    const { email, code, newPassword } = req.body
    if (!email || !code || !newPassword) {
      return res.status(400).json({ error: 'Email, code and new password are required.' })
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters.' })
    }

    const normalizedEmail = email.toLowerCase().trim()
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [normalizedEmail])
    const user = result.rows[0]

    if (!user || !user.reset_code || user.reset_code !== String(code)) {
      return res.status(400).json({ error: 'Invalid or expired reset code.' })
    }
    if (new Date(user.reset_code_expires) < new Date()) {
      return res.status(400).json({ error: 'Reset code has expired. Please request a new one.' })
    }

    const passwordHash = await bcrypt.hash(newPassword, 10)
    await pool.query(
      'UPDATE users SET password_hash = $1, reset_code = NULL, reset_code_expires = NULL WHERE id = $2',
      [passwordHash, user.id]
    )

    res.json({ message: 'Password reset successfully. You can now log in.' })
  } catch (err) {
    next(err)
  }
}

// GET /api/auth/me  (protected)
export async function getMe(req, res, next) {
  try {
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.userId])
    const user = result.rows[0]
    if (!user) return res.status(404).json({ error: 'User not found.' })
    res.json({ user: publicUser(user) })
  } catch (err) {
    next(err)
  }
}

// PUT /api/auth/profile  (protected)
export async function updateProfile(req, res, next) {
  try {
    const { fullName, phone, company } = req.body
    const result = await pool.query(
      `UPDATE users SET full_name = COALESCE($1, full_name), phone = COALESCE($2, phone),
       company = COALESCE($3, company) WHERE id = $4 RETURNING *`,
      [fullName, phone, company, req.user.userId]
    )
    res.json({ user: publicUser(result.rows[0]) })
  } catch (err) {
    next(err)
  }
}

// PUT /api/auth/change-password  (protected — user already knows their current password)
export async function changePassword(req, res, next) {
  try {
    const { currentPassword, newPassword } = req.body
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current password and new password are required.' })
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters.' })
    }

    const result = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.userId])
    const user = result.rows[0]
    if (!user) return res.status(404).json({ error: 'User not found.' })

    const match = await bcrypt.compare(currentPassword, user.password_hash)
    if (!match) return res.status(401).json({ error: 'Current password is incorrect.' })

    const passwordHash = await bcrypt.hash(newPassword, 10)
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, user.id])

    res.json({ message: 'Password updated successfully.' })
  } catch (err) {
    next(err)
  }
}
