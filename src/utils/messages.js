export function toArabicToastMessage(message, fallback) {
  const text = typeof message === 'string' ? message.trim() : ''
  return /[\u0600-\u06ff]/.test(text) ? text : fallback
}
