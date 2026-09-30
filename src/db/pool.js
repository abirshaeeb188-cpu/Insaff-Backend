import pg from 'pg'
import dotenv from 'dotenv'

dotenv.config()

const { Pool } = pg

if (!process.env.DATABASE_URL) {
  console.warn('⚠️  DATABASE_URL is not set. Set it in your .env file (Neon connection string).')
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Neon requires SSL. For a local Postgres during development, set DATABASE_SSL=false in .env
  ssl: process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false },
})

pool.on('error', (err) => {
  console.error('Unexpected error on idle Postgres client', err)
})
