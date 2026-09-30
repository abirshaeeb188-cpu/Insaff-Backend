import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import * as contactController from '../controllers/contact.controller.js'

const router = Router()

// Public endpoint — keep it generous but still capped to deter spam/abuse
const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many messages sent. Please try again in a few minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
})

router.post('/', contactLimiter, contactController.submitContactMessage)

export default router
