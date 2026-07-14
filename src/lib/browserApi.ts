'use client';

type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE';

export async function apiRequest<T = unknown>(
  path: string,
  options: {
    method?: Method;
    token?: string | null;
    body?: unknown;
  } = {}
): Promise<T> {
  const response = await fetch(path, {
    method: options.method ?? 'GET',
    headers: {
      ...(options.body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const message = data?.error?.message ?? `Request failed: ${response.status}`;
    throw new Error(message);
  }

  return data as T;
}

export function pretty(value: unknown): string {
  return JSON.stringify(value, null, 2);
}
