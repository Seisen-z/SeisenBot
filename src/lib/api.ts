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
    let details = '';

    try {
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const data = await res.json();
        details = data?.detail || data?.message || JSON.stringify(data);
      } else {
        details = (await res.text()).trim();
      }
    } catch {
      // Ignore parse failures and fall back to status text only.
    }

    throw new Error(`API Error ${res.status}: ${details || res.statusText}`);
  }

  return await res.json();
}
