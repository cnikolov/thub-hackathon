// Talks to the Bun + SQLite API only (no Firebase).
export const API_BASE =
  import.meta.env.VITE_API_URL?.replace(/\/$/, '') ??
  (import.meta.env.DEV ? '/api' : 'http://localhost:3001');

const TOKEN_KEY = 'thub_token';

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string | null): void {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

function buildHeaders(init?: HeadersInit): Headers {
  const h = new Headers(init);
  const t = getStoredToken();
  if (t) h.set('Authorization', `Bearer ${t}`);
  return h;
}

export type ApiSuccess<T> = { success: true; data: T };
export type ApiError = { success: false; error: string };
export type ApiResult<T> = ApiSuccess<T> | ApiError;

async function parseJson<T>(response: Response): Promise<T> {
  return response.json() as Promise<T>;
}

export const api = {
  get: async <T>(endpoint: string): Promise<T> => {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      headers: buildHeaders(),
    });
    const text = await response.text();
    if (!response.ok) {
      try {
        const j = JSON.parse(text) as { error?: string };
        if (j?.error) throw new Error(j.error);
      } catch (e) {
        if (e instanceof Error && e.message !== text) throw e;
      }
      throw new Error(`API GET ${endpoint}: ${response.statusText}`);
    }
    return JSON.parse(text) as T;
  },

  post: async <T>(endpoint: string, data?: unknown): Promise<T> => {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      method: 'POST',
      headers: buildHeaders({ 'Content-Type': 'application/json' }),
      body: data !== undefined ? JSON.stringify(data) : undefined,
    });
    if (!response.ok) {
      throw new Error(`API POST ${endpoint}: ${response.statusText}`);
    }
    return parseJson<T>(response);
  },

  /** Multipart upload (do not set Content-Type; browser sets boundary). */
  postForm: async <T>(endpoint: string, form: FormData): Promise<T> => {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      method: 'POST',
      headers: buildHeaders(),
      body: form,
    });
    const text = await response.text();
    if (!response.ok) {
      try {
        const j = JSON.parse(text) as { error?: string };
        if (j?.error) throw new Error(j.error);
      } catch (e) {
        if (e instanceof Error && e.message !== text) throw e;
      }
      throw new Error(`API POST ${endpoint}: ${response.statusText}`);
    }
    return JSON.parse(text) as T;
  },

  patch: async <T>(endpoint: string, data: unknown): Promise<T> => {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      method: 'PATCH',
      headers: buildHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      throw new Error(`API PATCH ${endpoint}: ${response.statusText}`);
    }
    return parseJson<T>(response);
  },

  delete: async <T>(endpoint: string): Promise<T> => {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      method: 'DELETE',
      headers: buildHeaders(),
    });
    if (!response.ok) {
      throw new Error(`API DELETE ${endpoint}: ${response.statusText}`);
    }
    return parseJson<T>(response);
  },
};
