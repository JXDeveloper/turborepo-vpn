import { getToken, Show } from '@clerk/electron/react'
import { createFileRoute } from '@tanstack/react-router'
// import { MouseEvent } from 'react'

export const Route = createFileRoute('/')({
  component: Index
})

function Index() {
  async function handleConnect() {
    const regionId = 'region'
    try {
      const token = await getToken()
      if (token == null) throw Error('Not Signed In')
      await window.vpn.connect({ regionId, token })
    } catch {
      // todo implement visual signal for user in app
      console.log('You may be not authored to do the request')
    }
    await window.vpn.disconnect()
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
