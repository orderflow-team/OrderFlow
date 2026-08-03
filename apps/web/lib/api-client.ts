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
  (error) => {
    if (error.response?.status === 401) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('access_token');
        localStorage.removeItem('user');
        // Can't call useRouter() from a plain module — AuthRedirectListener
        // (mounted in the root layout) does the actual router.push('/login').
        window.dispatchEvent(new CustomEvent('auth:unauthorized'));
      }
    }
    return Promise.reject(error);
  },
);

export default apiClient;
