import { VpnConfig } from './vpnConfig'
import { type Keypair, genKeypair } from '@my-vpn/crypto-utils'
import { WgConfig } from '@shurahbil/wireguard-tools-2'
import path from 'path'
import fs from 'fs'

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
const CLIENT_CONFIG_DIR: string = path.join(process.cwd(), 'configs')
const CLIENT_CONFIG_PATH: string = path.join(CLIENT_CONFIG_DIR, 'wg0.conf')

export const linuxVpnService: VpnService = {
  async createConfigs() {
    const wgConfig = new WgConfig({
      filePath: CLIENT_CONFIG_PATH,
      wgInterface: {
        postUp: [],
        postDown: []
      }
    })

    try {
      await wgConfig.generateKeys()
    } catch {
      const pair = await genKeypair()
      wgConfig.wgInterface.privateKey = pair.privateKey
      wgConfig.publicKey = pair.publicKey
    }
    await wgConfig.writeToFile()
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

export const devVpnService: VpnService = {
  async createConfigs() {
    const pair = await genKeypair()
  },
  async createConfigsByServerConfigs(serverConfigs) {
    console.log('will connect client with these configs', serverConfigs)
  },
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
