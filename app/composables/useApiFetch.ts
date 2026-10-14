import { joinApiUrl } from '~/utils/apiUrl'

export function useApiFetch() {
  return {
    get: <T>(path: string, options: Parameters<typeof $fetch>[1] = {}) =>
      $fetch<T>(joinApiUrl('', path), options),
    post: <T>(path: string, body: Record<string, unknown> | BodyInit | null | undefined, options: Parameters<typeof $fetch>[1] = {}) =>
      $fetch<T>(joinApiUrl('', path), { ...options, method: 'POST', body }),
    put: <T>(path: string, body: Record<string, unknown> | BodyInit | null | undefined, options: Parameters<typeof $fetch>[1] = {}) =>
      $fetch<T>(joinApiUrl('', path), { ...options, method: 'PUT', body }),
    delete: <T>(path: string, options: Parameters<typeof $fetch>[1] = {}) =>
      $fetch<T>(joinApiUrl('', path), { ...options, method: 'DELETE' })
  }
}
