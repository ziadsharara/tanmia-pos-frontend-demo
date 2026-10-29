export class DemoError extends Error {
  constructor(message, status = 400, data = null) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.response = { status: false, message, data }
  }
}
