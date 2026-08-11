import { VpnConfig } from './vpnConfig'

export interface VpnService {
  connect(config: VpnConfig): Promise<void>
  disconnect(): Promise<void>
  getStatus(): Promise<void>
}

export const devVpnService: VpnService = {
  async connect(config) {
    console.log('will connect client with these configs', config)
  },

  async disconnect() {
    console.log('will disconnect client')
  },
  async getStatus() {
    console.log('will get status')
  }
}
