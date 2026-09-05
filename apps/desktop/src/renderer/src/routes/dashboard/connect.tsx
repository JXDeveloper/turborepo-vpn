import { getToken, Show } from '@clerk/electron/react'
import { genKeypair } from '@my-vpn/crypto-utils'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/dashboard/connect')({
  component: Connect
})

function Connect() {
  async function handleConnect() {
    // const regionId = 'us-east'
    // TODO: regionId is currently hardcoded to 'us-east' for testing.
    // Yet to be fixed for automatic region selection.
    const regionId = 'us-east'
    try {
      const token = await getToken()
      if (token == null) throw Error('Not Signed In')
      // todo: 1. create private and public key
      // todo: 2. complete request to control panel for creating peer
      // 1. Create private and public key
      const keypair = await genKeypair()
      console.log(keypair)
      // 2. Complete request to control panel for creating peer
      console.log('gonna make a request')
      let response = await fetch('http://localhost:3000/api/vpn/peer/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          publicKey: keypair.publicKey
        })
      })
      const data = await response.json()
      const configs = data.configs
      console.log(data)
      // todo: 3. get configs and pass them to underlaying native agent
      // 3. Get configs and attach the generated private key
      // 4. Pass the configs to D-Bus service (via storeParams)
      const storeParams = {
        region: regionId,
        privateKey: keypair.privateKey,
        //! i think there is something bad here is hsould not be configs.allowedIps[0] rather it should be
        //! configs.allowedIps, i think server is not responding with what i want
        address: configs.allowedIps[0],
        serverPublicKey: configs.serverPublicKey,
        endpoint: configs.endpoint,
        dns: ['10.10.1.2'],
        allowedIps: ['0.0.0.0/0', '::/0']
      }
      console.log(storeParams)
      // todo: 4. call the connect function in the underlaying native agent
      // 5. Call the connect function in the underlying native agent
      await window.vpn.connect({
        regionId,
        storeParams
      })
    } catch (err) {
      // todo implement visual signal for user in app
      console.log('You may be not authored to do the request')
      console.error('Connection failed or unauthorized:', err)
    }
  }

  async function handleDisconnect() {
    window.vpn.disconnect()
  }
  return (
    <div>
      Connect
      <div className="p-2">
        <h3>Welcome Home!</h3>
        <Show when="signed-in">
          <button onClick={handleConnect}>Connect to Vpn</button>
          <button onClick={handleDisconnect}>Disconnect</button>
        </Show>
      </div>
    </div>
  )
}
