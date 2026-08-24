export interface VpnConfig {
  region: string
  privateKey: string
  peerPublicKey: string
  peerEndpoint: string
  address: string
  allowedIps: string[]
  dns?: string[]
}

export interface VpnStatus {
  status: 'connected' | 'disconnected' | 'connecting' | 'error'
  region?: string
  interface?: string
  endpoint?: string
  connectedAt?: number
  bytesRx?: number
  bytesTx?: number
  latestHandshake?: number
  message?: string
}

export interface StoreConfigParams {
  region: string
  privateKey: string
  serverPublicKey: string
  endpoint: string
  dns?: string[]
  allowedIps?: string[]
}

export interface ConnectParams {
  regionId: string
  token?: string
}

