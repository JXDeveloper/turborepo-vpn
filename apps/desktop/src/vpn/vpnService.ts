import dbus from 'dbus-next'
import { is } from '@electron-toolkit/utils'
import type { StoreConfigParams, VpnStatus } from './vpnConfig'

export interface VpnService {
  isAvailable(): Promise<boolean>
  storeConfig(params: StoreConfigParams): Promise<void>
  connect(region: string): Promise<void>
  disconnect(): Promise<void>
  getStatus(): Promise<VpnStatus>
}

const DBUS_SERVICE_NAME = 'com.mycompany.Vpn'
const DBUS_OBJECT_PATH = '/com/mycompany/Vpn'
const DBUS_INTERFACE_NAME = 'com.mycompany.Vpn'

class DbusVpnService implements VpnService {
  private bus: dbus.MessageBus | null = null
  private iface: dbus.ClientInterface | null = null

  private async getInterface(): Promise<dbus.ClientInterface> {
    if (this.iface) {
      return this.iface
    }

    if (!this.bus) {
      this.bus = dbus.systemBus()
    }

    const obj = await this.bus.getProxyObject(DBUS_SERVICE_NAME, DBUS_OBJECT_PATH)
    this.iface = obj.getInterface(DBUS_INTERFACE_NAME)
    return this.iface
  }

  async isAvailable(): Promise<boolean> {
    try {
      const iface = await this.getInterface()
      return !!iface
    } catch {
      this.iface = null
      return false
    }
  }

  async storeConfig(params: StoreConfigParams): Promise<void> {
    const iface = await this.getInterface()
    const dns = params.dns ?? ['1.1.1.1', '8.8.8.8']
    const allowedIps = params.allowedIps ?? ['0.0.0.0/0', '::/0']

    await iface.StoreConfig(
      params.region,
      params.privateKey,
      params.serverPublicKey,
      params.endpoint,
      dns,
      allowedIps
    )
  }

  async connect(region: string): Promise<void> {
    const iface = await this.getInterface()
    await iface.Connect(region)
  }

  async disconnect(): Promise<void> {
    const iface = await this.getInterface()
    await iface.Disconnect()
  }

  async getStatus(): Promise<VpnStatus> {
    const iface = await this.getInterface()
    const raw: string = await iface.GetStatus()
    try {
      const parsed = JSON.parse(raw) as {
        status: string
        region?: string
        interface?: string
        endpoint?: string
        connected_at?: number
        bytes_rx?: number
        bytes_tx?: number
        latest_handshake?: number
        message?: string
      }

      return {
        status: (parsed.status as VpnStatus['status']) || 'disconnected',
        region: parsed.region,
        interface: parsed.interface,
        endpoint: parsed.endpoint,
        connectedAt: parsed.connected_at,
        bytesRx: parsed.bytes_rx,
        bytesTx: parsed.bytes_tx,
        latestHandshake: parsed.latest_handshake,
        message: parsed.message
      }
    } catch (err) {
      return {
        status: 'error',
        message: `Failed to parse status: ${String(err)}`
      }
    }
  }
}

class DevMockVpnService implements VpnService {
  private status: VpnStatus = {
    status: 'disconnected'
  }
  private configs: Map<string, StoreConfigParams> = new Map()

  async isAvailable(): Promise<boolean> {
    return true
  }

  async storeConfig(params: StoreConfigParams): Promise<void> {
    console.log('[DevMockVpnService] Storing config for region:', params.region)
    this.configs.set(params.region, params)
  }

  async connect(region: string): Promise<void> {
    console.log('[DevMockVpnService] Connecting to region:', region)
    const config = this.configs.get(region)
    this.status = {
      status: 'connected',
      region,
      interface: `mock-${region}`,
      endpoint: config?.endpoint ?? '198.51.100.1:51820',
      connectedAt: Math.floor(Date.now() / 1000),
      bytesRx: 1048576,
      bytesTx: 524288,
      latestHandshake: Math.floor(Date.now() / 1000)
    }
  }

  async disconnect(): Promise<void> {
    console.log('[DevMockVpnService] Disconnecting...')
    this.status = {
      status: 'disconnected'
    }
  }

  async getStatus(): Promise<VpnStatus> {
    if (this.status.status === 'connected') {
      // Simulate ticking byte count
      this.status.bytesRx = (this.status.bytesRx ?? 0) + 4096
      this.status.bytesTx = (this.status.bytesTx ?? 0) + 2048
    }
    return { ...this.status }
  }
}

const dbusService = new DbusVpnService()
const mockService = new DevMockVpnService()

export async function getVpnService(): Promise<VpnService> {
  const isAvailable = await dbusService.isAvailable()

  if (isAvailable) {
    return dbusService
  }

  if (is.dev || process.platform !== 'linux') {
    console.warn('[VpnService] System D-Bus daemon not detected. Using DevMockVpnService fallback.')
    return mockService
  }

  // In Linux production, return real dbus service so errors are surfaced with instructions
  return dbusService
}
