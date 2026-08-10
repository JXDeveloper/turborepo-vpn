import Versions from './components/Versions'
import electronLogo from './assets/electron.svg'
import { Show, /*SignUpButton,*/ UserButton, /*SignUp,*/ SignIn } from '@clerk/electron/react'

function App(): React.JSX.Element {
  // const ipcHandle = (): void => window.electron.ipcRenderer.send('ping')

  return (
    <div>
      <nav>
        <Show when="signed-out">
          <SignIn />
        </Show>
        <Show when="signed-in">
          <UserButton />
        </Show>
      </nav>
      <img alt="logo" className="logo" src={electronLogo} />
      <div className="creator">Powered by electron-vite</div>
      <div className="text">
        Build an Electron app wit <span className="react">React</span>
        &nbsp;and <span className="ts">TypeScript</span>
      </div>
      <p className="tip">
        Please try pressing <code>F12</code> to open the devTool
      </p>
      <div className="actions">
        <div className="action">
          <a href="https://electron-vite.org/" target="_blank" rel="noreferrer">
            Documentation
          </a>
        </div>
        <div className="action">
          {/* <a target="_blank" rel="noreferrer" onClick={window.myApi.ping}>
            Send IPC
          </a> */}
        </div>
      </div>
      <Versions></Versions>
    </div>
  )
}

export default App
