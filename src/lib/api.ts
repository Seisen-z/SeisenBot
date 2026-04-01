const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api/bot';

export async function fetchApi(endpoint: string, jwt?: string, init?: RequestInit) {
  const headers = new Headers(init?.headers);
  headers.set('Content-Type', 'application/json');
  if (jwt) {
    headers.set('Authorization', `Bearer ${jwt}`);
  }

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...init,
    headers,
  });

  if (!res.ok) {
    throw new Error(`API Error: ${res.statusText}`);
  }

  return await res.json();
}
