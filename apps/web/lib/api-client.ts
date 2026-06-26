import axios from 'axios';

const isBrowser = typeof window !== 'undefined';
const API_BASE_URL = isBrowser 
  ? '/api-proxy' 
  : (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000');

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

// Handle errors
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('access_token');
      // Temporarily removed the window.location.href redirect entirely
      // to prevent ANY possible forced page reloads.
    }
    return Promise.reject(error);
  },
);

export default apiClient;
