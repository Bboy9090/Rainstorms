import axios from 'axios';
import Constants from 'expo-constants';

export const BASE_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL ||
  process.env.EXPO_PUBLIC_BACKEND_URL ||
  'http://localhost:8001';

export const api = axios.create({
  baseURL: `${BASE_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

/** Convert API error to a safe string for UI (handles object detail from 503 etc). */
export function formatApiError(err: any, fallback: string): string {
  const d = err?.response?.data?.detail;
  if (typeof d === 'string') return d;
  if (d && typeof d === 'object') return (d.hint || d.error || d.original) ?? fallback;
  return err?.message || fallback;
}

api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

/**
 * Build a full URL for a static resource path returned by the backend.
 * Handles both absolute URLs (http/https) and relative paths (/static/...).
 */
export function buildImageUrl(path: string): string {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  return `${BASE_URL}${path}`;
}
