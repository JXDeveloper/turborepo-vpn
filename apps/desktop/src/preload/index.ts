import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import { exposeClerkBridge } from '@clerk/electron/preload'

exposeClerkBridge({ passkeys: true })

// Custom APIs for renderer
const api = {}

const vpn = {
  connect: (region: string) => {
    ipcRenderer.invoke('vpn:connect', region)
  },
  desconnect: () => {
    ipcRenderer.invoke('vpn:disconnect')
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
