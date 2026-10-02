// The same money rules as the backend (account_service.check_amount), checked in the browser first
// so people get instant feedback. The backend still checks everything again.
export const MAX_AMOUNT = 1000000

export function amountError(text, { max } = {}) {
  const value = Number(text)
  if (text === '' || !(value > 0)) return 'Enter an amount greater than $0.'
  if (!/^\d+(\.\d{1,2})?$/.test(String(text).trim())) return 'Use at most 2 decimal places (cents).'
  if (value > MAX_AMOUNT) return 'The limit is $1,000,000 per transaction.'
  if (max !== undefined && value > max) return 'Not enough money in that account.'
  return ''
}
