import { pool } from '../db/pool.js'

// GET /api/reviews  (public — shown on the front page)
export async function listReviews(req, res, next) {
  try {
    const result = await pool.query(
      `SELECT reviews.id, reviews.user_id, reviews.rating, reviews.title, reviews.comment, reviews.created_at,
              users.full_name AS reviewer_name, users.company AS reviewer_company
       FROM reviews
       JOIN users ON users.id = reviews.user_id
       ORDER BY reviews.created_at DESC`
    )
    res.json({ reviews: result.rows })
  } catch (err) {
    next(err)
  }
}

// POST /api/reviews  (protected — must be logged in with a verified account)
export async function createReview(req, res, next) {
  try {
    const { rating, title, comment } = req.body

    if (!rating || !comment) {
      return res.status(400).json({ error: 'Rating and comment are required.' })
    }
    if (rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5.' })
    }

    const result = await pool.query(
      `INSERT INTO reviews (user_id, rating, title, comment) VALUES ($1, $2, $3, $4) RETURNING *`,
      [req.user.userId, rating, title || null, comment]
    )
    res.status(201).json({ review: result.rows[0] })
  } catch (err) {
    next(err)
  }
}

// DELETE /api/reviews/:id  (protected — only the review's author can delete it)
export async function deleteReview(req, res, next) {
  try {
    const { id } = req.params
    const result = await pool.query('SELECT * FROM reviews WHERE id = $1', [id])
    const review = result.rows[0]

    if (!review) return res.status(404).json({ error: 'Review not found.' })
    if (Number(review.user_id) !== Number(req.user.userId)) {
      return res.status(403).json({ error: 'You can only delete your own review.' })
    }

    await pool.query('DELETE FROM reviews WHERE id = $1', [id])
    res.json({ message: 'Review deleted.' })
  } catch (err) {
    next(err)
  }
}
