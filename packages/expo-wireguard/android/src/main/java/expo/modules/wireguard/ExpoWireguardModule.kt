package expo.modules.wireguard

import android.content.Intent
import android.net.VpnService
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.Promise
import com.wireguard.android.backend.GoBackend
import com.wireguard.android.backend.Tunnel
import com.wireguard.config.Config
import com.wireguard.crypto.KeyPair

class SimpleTunnel(private val tunnelName: String) : Tunnel {
    var lastState: Tunnel.State = Tunnel.State.DOWN
    var onStateChanged: ((Tunnel.State) -> Unit)? = null

    override fun getName() = tunnelName

    override fun onStateChange(newState: Tunnel.State) {
        lastState = newState
        onStateChanged?.invoke(newState)
    }
}

class ExpoWireguardModule : Module() {
    private lateinit var backend: GoBackend
    private var tunnel: SimpleTunnel? = null

    override fun definition() = ModuleDefinition {
        Name("ExpoWireguard")

        Events("onStatusChange")

        OnCreate {
            backend = GoBackend(appContext.reactContext!!)
        }

        // Generate a fresh keypair — call this once on first launch, store the
        // private key securely (expo-secure-store), send the public key to your backend
        AsyncFunction("generateKeyPair") { promise: Promise ->
            try {
                val keyPair = KeyPair()
                promise.resolve(
                    mapOf(
                        "privateKey" to keyPair.privateKey.toBase64(),
                        "publicKey" to keyPair.publicKey.toBase64()
                    )
                )
            } catch (e: Exception) {
                promise.reject("KEYGEN_ERROR", e.message, e)
            }
        }

        // Ask the OS for VPN permission — must be called before connect()
        // Returns true if already granted, false if a system dialog needs to be shown
        AsyncFunction("requestPermission") { promise: Promise ->
            val activity = appContext.currentActivity
            if (activity == null) {
                promise.reject("NO_ACTIVITY", "No current activity", null)
                return@AsyncFunction
            }
            val intent = VpnService.prepare(activity)
            if (intent == null) {
                promise.resolve(true) // already granted
            } else {
                activity.startActivityForResult(intent, VPN_REQUEST_CODE)
                promise.resolve(false) // dialog shown, caller should re-check after user responds
            }
        }

        // configText is a standard WireGuard .conf-format string built from your backend's response
        AsyncFunction("connect") { configText: String, promise: Promise ->
            try {
                val config = Config.parse(configText.byteInputStream())
                val t = SimpleTunnel("wg0")
                t.onStateChanged = { state ->
                    sendEvent("onStatusChange", mapOf("status" to state.name.lowercase()))
                }
                tunnel = t
                backend.setState(t, Tunnel.State.UP, config)
                promise.resolve(true)
            } catch (e: Exception) {
                promise.reject("CONNECT_ERROR", e.message, e)
            }
        }

        AsyncFunction("disconnect") { promise: Promise ->
            try {
                val t = tunnel
                if (t != null) {
                    backend.setState(t, Tunnel.State.DOWN, null)
                }
                promise.resolve(true)
            } catch (e: Exception) {
                promise.reject("DISCONNECT_ERROR", e.message, e)
            }
        }

        Function("getStatus") {
            tunnel?.lastState?.name?.lowercase() ?: "down"
        }
    }

    companion object {
        const val VPN_REQUEST_CODE = 24601
    }
}
