import { ElectronAPI } from '@electron-toolkit/preload'
import { Vpn } from './index'

declare global {
  interface Window {
    electron: ElectronAPI
    api: unknown
    vpn: Vpn
  }
}
