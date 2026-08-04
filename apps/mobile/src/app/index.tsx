import {
  Text,
  View,
  StyleSheet,
  Button,
  ToastAndroid,
  NativeModules,
  Platform,
} from "react-native";
import * as SecureStore from "expo-secure-store";
import { useEffect, useState } from "react";
import crypto from "react-native-quick-crypto";
import {
  getStatus,
  generateKeyPair,
  requestPermission,
  connect,
  disconnect,
  addStatusListener,
} from "@my-vpn/expo-wireguard";
import { buildWireguardConfig } from "../vpn/buildConfig";

// const { WireGuardModule } = NativeModules;

async function generateSignature(
  secret: string,
  message: string,
): Promise<string> {
  return crypto.createHmac("sha-256", secret).update(message).digest("hex");
}

export default function Index() {
  const [status, setStatus] = useState("down");

  useEffect(() => {
    const sub = addStatusListener((event) => setStatus(event.status));
    return () => sub.remove();
  }, []);

  async function handleConnect() {
    let serverConfig: any;
    let privateKey = await SecureStore.getItemAsync("wg_private_key");
    let publicKey = await SecureStore.getItemAsync("wg_public_key");

    if (!privateKey || !publicKey) {
      const keys = await generateKeyPair();
      privateKey = keys.privateKey;
      publicKey = keys.publicKey;
      await SecureStore.setItemAsync("wg_private_key", privateKey);
      await SecureStore.setItemAsync("wg_public_key", publicKey);

      // send publicKey to your backend, get back server config
      serverConfig = await fetch("http://localhost:3000/api/vpn/register", {
        method: "POST",
        body: JSON.stringify({ publicKey }),
      }).then((r) => r.json());
    }

    const granted = await requestPermission();
    if (!granted) {
      // system dialog was shown — user needs to respond; handle result flow separately
      return;
    }

    const configText = buildWireguardConfig(privateKey, serverConfig);
    await connect(configText);
  }

  return (
    <View>
      <Text>Status: {status}</Text>
      <Button title="Connect" onPress={handleConnect} />
      <Button title="Disconnect" onPress={() => disconnect()} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
