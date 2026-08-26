const baseUrl = process.env.EXPO_PUBLIC_API_URL ?? '';

export function apiUrl(path: string) {
  return `${baseUrl.replace(/\/$/, '')}${path}`;
}
