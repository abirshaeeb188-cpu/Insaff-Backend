import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import authRoutes from './routes/auth.routes.js'
import reviewsRoutes from './routes/reviews.routes.js'
import contactRoutes from './routes/contact.routes.js'
import { errorHandler } from './middleware/errorHandler.js'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 5000

// Accept a comma-separated list in FRONTEND_URL so both the default Vite port (5173)
// and this project's custom dev port (8443, set in frontend/vite.config.ts) work out of the box.
const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:5173,http://localhost:8443')
  .split(',')
  .map((url) => url.trim())
  .filter(Boolean)

app.use(cors({
  origin(origin, callback) {
    // Allow same-origin/non-browser requests (no Origin header) and any configured frontend URL
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true)
    callback(new Error('Not allowed by CORS'))
  },
  credentials: true,
}))
app.use(express.json())

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.use('/api/auth', authRoutes)
app.use('/api/reviews', reviewsRoutes)
app.use('/api/contact', contactRoutes)

app.use((req, res) => res.status(404).json({ error: 'Route not found.' }))
app.use(errorHandler)

app.listen(PORT, () => {
  console.log(`🚀 Insaf backend running on http://localhost:${PORT}`)
})
