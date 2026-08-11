import { VpnConfig } from './vpnConfig'
import { type Keypair, genKeypair } from '@my-vpn/crypto-utils'

type ServerConfigs = {
  endPointIp: string
  dns: string
  publicKey: string
}
export interface VpnService {
  createConfigs(): Promise<void>
  createConfigsByServerConfigs(serverConfigs: ServerConfigs): Promise<void>
  addServerPeer?(serverConfigs: ServerConfigs): Promise<void>
  connect(config: VpnConfig): Promise<void>
  disconnect(): Promise<void>
  getStatus(): Promise<void>
}

export const devVpnService: VpnService = {
  async createConfigs() {
    const pair = await genKeypair()
  },
  async createConfigsByServerConfigs(serverConfigs) {},
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
