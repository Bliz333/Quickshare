const trimmedBaseUrl = String(process.env.EXPO_PUBLIC_API_BASE_URL || 'http://127.0.0.1:8080').replace(/\/$/, '');

export const QUICKSHARE_API_BASE_URL = trimmedBaseUrl;

export function buildApiUrl(path: string): string {
  return `${QUICKSHARE_API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}
