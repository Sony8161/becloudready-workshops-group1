// Password rules, the same as the backend (strong_password in models.py):
// at least 6 characters, with a letter and a number. The backend checks again.
export function passwordError(password) {
  if (password.length < 6) return 'Use at least 6 characters.'
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return 'Use at least one letter and one number.'
  if (password.length > 72) return 'Use 72 characters or fewer.'
  return ''
}

// 0-4 score for the strength bar. Length matters most; mixing kinds of characters helps.
export function passwordStrength(password) {
  if (!password) return { score: 0, label: '' }
  let score = 0
  if (password.length >= 6) score += 1
  if (password.length >= 10) score += 1
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1
  if (/\d/.test(password) && /[^A-Za-z0-9]/.test(password)) score += 1
  if (passwordError(password)) score = Math.min(score, 1)
  const label = ['Too weak', 'Weak', 'Okay', 'Good', 'Strong'][score]
  return { score, label }
}

// A random temporary password, for staff turning on a login: 7 letters + 3 digits,
// without look-alike characters (no 0/O, 1/l/I). crypto.getRandomValues = real randomness.
export function temporaryPassword() {
  const letters = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ'
  const digits = '23456789'
  const pick = (chars, n) => Array.from(crypto.getRandomValues(new Uint32Array(n)), (r) => chars[r % chars.length])
  const all = [...pick(letters, 7), ...pick(digits, 3)]
  for (let i = all.length - 1; i > 0; i -= 1) {
    const j = crypto.getRandomValues(new Uint32Array(1))[0] % (i + 1)
    ;[all[i], all[j]] = [all[j], all[i]]
  }
  return all.join('')
}
