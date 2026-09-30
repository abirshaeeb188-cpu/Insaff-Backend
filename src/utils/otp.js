// Generates a random 6-digit numeric code, e.g. "042917"
export function generateOTP() {
  return String(Math.floor(100000 + Math.random() * 900000))
}

// Returns a Date `minutes` from now (used for code expiry)
export function getExpiryDate(minutes = 15) {
  return new Date(Date.now() + minutes * 60 * 1000)
}
