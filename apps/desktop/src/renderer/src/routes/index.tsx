import { getToken, Show } from '@clerk/electron/react'
import { createFileRoute } from '@tanstack/react-router'
// import { MouseEvent } from 'react'

export const Route = createFileRoute('/')({
  component: Index
})

function Index() {
  async function handleConnect() {
    // const regionId = 'us-east'
    try {
      const token = await getToken()
      if (token == null) throw Error('Not Signed In')
      // todo:  make request to control panel for creating peer
      console.log('gonna make a request')
      let response = await fetch('http://localhost:3000/api/vpn/peer/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          publicKey: 'blah blah blah'
        })
      })
      let data = await response.json()

      console.log(data)

      // todo: get configs and pass them to underlaying native agent

      // todo: call the connect function in the underlaying native agent
      // await window.vpn.connect({ regionId })
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
