export class HttpError extends Error {
  status?: number
  constructor(message: string, status?: number) {
    super(message)
    this.name = 'HttpError'
    this.status = status
  }
}

export interface FetchOptions {
  timeoutMs?: number
  retries?: number
  signal?: AbortSignal
  headers?: Record<string, string>
}

const RETRY_DELAY_MS = 700

export async function fetchJson<T>(url: string, options: FetchOptions = {}): Promise<T> {
  const { timeoutMs = 20_000, retries = 1, signal, headers } = options

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController()
    const onAbort = () => controller.abort()
    signal?.addEventListener('abort', onAbort, { once: true })
    const timer = window.setTimeout(() => controller.abort(), timeoutMs)

    try {
      const response = await fetch(url, {
        headers: { Accept: 'application/json', ...headers },
        signal: controller.signal,
      })
      if (!response.ok) {
        // 4xx responses are deterministic; retrying wastes the API's quota.
        if (response.status >= 400 && response.status < 500) {
          throw new HttpError(`Request failed (${response.status})`, response.status)
        }
        throw new HttpError(`Request failed (${response.status})`, response.status)
      }
      return (await response.json()) as T
    } catch (error) {
      const isAbort = error instanceof DOMException && error.name === 'AbortError'
      const status = error instanceof HttpError ? error.status : undefined
      const canRetry = attempt < retries && !signal?.aborted && status !== 404 && status !== 400
      if (!canRetry) {
        if (isAbort && !signal?.aborted) throw new HttpError('The data service timed out.')
        throw error
      }
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS * (attempt + 1)))
    } finally {
      window.clearTimeout(timer)
      signal?.removeEventListener('abort', onAbort)
    }
  }

  throw new HttpError('Request failed after retries')
}

export async function fetchOk(url: string, timeoutMs = 12_000): Promise<boolean> {
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, { signal: controller.signal, cache: 'no-store' })
    return response.ok
  } catch {
    return false
  } finally {
    window.clearTimeout(timer)
  }
}
