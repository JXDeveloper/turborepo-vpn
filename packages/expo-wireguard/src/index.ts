// packages/expo-wireguard/src/index.ts
import { requireNativeModule, NativeModule } from "expo-modules-core";

export type StatusEvent = { status: string };

type ExpoWireguardEvents = {
  onStatusChange: (event: StatusEvent) => void;
};

type ExpoWireguardMethods = {
  generateKeyPair(): Promise<{ privateKey: string; publicKey: string }>;
  requestPermission(): Promise<boolean>;
  connect(configText: string): Promise<boolean>;
  disconnect(): Promise<boolean>;
  getStatus(): string;
};

type ExpoWireguardModuleType = NativeModule<ExpoWireguardEvents> &
  ExpoWireguardMethods;

const ExpoWireguard =
  requireNativeModule<ExpoWireguardModuleType>("ExpoWireguard");

export async function generateKeyPair() {
  return ExpoWireguard.generateKeyPair();
}

export async function requestPermission() {
  return ExpoWireguard.requestPermission();
}

export async function connect(configText: string) {
  return ExpoWireguard.connect(configText);
}

export async function disconnect() {
  return ExpoWireguard.disconnect();
}

export function getStatus() {
  return ExpoWireguard.getStatus();
}

export function addStatusListener(callback: (event: StatusEvent) => void) {
  return ExpoWireguard.addListener("onStatusChange", callback);
}
