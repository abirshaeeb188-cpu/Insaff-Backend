import { Router } from 'express'
import * as reviewsController from '../controllers/reviews.controller.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

router.get('/', reviewsController.listReviews)          // public — front page reads all reviews
router.post('/', requireAuth, reviewsController.createReview)   // must be logged in (verified) to post
router.delete('/:id', requireAuth, reviewsController.deleteReview)

export default router
