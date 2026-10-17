// Supabase's recovery link lands as mobile://reset-password#access_token=…&type=recovery (or #error=…). The router
// ignores URL fragments, so the fragment is turned into query params the reset screen can read.
export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  if (!path.includes('reset-password')) return path;
  const hashAt = path.indexOf('#');
  const fragment = hashAt === -1 ? '' : path.slice(hashAt + 1);
  const queryAt = path.indexOf('?');
  const query = queryAt === -1 ? '' : path.slice(queryAt + 1, hashAt === -1 ? undefined : hashAt);
  const params = [query, fragment].filter(Boolean).join('&');
  return params ? `/reset-password?${params}` : '/reset-password';
}
