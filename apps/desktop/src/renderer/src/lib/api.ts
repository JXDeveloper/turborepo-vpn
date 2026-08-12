import { genKeypair } from '@my-vpn/crypto-utils'

export interface Peer {
  id: string
  publicKey: string
  allocatedIp: string
  status: 'active' | 'revoked'
  createdAt: string
}

export interface TunnelStatus {
  status: 'active' | 'inactive'
  activePeers: number
  endpoint: string
  wanInterface: string
  serverConfigPath: string
}

export interface CreatedPeer {
  peer: Peer
  endpoint: string
  clientConfig: string
}

export class WebApiError extends Error {
  readonly status: number
  readonly path: string

  constructor(message: string, status: number, path: string) {
    super(message)
    this.name = 'WebApiError'
    this.status = status
    this.path = path
  }
}

export type RequestPeerConfigOptions = {
  allowedIps?: string[]
}

export type WebApiClient = ReturnType<typeof createWebApiClient>

type GetToken = () => Promise<string | null | undefined>

function trimTrailingSlash(value: string): string {
  return value.replace(/\/$/, '')
}

export function resolveWebApiBaseUrl(): string {
  const explicitApiUrl = import.meta.env.VITE_WEB_API_URL?.trim()
  if (explicitApiUrl) {
    return trimTrailingSlash(explicitApiUrl)
  }

  const explicitWebUrl = import.meta.env.VITE_WEB_APP_URL?.trim()
  if (explicitWebUrl) {
    return `${trimTrailingSlash(explicitWebUrl)}/api`
  }

  if (typeof window !== 'undefined' && /^https?:\/\//.test(window.location.origin)) {
    return `${trimTrailingSlash(window.location.origin)}/api`
  }

  return ''
}

async function readErrorMessage(response: Response): Promise<string> {
  const fallback = `Request failed with status ${response.status}`

  try {
    const payload = (await response.json()) as {
      message?: unknown
      error?: unknown
      detail?: unknown
    } | null
    if (!payload || typeof payload !== 'object') {
      return fallback
    }

    const candidate = payload.message ?? payload.error ?? payload.detail
    if (typeof candidate === 'string' && candidate.trim().length > 0) {
      return candidate
    }
  } catch {
    return fallback
  }

  return fallback
}

function createRequestHeaders(token: string | null | undefined, hasBody: boolean): HeadersInit {
  const headers: Record<string, string> = {
    Accept: 'application/json'
  }

  if (hasBody) {
    headers['Content-Type'] = 'application/json'
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  return headers
}

export function createWebApiClient(options: { baseUrl?: string; getToken: GetToken }) {
  const baseUrl = trimTrailingSlash(options.baseUrl ?? resolveWebApiBaseUrl())

  if (!baseUrl) {
    throw new Error(
      'Set VITE_WEB_API_URL or VITE_WEB_APP_URL so the desktop app can reach the web API.'
    )
  }

  const request = async <T>(path: string, init: RequestInit = {}): Promise<T> => {
    const token = await options.getToken()
    const response = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers: createRequestHeaders(token, init.body != null),
      cache: 'no-store'
    })

    if (!response.ok) {
      throw new WebApiError(await readErrorMessage(response), response.status, path)
    }

    if (response.status === 204) {
      return undefined as T
    }

    return (await response.json()) as T
  }

  const requestWithBody = async <T>(
    path: string,
    method: 'POST' | 'DELETE' | 'PUT' | 'PATCH',
    body?: Record<string, unknown>
  ): Promise<T> =>
    request<T>(path, {
      method,
      body: body ? JSON.stringify(body) : undefined
    })

  return {
    baseUrl,

    request<T>(path: string): Promise<T> {
      return request<T>(path)
    },

    getTunnelStatus(): Promise<TunnelStatus> {
      return request<TunnelStatus>('/tunnel/status')
    },

    async getPeers(): Promise<Peer[]> {
      const result = await request<{ peers: Peer[] }>('/peers')
      return result.peers
    },

    async getPeer(peerId: string): Promise<Peer> {
      const result = await request<{ peer: Peer }>(`/peers/${encodeURIComponent(peerId)}`)
      return result.peer
    },

    async requestPeerConfig(options: RequestPeerConfigOptions = {}): Promise<CreatedPeer> {
      const { publicKey, privateKey } = await genKeypair()
      const result = await request<CreatedPeer>('/peers', {
        method: 'POST',
        body: JSON.stringify({
          publicKey,
          allowedIps: options.allowedIps ?? []
        })
      })

      return {
        ...result,
        clientConfig: result.clientConfig.replace('<CLIENT_PRIVATE_KEY>', privateKey)
      }
    },

    async revokePeer(peerId: string): Promise<Peer> {
      const result = await requestWithBody<{ peer: Peer }>(
        `/peers/${encodeURIComponent(peerId)}`,
        'DELETE',
        {
          peerId
        }
      )
      return result.peer
    },

    setTunnelState(state: 'up' | 'down'): Promise<{ message: string; status: string }> {
      return requestWithBody<{ message: string; status: string }>(`/tunnel/${state}`, 'POST')
    }
  }
}
