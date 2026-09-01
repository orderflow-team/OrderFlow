import axios from 'axios';

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

/**
 * Uploaded-file paths from the backend (product images, business logos,
 * invoice-scan previews) are absolute for anything uploaded after this fix,
 * but older records in the database may still hold a bare "/uploads/..."
 * path from when the web app was server-rendered and a Next.js rewrite
 * proxied that path to the backend. Now that it's a static export with no
 * server of its own, a relative path 404s — resolve it against the API
 * origin so both old and new records render correctly.
 */
export function toAbsoluteFileUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  // Only rewrite a genuine root-relative server path — pass everything else
  // (already-absolute http(s) URLs, data: URIs from a local FileReader
  // preview, blob: URIs) through unchanged.
  if (!url.startsWith('/')) return url;
  return `${API_BASE_URL}${url}`;
}

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to all requests
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// De-duplicates concurrent refreshes: if several requests 401 around the same
// moment (e.g. a handful of components fetching right after the app resumes
// from background), they all await this same in-flight call instead of each
// triggering their own POST /auth/refresh.
let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = localStorage.getItem('refresh_token');
  if (!refreshToken) return null;
  try {
    // Bare axios, not apiClient — a call through apiClient would re-enter
    // this same response interceptor if the refresh itself ever 401s.
    const res = await axios.post(`${API_BASE_URL}/auth/refresh`, { refreshToken });
    localStorage.setItem('access_token', res.data.access_token);
    localStorage.setItem('refresh_token', res.data.refresh_token);
    // The refreshed token's businessId is re-derived server-side from the
    // user's CURRENT business_id — which can differ from what's cached here
    // if it changed since this device last did a full login/select (e.g.
    // switching workspaces on another device, or any other reassignment).
    // issueTokens() (auth.service.ts) always returns this fresh `user`
    // alongside the tokens specifically so a refresh can re-sync it; leaving
    // it un-synced meant every subsequent request kept sending the stale
    // cached businessId while the new token carried a different one —
    // BusinessScopeGuard then rejects every business-scoped request with
    // "Business mismatch" until the user logs out and back in.
    if (res.data.user) {
      localStorage.setItem('user', JSON.stringify(res.data.user));
    }
    return res.data.access_token;
  } catch {
    return null;
  }
}

// Handle response and dispatch events for dashboard/billing updates
apiClient.interceptors.response.use(
  (response) => {
    const url = response.config.url;
    const method = response.config.method?.toUpperCase();
    if (url && (
      url.includes('/api/orders') ||
      url.includes('/api/billing') ||
      url.includes('/api/ai/chat-order') ||
      url.includes('/api/dev/seed')
    )) {
      if (method && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('order-updated'));
        }
      }
    }
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    // A short-lived access_token expiring is routine — try a silent refresh
    // and retry once before treating this as a real logout. _retry guards
    // against looping if the retried request 401s again (e.g. the refresh
    // token itself turned out to be invalid/expired).
    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      originalRequest._retry = true;
      if (!refreshPromise) {
        refreshPromise = refreshAccessToken().finally(() => {
          refreshPromise = null;
        });
      }
      const newToken = await refreshPromise;
      if (newToken) {
        return apiClient(originalRequest);
      }
    }

    if (error.response?.status === 401) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('user');
        // Can't call useRouter() from a plain module — AuthRedirectListener
        // (mounted in the root layout) does the actual router.push('/login').
        window.dispatchEvent(new CustomEvent('auth:unauthorized'));
      }
    }

    if (error.response?.status === 402) {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('orderflow-paywall-required', { detail: error.response?.data }));
      }
    }

    // A session already stuck with a stale cached businessId (see
    // refreshAccessToken above for how that happens) hits this on every
    // business-scoped request until something re-syncs it. One-shot recovery:
    // force a refresh (which now re-syncs `user`, including businessId) and
    // reload so every page re-reads the corrected value from scratch, rather
    // than leaving the user stuck until their access_token happens to expire
    // naturally (up to 24h) or they think to log out and back in themselves.
    // The sessionStorage flag caps this to one attempt per browser session so
    // a mismatch that turns out NOT to be fixable by a refresh (e.g. account
    // actually removed from the business) can't reload-loop.
    if (
      error.response?.status === 403 &&
      error.response?.data?.message === 'Business mismatch' &&
      typeof window !== 'undefined' &&
      !sessionStorage.getItem('business_mismatch_recovery_attempted')
    ) {
      sessionStorage.setItem('business_mismatch_recovery_attempted', '1');
      if (!refreshPromise) {
        refreshPromise = refreshAccessToken().finally(() => {
          refreshPromise = null;
        });
      }
      const newToken = await refreshPromise;
      if (newToken) {
        window.location.reload();
        // The reload is already in flight — never resolve/reject further so
        // nothing downstream renders a flash of this error first.
        return new Promise(() => {});
      }
    }

    return Promise.reject(error);
  },
);

export default apiClient;
