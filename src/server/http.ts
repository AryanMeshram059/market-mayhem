import { NextResponse } from 'next/server';
import { HttpError } from './errors';

export function ok<T>(data: T, status = 200): NextResponse<T> {
  return NextResponse.json(data, { status });
}

export function fail(error: unknown): NextResponse {
  if (error instanceof HttpError) {
    return NextResponse.json(
      {
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
        },
      },
      { status: error.status }
    );
  }

  const errorMsg = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack : '';
  console.error('Unhandled error:', errorMsg, errorStack);
  return NextResponse.json(
    { error: { code: 'INTERNAL_ERROR', message: `Internal server error: ${errorMsg}` } },
    { status: 500 }
  );
}

export function authHeader(request: Request): string | null {
  return request.headers.get('authorization');
}
