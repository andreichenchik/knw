export type ErrorCode =
  | "invalid_request"
  | "unauthorized"
  | "not_found"
  | "voyage_failure"
  | "readiness_failure"
  | "internal_error";

/** Error shape returned by HTTP API routes. */
export interface ErrorResponse {
  error: {
    code: ErrorCode;
    message: string;
  };
}

export type ErrorStatus = 400 | 401 | 404 | 500 | 502 | 503;

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: ErrorStatus;

  constructor(code: ErrorCode, message: string, status: ErrorStatus) {
    super(message);
    this.code = code;
    this.status = status;
    this.name = "AppError";
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super("invalid_request", message, 400);
    this.name = "ValidationError";
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Missing or invalid bearer token") {
    super("unauthorized", message, 401);
    this.name = "UnauthorizedError";
  }
}

export class ExternalServiceError extends AppError {
  constructor(message: string) {
    super("voyage_failure", message, 502);
    this.name = "ExternalServiceError";
  }
}

export class ReadinessError extends AppError {
  constructor(message: string) {
    super("readiness_failure", message, 503);
    this.name = "ReadinessError";
  }
}

/** Builds the structured error body used by every API failure response. */
export function errorResponse(code: ErrorCode, message: string): ErrorResponse {
  return { error: { code, message } };
}
