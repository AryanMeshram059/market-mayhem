import { NextResponse } from 'next/server';
import { errorResponse } from '@/lib/errors';
import type { AppError } from '@/lib/errors';

export function jsonResponse<T>(data: T, status = 200, headers?: HeadersInit): NextResponse {
  return NextResponse.json(data, { status, headers });
}

export function handleApiError(error: unknown): NextResponse {
  const { body, status } = errorResponse(error);
  return NextResponse.json(body, { status });
}

export function getAuthHeader(request: Request): string | null {
  return request.headers.get('Authorization');
}

export function generateETag(data: unknown): string {
  const str = JSON.stringify(data);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return `"${Math.abs(hash).toString(16)}"`;
}

export function checkETag(
  request: Request,
  data: unknown
): NextResponse | null {
  const etag = generateETag(data);
  const ifNoneMatch = request.headers.get('If-None-Match');
  if (ifNoneMatch === etag) {
    return new NextResponse(null, {
      status: 304,
      headers: { ETag: etag },
    });
  }
  return null;
}

export function withETag<T>(request: Request, data: T): NextResponse {
  const etag = generateETag(data);
  const cached = checkETag(request, data);
  if (cached) return cached;
  return jsonResponse(data, 200, { ETag: etag });
}
