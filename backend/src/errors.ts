import { ErrorCode } from '@pharmassist/shared'

/**
 * An error the API is willing to describe to the client. Anything not an
 * AppError is treated as unexpected and reported without detail, so an
 * internal message can never leak a connection string or a stack trace.
 */
export class AppError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly statusCode: number,
  ) {
    super(message)
    this.name = 'AppError'
  }

  static invalidInput(message: string): AppError {
    return new AppError(ErrorCode.INVALID_INPUT, message, 400)
  }

  static authExpired(message = 'Session expired or missing'): AppError {
    return new AppError(ErrorCode.AUTH_EXPIRED, message, 401)
  }

  static forbidden(message = 'You do not have access to this resource'): AppError {
    return new AppError(ErrorCode.FORBIDDEN, message, 403)
  }

  static notFound(message: string, code: ErrorCode = ErrorCode.NOT_FOUND): AppError {
    return new AppError(code, message, 404)
  }

  static conflict(code: ErrorCode, message: string): AppError {
    return new AppError(code, message, 409)
  }
}
