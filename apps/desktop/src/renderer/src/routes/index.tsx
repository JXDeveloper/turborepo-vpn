import { Show } from '@clerk/electron/react'
import { createFileRoute } from '@tanstack/react-router'
// import { MouseEvent } from 'react'

export const Route = createFileRoute('/')({
  component: Index
})

function Index() {
  async function handleConnect() {
    await window.vpn.disconnect()
    await window.vpn.connect('region')
  }
  return (
    <div className="p-2">
      <h3>Welcome Home!</h3>
      <Show when="signed-in">
        <button onClick={handleConnect}>Connect to Vpn</button>
      </Show>
    </div>
  )
}
