import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import * as authController from '../controllers/auth.controller.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

// Limit brute-force attempts on sensitive auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many attempts. Please try again in a few minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
})

router.post('/register', authLimiter, authController.register)
router.post('/verify-email', authLimiter, authController.verifyEmail)
router.post('/resend-verification', authLimiter, authController.resendVerification)
router.post('/login', authLimiter, authController.login)
router.post('/forgot-password', authLimiter, authController.forgotPassword)
router.post('/reset-password', authLimiter, authController.resetPassword)

router.get('/me', requireAuth, authController.getMe)
router.put('/profile', requireAuth, authController.updateProfile)
router.put('/change-password', requireAuth, authController.changePassword)

export default router
