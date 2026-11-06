export interface ApiRequestOptions {
  timeoutMs?: number
  retries?: number
  backoffFactor?: number
  initialDelayMs?: number
  headers?: Record<string, string>
}

export class ApiError extends Error {
  public status?: number
  public code?: string
  public isRetryable: boolean
  public friendlyMessage: string

  constructor(message: string, options?: { status?: number; code?: string; isRetryable?: boolean; friendlyMessage?: string }) {
    super(message)
    this.name = 'ApiError'
    this.status = options?.status
    this.code = options?.code
    this.isRetryable = options?.isRetryable ?? false
    this.friendlyMessage = options?.friendlyMessage || message
  }
}

/**
 * Executes a network fetch request with timeout, exponential backoff retries, and user-friendly error handling.
 */
export async function resilientFetch<T = any>(
  url: string,
  init?: RequestInit,
  options: ApiRequestOptions = {}
): Promise<T> {
  const {
    timeoutMs = 8000,
    retries = 3,
    backoffFactor = 2,
    initialDelayMs = 800
  } = options

  let attempt = 0
  let currentDelay = initialDelayMs

  while (attempt <= retries) {
    attempt++
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)

    try {
      const response = await fetch(url, {
        ...init,
        signal: controller.signal
      })

      clearTimeout(timer)

      if (!response.ok) {
        const isServerErr = response.status >= 500 && response.status <= 599
        const isRateLimited = response.status === 429
        const isRetryable = (isServerErr || isRateLimited) && attempt <= retries

        let errorDetails = ''
        try {
          const body = await response.json()
          errorDetails = body.message || body.error || JSON.stringify(body)
        } catch {
          errorDetails = await response.text().catch(() => '')
        }

        const friendly = response.status === 404
          ? 'The requested resource was not found.'
          : response.status === 429
          ? 'Too many requests. Please wait a moment.'
          : response.status >= 500
          ? 'Server temporarily unavailable. Trying again...'
          : `Request failed (${response.status}): ${errorDetails || response.statusText}`

        if (isRetryable) {
          console.warn(`[ApiClient] Attempt ${attempt} failed (${response.status}). Retrying in ${currentDelay}ms...`)
          await new Promise(r => setTimeout(r, currentDelay))
          currentDelay *= backoffFactor
          continue
        }

        throw new ApiError(errorDetails || `HTTP ${response.status}`, {
          status: response.status,
          isRetryable,
          friendlyMessage: friendly
        })
      }

      const contentType = response.headers.get('content-type') || ''
      if (contentType.includes('application/json')) {
        return (await response.json()) as T
      }
      return (await response.text()) as unknown as T
    } catch (err: any) {
      clearTimeout(timer)

      const isAbort = err?.name === 'AbortError'
      const isNetworkErr = isAbort || err instanceof TypeError || err?.code === 'ECONNRESET' || err?.code === 'ETIMEDOUT'
      const canRetry = isNetworkErr && attempt <= retries

      if (canRetry) {
        console.warn(`[ApiClient] Attempt ${attempt} encountered network error (${err.message}). Retrying in ${currentDelay}ms...`)
        await new Promise(r => setTimeout(r, currentDelay))
        currentDelay *= backoffFactor
        continue
      }

      const friendly = isAbort
        ? 'Request timed out. Please check your internet connection and try again.'
        : isNetworkErr
        ? 'Unable to connect to service. Please check your network.'
        : err?.friendlyMessage || err?.message || 'An unexpected error occurred.'

      throw new ApiError(err?.message || 'Network request failed', {
        code: isAbort ? 'TIMEOUT' : 'NETWORK_ERROR',
        isRetryable: false,
        friendlyMessage: friendly
      })
    }
  }

  throw new ApiError('Maximum retry attempts exceeded.', {
    code: 'MAX_RETRIES',
    isRetryable: false,
    friendlyMessage: 'Service remains unreachable after multiple attempts. Please try again later.'
  })
}

/**
 * Safely executes an IPC or async action with friendly fallback error messages.
 */
export async function safeIpcCall<T>(
  action: () => Promise<T>,
  fallbackMessage = 'Action could not be completed.'
): Promise<{ data: T | null; error: string | null }> {
  try {
    const data = await action()
    return { data, error: null }
  } catch (err: any) {
    const errorMsg = err?.friendlyMessage || err?.message || fallbackMessage
    console.error('[IPC Error]', err)
    return { data: null, error: errorMsg }
  }
}

