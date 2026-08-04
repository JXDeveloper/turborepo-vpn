import ExpoModulesCore

public class ExpoWireguardModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ExpoWireguard")

    Function("getTheme") { () -> String in
      "system"
    }
  }
}
