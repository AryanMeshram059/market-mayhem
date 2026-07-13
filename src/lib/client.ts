'use client';

const TOKEN_KEY = 'mm_token';
const TEAM_KEY = 'mm_team';

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function getAdminToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('mm_admin_token');
}

export function setToken(token: string, team?: { id: number; name: string }) {
  localStorage.setItem(TOKEN_KEY, token);
  if (team) {
    localStorage.setItem(TEAM_KEY, JSON.stringify(team));
  }
}

export function setAdminToken(token: string) {
  localStorage.setItem('mm_admin_token', token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(TEAM_KEY);
}

export function clearAdminToken() {
  localStorage.removeItem('mm_admin_token');
}

export function getTeamInfo(): { id: number; name: string } | null {
  const raw = localStorage.getItem(TEAM_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function apiFetch<T>(
  url: string,
  options: RequestInit = {},
  isAdmin = false
): Promise<T> {
  const token = isAdmin ? getAdminToken() : getToken();
  const headers: HeadersInit = {
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  if (options.body && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(url, { ...options, headers });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: { message: 'Request failed' } }));
    throw new Error(error.error?.message ?? 'Request failed');
  }

  if (response.status === 304) {
    return null as T;
  }

  return response.json();
}
