import { app, BrowserWindow, ipcMain, net, protocol, session } from 'electron'
// import { shell, ipcMain} from 'electron'
import { createClerkBridge } from '@clerk/electron'
import { storage } from '@clerk/electron/storage'
import { pathToFileURL } from 'url'
import path, { join } from 'path'
import { /*electronApp, optimizer,*/ is } from '@electron-toolkit/utils'
import { WgConfig } from '@shurahbil/wireguard-tools-2'
import { genKeypair } from '@my-vpn/crypto-utils'
import fs from 'fs'
// import icon from '../../resources/icon.png?asset'

const clerk = createClerkBridge({
  storage: storage({
    // unencryptedFallback: !app.isPackaged //! only for dev env
  }),
  renderer: {
    host: 'renderer',
    scheme: 'my-vpn'
  },
  passkeys: true
})

// protocol.registerSchemesAsPrivileged([
//   {
//     scheme: 'my-vpn',
//     privileges: {
//       standard: true,
//       secure: true,
//       supportFetchAPI: true,
//       corsEnabled: true
//     }
//   }
// ])

const fapiHost = 'nearby-jawfish-86.clerk.accounts.dev'
type CreatePeerResponse = {
  message: string
  peer: {
    id: string
    publicKey: string
    allocatedIp: string
    status: string
    createdAt: string
  }
  endpoint: string
  serverPublicKey: string
  allowedIps: string[]
  clientConfig: string
}

if (clerk.isPrimaryInstance) {
  app.whenReady().then(async () => {
    const CLIENT_CONFIG_DIR = path.join(process.cwd(), 'configs')
    const CLIENT_CONFIG_PATH = path.join(CLIENT_CONFIG_DIR, 'wg0.conf')

    if (!fs.existsSync(CLIENT_CONFIG_DIR)) {
      fs.mkdirSync(CLIENT_CONFIG_DIR)
    }

    // ! vpn connect function
    ipcMain.handle('vpn:connect', async (_, { regionId, token }) => {
      const wgConfig = new WgConfig({
        filePath: CLIENT_CONFIG_PATH
      })

      try {
        await wgConfig.generateKeys()
        console.log('keys generated')
      } catch {
        // todo yet to be tested
        console.log('key generation failed //fallback')
        const pair = await genKeypair()
        wgConfig.wgInterface.privateKey = pair.privateKey
        wgConfig.publicKey = pair.publicKey
      }
      console.log('wg config created here it is:', wgConfig)
      await wgConfig.writeToFile()

      // todo: make request to web api for connection
      try {
        const response = await fetch('http:localhost:3000/api/vpn/peer/create', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            publicKey: wgConfig.publicKey
          })
        })
        if (!response.ok) {
          throw new Error(`Peer provisioning failed: ${response.status}`)
        }
        const body = await response.json()
        const createPeerResponse: CreatePeerResponse = body.data
        console.log('createPeerResponse:', createPeerResponse)
        console.log('here is allowedIps ')

        // todo create peer
        wgConfig.wgInterface.address = [createPeerResponse.allowedIps[0]]
        console.log('---------------------------------------- get to this line')
        wgConfig.wgInterface.dns = ['10.10.1.1']

        wgConfig.addPeer({
          allowedIps: ['0.0.0.0/0', '::/0'],
          publicKey: createPeerResponse.serverPublicKey,
          endpoint: createPeerResponse.endpoint
        })

        await wgConfig.writeToFile()
      } catch (error) {
        console.error('Peer provisioning failed', error)
        throw error
      }
      console.log('vpn connect request came in and region requested is:', regionId)
    })
    // // vpn connect function ending
    // ! vpn connect function ending

    ipcMain.handle('vpn:disconnect', async () => {
      console.log('vpn disconnect')
    })
    ipcMain.handle('ping', () => {
      console.log('pong')
    })
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
      // console.log(
      //   '[CSP]',
      //   details.resourceType,
      //   details.url,
      //   details.responseHeaders!['content-security-policy']
      // )

      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': [
            [
              "default-src 'self'",
              `script-src 'self' 'unsafe-inline' https://${fapiHost} https://challenges.cloudflare.com`,
              `connect-src 'self' https://${fapiHost} https://clerk-telemetry.com https://*.sentry.io https://*.clerk.com ws://localhost:5173`,
              "img-src 'self' https://img.clerk.com data:",
              "style-src 'self' 'unsafe-inline'",
              "worker-src 'self' blob:",
              "frame-src 'self' https://challenges.cloudflare.com",
              "form-action 'self'"
            ].join('; ')
          ]
        }
      })
    })
    protocol.handle('my-vpn', (request) => {
      const url = new URL(request.url)
      const file = url.pathname === '/' ? 'index.html' : url.pathname

      return net.fetch(pathToFileURL(join(__dirname, '../renderer', file)).toString())
    })

    const win = new BrowserWindow({
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        sandbox: false
      }
    })

    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
      win.loadURL(process.env['ELECTRON_RENDERER_URL'])
    } else {
      win.loadURL('my-vpn://renderer/')
    }
  })
}

// function createWindow(): void {
//   // Create the browser window.
//   const mainWindow = new BrowserWindow({
//     width: 900,
//     height: 670,
//     show: false,
//     autoHideMenuBar: true,
//     ...(process.platform === 'linux' ? { icon } : {}),
//     webPreferences: {
//       preload: join(__dirname, '../preload/index.js'),
//       sandbox: false
//     }
//   })

//   mainWindow.on('ready-to-show', () => {
//     mainWindow.show()
//   })

//   mainWindow.webContents.setWindowOpenHandler((details) => {
//     shell.openExternal(details.url)
//     return { action: 'deny' }
//   })

//   // HMR for renderer base on electron-vite cli.
//   // Load the remote URL for development or the local html file for production.
//   if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
//     console.log('this ran', process.env['ELECTRON_RENDERER_URL'])
//     mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
//   } else {
//     console.log('now this ran now that')
//     mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
//   }
// }

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
// app.whenReady().then(() => {
//   // Set app user model id for windows
//   electronApp.setAppUserModelId('com.electron')

//   // Default open or close DevTools by F12 in development
//   // and ignore CommandOrControl + R in production.
//   // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
//   app.on('browser-window-created', (_, window) => {
//     optimizer.watchWindowShortcuts(window)
//   })

//   // IPC test
//   ipcMain.on('ping', () => console.log('pong'))

//   createWindow()

//   app.on('activate', function () {
//     // On macOS it's common to re-create a window in the app when the
//     // dock icon is clicked and there are no other windows open.
//     if (BrowserWindow.getAllWindows().length === 0) createWindow()
//   })

//   if (clerk.isPrimaryInstance) {
//     const win = new BrowserWindow({
//       webPreferences: {
//         preload: join(__dirname, '../preload/index.js')
//       }
//     })

//     if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
//       win.loadURL(process.env.ELECTRON_RENDERER_URL)
//     } else {
//       protocol.handle('my-vpn', (request) => {
//         const url = new URL(request.url)
//         const file = url.pathname === '/' ? 'index.html' : url.pathname
//         return net.fetch(pathToFileURL(join(__dirname, '../renderer', file)).toString())
//       })
//       win.loadURL('my-vpn://renderer/')
//     }
//   }
// })

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('second-instance', (_event, commandLine) => {
  console.log('[SECOND INSTANCE]')
  console.log(commandLine)
})

console.log('uid:', process.getuid?.())
console.log('DBUS:', process.env.DBUS_SESSION_BUS_ADDRESS)
console.log('XDG_RUNTIME:', process.env.XDG_RUNTIME_DIR)

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
