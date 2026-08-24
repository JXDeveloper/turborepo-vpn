import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import { exposeClerkBridge } from '@clerk/electron/preload'

exposeClerkBridge({ passkeys: true })

const api = {}

import type { StoreConfigParams, VpnStatus } from '../vpn/vpnConfig'

export type { StoreConfigParams, VpnStatus }

export interface ConnectParams {
  regionId: string
  storeParams?: StoreConfigParams
}

export interface Vpn {
  connect(params: ConnectParams): Promise<{ success: boolean }>
  disconnect(): Promise<{ success: boolean }>
  getStatus(): Promise<VpnStatus>
  storeConfig(params: StoreConfigParams): Promise<{ success: boolean }>
  checkService(): Promise<boolean>
}

export const vpn: Vpn = {
  async connect(params: ConnectParams) {
    return ipcRenderer.invoke('vpn:connect', params)
  },
  async disconnect() {
    return ipcRenderer.invoke('vpn:disconnect')
  },
  async getStatus() {
    return ipcRenderer.invoke('vpn:status')
  },
  async storeConfig(params: StoreConfigParams) {
    return ipcRenderer.invoke('vpn:storeConfig', params)
  },
  async checkService() {
    return ipcRenderer.invoke('vpn:checkService')
  }
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
    contextBridge.exposeInMainWorld('myApi', {
      ping: () => ipcRenderer.invoke('ping')
    })
    contextBridge.exposeInMainWorld('vpn', vpn)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
