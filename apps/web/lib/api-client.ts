import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

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
        const currentPath = window.location.pathname;
        if (currentPath !== '/login' && currentPath !== '/signup') {
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  },
);

export default apiClient;
