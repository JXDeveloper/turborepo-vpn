import { NativeModule, requireNativeModule } from "expo";

import { ExpoWireguardModuleEvents } from "./ExpoWireguard.types";

declare class ExpoWireguardModule extends NativeModule<ExpoWireguardModuleEvents> {
  getTheme(): string;
}

export default requireNativeModule<ExpoWireguardModule>("ExpoWireguard");
