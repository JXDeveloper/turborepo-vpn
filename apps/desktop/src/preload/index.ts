import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import { exposeClerkBridge } from '@clerk/electron/preload'

exposeClerkBridge({ passkeys: true })

// Custom APIs for renderer
const api = {}

export interface Vpn {
  connect(regoin: string): Promise<void>
  disconnect(): Promise<void>
}

export const vpn: Vpn = {
  async connect(region: string) {
    return ipcRenderer.invoke('vpn:connect', region)
  },
  async disconnect() {
    return ipcRenderer.invoke('vpn:disconnect')
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
