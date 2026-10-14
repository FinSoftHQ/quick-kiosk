/**
 * Strip trailing slashes from an API base URL so joining a path that starts
 * with "/" never produces a double slash (e.g. `https://host//api/v-latest/...`).
 */
export function normalizeBaseUrl(base: string | undefined | null): string {
  return (base ?? '').replace(/\/+$/, '')
}

/**
 * Join an API base URL and a path with exactly one slash between them,
 * regardless of trailing/leading slashes on either side.
 */
export function joinApiUrl(base: string | undefined | null, path: string): string {
  return `${normalizeBaseUrl(base)}/${String(path).replace(/^\/+/, '')}`
}
