import axios, { AxiosAdapter, InternalAxiosRequestConfig, AxiosResponse } from 'axios';
import { Capacitor, CapacitorHttp } from '@capacitor/core';

// Ensure mobile app running in Capacitor WebView never uses localhost or relative proxy paths
const resolveBaseUrl = (): string => {
  const envUrl = process.env.NEXT_PUBLIC_API_URL;
  if (typeof window !== 'undefined') {
    const isNative = !!(window as any).Capacitor?.isNativePlatform?.();
    if (isNative) {
      if (!envUrl || envUrl.includes('localhost') || envUrl.includes('127.0.0.1') || envUrl.startsWith('/')) {
        return 'https://obix360.com';
      }
    }
  }
  return envUrl || 'https://obix360.com';
};

export const API_BASE_URL = resolveBaseUrl();

/**
 * Native Capacitor HTTP adapter for mobile Android/iOS.
 * Bypasses Chromium WebView CORS preflight OPTIONS requests which Apache drops with 204.
 */
const capacitorAdapter: AxiosAdapter = async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
  let fullUrl = config.url || '';
  if (config.baseURL && !fullUrl.startsWith('http://') && !fullUrl.startsWith('https://')) {
    const base = config.baseURL.replace(/\/+$/, '');
    const path = fullUrl.replace(/^\/+/, '');
    fullUrl = `${base}/${path}`;
  }

  const params: Record<string, string> = {};
  if (config.params) {
    for (const [key, value] of Object.entries(config.params)) {
      if (value !== undefined && value !== null) {
        params[key] = String(value);
      }
    }
  }

  const headers: Record<string, string> = {};
  if (config.headers) {
    for (const [key, value] of Object.entries(config.headers)) {
      if (value !== undefined && value !== null && typeof value !== 'function') {
        headers[key] = String(value);
      }
    }
  }

  let data = config.data;
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data);
    } catch {
      // Keep as string
    }
  }

  try {
    const res = await CapacitorHttp.request({
      url: fullUrl,
      method: (config.method || 'GET').toUpperCase(),
      headers,
      data,
      params,
      responseType: config.responseType === 'blob' || config.responseType === 'arraybuffer' ? 'blob' : 'json',
      connectTimeout: config.timeout || 30000,
      readTimeout: config.timeout || 30000,
    });

    let resData = res.data;
    if (typeof resData === 'string' && (resData.trim().startsWith('{') || resData.trim().startsWith('['))) {
      try {
        resData = JSON.parse(resData);
      } catch {
        // Keep string
      }
    }

    const response: AxiosResponse = {
      data: resData,
      status: res.status,
      statusText: String(res.status),
      headers: res.headers || {},
      config,
      request: {},
    };

    if (res.status >= 200 && res.status < 300) {
      return response;
    }

    const errorMsg =
      (typeof resData === 'object' && resData && resData.message)
        ? (Array.isArray(resData.message) ? resData.message.join(', ') : String(resData.message))
        : `Request failed with status code ${res.status}`;

    const error: any = new Error(errorMsg);
    error.config = config;
    error.response = response;
    error.isAxiosError = true;
    error.status = res.status;
    return Promise.reject(error);
  } catch (err: any) {
    if (err.response) return Promise.reject(err);
    const error: any = new Error(err.message || 'Network error');
    error.config = config;
    error.isAxiosError = true;
    return Promise.reject(error);
  }
};

const defaultAdapter: AxiosAdapter =
  typeof axios.getAdapter === 'function' && axios.defaults?.adapter
    ? axios.getAdapter(axios.defaults.adapter)
    : (() => Promise.resolve({ data: {}, status: 200, statusText: 'OK', headers: {}, config: {} as any }));

const resolveAdapter: AxiosAdapter = (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
  if (typeof window !== 'undefined' && Capacitor?.isNativePlatform && Capacitor.isNativePlatform()) {
    return capacitorAdapter(config);
  }
  return defaultAdapter(config);
};

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
  timeout: 30000,
  adapter: resolveAdapter,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to all requests
apiClient.interceptors.request.use((config) => {
  // Mobile app safeguard: prevent any request in native Capacitor from hitting localhost or relative paths
  if (typeof window !== 'undefined' && (window as any).Capacitor?.isNativePlatform?.()) {
    if (!config.baseURL || config.baseURL.includes('localhost') || config.baseURL.startsWith('/')) {
      config.baseURL = 'https://obix360.com';
    }
  }
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  // Allow browser/Axios to set multipart boundary automatically for FormData
  if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
    delete config.headers['Content-Type'];
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
    const res = await axios.post(`${API_BASE_URL}/auth/refresh`, { refreshToken }, {
      adapter: resolveAdapter,
    });
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
    const isAuthRoute =
      originalRequest?.url?.includes('/auth/login') ||
      originalRequest?.url?.includes('/auth/google') ||
      originalRequest?.url?.includes('/auth/otp') ||
      originalRequest?.url?.includes('/auth/signup');

    // A short-lived access_token expiring is routine — try a silent refresh
    // and retry once before treating this as a real logout. _retry guards
    // against looping if the retried request 401s again (e.g. the refresh
    // token itself turned out to be invalid/expired).
    // Never attempt token refresh on initial authentication/login routes.
    if (error.response?.status === 401 && !isAuthRoute && originalRequest && !originalRequest._retry) {
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

    if (error.response?.status === 401 && !isAuthRoute) {
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
