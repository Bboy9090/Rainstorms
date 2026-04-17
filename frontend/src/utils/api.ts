import axios from 'axios';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

function resolveBaseUrl(): string {
  const configured =
    Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL ||
    process.env.EXPO_PUBLIC_BACKEND_URL ||
    '';

  if (Platform.OS !== 'web') {
    return configured;
  }

  if (!configured) return '';

  try {
    const configuredHostname = new URL(configured).hostname;
    const currentHostname = window.location.hostname;
    if (configuredHostname !== currentHostname) {
      return '';
    }
  } catch {
    return '';
  }

  return configured;
}

export const BASE_URL = resolveBaseUrl();

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
  if (d && typeof d === 'object') {
    const msg = d.hint || d.error;
    if (msg && typeof msg === 'string') return msg;
    if (d.original && typeof d.original === 'string') {
      if (d.original.toLowerCase().includes('quota') || d.original.includes('429'))
        return 'AI quota exceeded. Try again later or use a new API key at console.groq.com.';
      return d.original.slice(0, 120);
    }
    return fallback;
  }
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
 * - data: URIs — passed through unchanged (images stored in DB, Task #3)
 * - http/https URLs — passed through unchanged
 * - Legacy /static/illustrations|covers|characters paths — return '' so the
 *   UI shows an empty/regenerate state rather than a broken 404 request
 * - Other relative paths — prefixed with BASE_URL
 */
export function buildImageUrl(path: string): string {
  if (!path) return '';
  if (path.startsWith('data:') || path.startsWith('http')) return path;
  if (
    path.startsWith('/static/illustrations/') ||
    path.startsWith('/static/covers/') ||
    path.startsWith('/static/characters/')
  ) {
    return '';
  }
  return `${BASE_URL}${path}`;
}
