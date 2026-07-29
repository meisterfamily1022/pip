export const AI_ERROR_CODES = [
  'INVALID_REQUEST',
  'IMAGE_REQUIRED',
  'UNSUPPORTED_IMAGE_TYPE',
  'IMAGE_TOO_LARGE',
  'RATE_LIMITED',
  'ALLOWANCE_EXHAUSTED',
  'PROVIDER_TIMEOUT',
  'PROVIDER_UNAVAILABLE',
  'INVALID_PROVIDER_RESPONSE',
  'INTERNAL_ERROR',
] as const;

export type AiErrorCode = (typeof AI_ERROR_CODES)[number];

const defaults: Record<AiErrorCode, { message: string; retryable: boolean; status: number }> = {
  INVALID_REQUEST: { message: 'The request could not be accepted.', retryable: false, status: 400 },
  IMAGE_REQUIRED: { message: 'An image is required.', retryable: false, status: 400 },
  UNSUPPORTED_IMAGE_TYPE: { message: 'That image format is not supported.', retryable: false, status: 415 },
  IMAGE_TOO_LARGE: { message: 'That image is too large.', retryable: false, status: 413 },
  RATE_LIMITED: { message: 'Please wait a moment before trying again.', retryable: true, status: 429 },
  ALLOWANCE_EXHAUSTED: { message: 'No analysis allowance remains for this installation.', retryable: false, status: 429 },
  PROVIDER_TIMEOUT: { message: 'Suggestions are unavailable right now.', retryable: true, status: 504 },
  PROVIDER_UNAVAILABLE: { message: 'Suggestions are unavailable right now.', retryable: true, status: 503 },
  INVALID_PROVIDER_RESPONSE: { message: 'Suggestions are unavailable right now.', retryable: true, status: 502 },
  INTERNAL_ERROR: { message: 'Suggestions are unavailable right now.', retryable: true, status: 500 },
};

export class AiApplicationError extends Error {
  readonly code: AiErrorCode;
  readonly retryable: boolean;
  readonly status: number;

  constructor(code: AiErrorCode, requestId: string) {
    super(defaults[code].message);
    this.name = 'AiApplicationError';
    this.code = code;
    this.retryable = defaults[code].retryable;
    this.status = defaults[code].status;
    this.requestId = requestId;
  }

  readonly requestId: string;
}

export function safeErrorBody(error: AiApplicationError) {
  return {
    error: {
      code: error.code,
      message: error.message,
      requestId: error.requestId,
      retryable: error.retryable,
    },
  };
}
