export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
  }
}

export function badRequest(message: string, details?: Record<string, unknown>): never {
  throw new HttpError(400, 'BAD_REQUEST', message, details);
}

export function unauthorized(message = 'Authentication required'): never {
  throw new HttpError(401, 'UNAUTHORIZED', message);
}

export function forbidden(message = 'Forbidden'): never {
  throw new HttpError(403, 'FORBIDDEN', message);
}

export function notFound(message = 'Not found'): never {
  throw new HttpError(404, 'NOT_FOUND', message);
}
