use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::os::unix::fs::PermissionsExt;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};
use tokio::sync::Mutex;
use zbus::connection::Builder;
use zbus::fdo::Result;
use zbus::interface;
use zbus::message::Header;
use zbus::proxy;
use zbus::zvariant::{OwnedValue, Value};

const CONFIG_BASE_DIR: &str = "/etc/mycompany-vpn/configs";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActiveTunnel {
    pub region: String,
    pub config_path: String,
    pub interface: String,
    pub endpoint: String,
    pub connected_at: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VpnStatus {
    pub status: String, // "connected", "disconnected", "error"
    pub region: Option<String>,
    pub interface: Option<String>,
    pub endpoint: Option<String>,
    pub connected_at: Option<u64>,
    pub bytes_rx: Option<u64>,
    pub bytes_tx: Option<u64>,
    pub latest_handshake: Option<u64>,
    pub message: Option<String>,
}

#[derive(Clone)]
pub struct VpnService {
    active_tunnel: Arc<Mutex<Option<ActiveTunnel>>>,
}

impl VpnService {
    pub fn new() -> Self {
        Self {
            active_tunnel: Arc::new(Mutex::new(None)),
        }
    }

    fn sanitize_region(region: &str) -> std::result::Result<String, zbus::fdo::Error> {
        let cleaned = region.trim();
        if cleaned.is_empty() {
            return Err(zbus::fdo::Error::InvalidArgs("Region name cannot be empty".into()));
        }
        if !cleaned.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_') {
            return Err(zbus::fdo::Error::InvalidArgs(
                "Invalid characters in region name (only alphanumeric, '-', '_' allowed)".into(),
            ));
        }
        Ok(cleaned.to_string())
    }

    async fn verify_polkit(
        &self,
        action_id: &str,
        header: &Header<'_>,
        connection: &zbus::Connection,
    ) -> Result<()> {
        let sender = header
            .sender()
            .ok_or_else(|| zbus::fdo::Error::Failed("No message sender found".into()))?
            .to_owned();

        let bus_name = zbus::names::BusName::from(sender);
        let name_value = Value::from(bus_name);
        let owned_name = OwnedValue::try_from(name_value)
            .map_err(|e| zbus::fdo::Error::Failed(format!("Failed to serialize sender: {e}")))?;

        let mut subject_details: HashMap<String, OwnedValue> = HashMap::new();
        subject_details.insert("name".to_string(), owned_name);

        let subject = ("system-bus-name".to_string(), subject_details);
        let details: HashMap<String, String> = HashMap::new();
        let flags = 1u32; // AllowUserInteraction
        let cancellation_id = "";

        let polkit = PolkitProxy::new(connection).await?;
        let (authorized, _challenge, _details) = polkit
            .check_authorization(subject, action_id.to_string(), details, flags, cancellation_id)
            .await?;

        if !authorized {
            return Err(zbus::fdo::Error::Failed(format!(
                "Polkit authorization denied for action: {action_id}"
            )));
        }

        Ok(())
    }
}

#[interface(name = "com.mycompany.Vpn")]
impl VpnService {
    async fn store_config(
        &self,
        region: String,
        private_key: String,
        server_public_key: String,
        endpoint: String,
        dns: Vec<String>,
        allowed_ips: Vec<String>,
    ) -> Result<()> {
        let safe_region = Self::sanitize_region(&region)?;
        let dir = Path::new(CONFIG_BASE_DIR);

        fs::create_dir_all(dir).map_err(|e| {
            zbus::fdo::Error::Failed(format!("Failed to create config dir {}: {e}", dir.display()))
        })?;

        let dns_line = if dns.is_empty() {
            String::new()
        } else {
            format!("DNS = {}\n", dns.join(", "))
        };

        let allowed_ips_str = if allowed_ips.is_empty() {
            "0.0.0.0/0, ::/0".to_string()
        } else {
            allowed_ips.join(", ")
        };

        let config = format!(
            "[Interface]\n\
             PrivateKey = {private_key}\n\
             {dns_line}\n\
             [Peer]\n\
             PublicKey = {server_public_key}\n\
             Endpoint = {endpoint}\n\
             AllowedIPs = {allowed_ips_str}\n\
             PersistentKeepalive = 25\n"
        );

        let path = dir.join(format!("{safe_region}.conf"));

        fs::write(&path, config).map_err(|e| {
            zbus::fdo::Error::Failed(format!("Failed to write config file {}: {e}", path.display()))
        })?;

        // Permissions 0600 (owner read/write only)
        fs::set_permissions(&path, fs::Permissions::from_mode(0o600)).map_err(|e| {
            zbus::fdo::Error::Failed(format!("Failed to set permissions on {}: {e}", path.display()))
        })?;

        println!("Stored WireGuard config for region '{}' at {}", safe_region, path.display());
        Ok(())
    }

    async fn connect(
        &self,
        region: String,
        #[zbus(header)] header: Header<'_>,
        #[zbus(connection)] connection: &zbus::Connection,
    ) -> Result<()> {
        self.verify_polkit("com.mycompany.vpn.connect", &header, connection)
            .await?;

        let safe_region = Self::sanitize_region(&region)?;
        let config_path: PathBuf = Path::new(CONFIG_BASE_DIR).join(format!("{safe_region}.conf"));

        if !config_path.exists() {
            return Err(zbus::fdo::Error::Failed(format!(
                "Config file does not exist: {}",
                config_path.display()
            )));
        }

        let mut lock = self.active_tunnel.lock().await;

        // If another tunnel is active, bring it down first
        if let Some(active) = lock.as_ref() {
            println!("Disconnecting previous active tunnel '{}' before connecting to '{}'", active.region, safe_region);
            let _ = Command::new("wg-quick")
                .args(["down", &active.config_path])
                .status();
        }

        println!("Connecting to WireGuard region '{}' via {}", safe_region, config_path.display());
        let output = Command::new("wg-quick")
            .args(["up", config_path.to_str().unwrap()])
            .output()
            .map_err(|e| zbus::fdo::Error::Failed(format!("Failed to execute wg-quick: {e}")))?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            eprintln!("wg-quick up failed: {stderr}");
            return Err(zbus::fdo::Error::Failed(format!(
                "wg-quick up failed with exit code {:?}: {stderr}",
                output.status.code()
            )));
        }

        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();

        *lock = Some(ActiveTunnel {
            region: safe_region.clone(),
            config_path: config_path.to_string_lossy().to_string(),
            interface: safe_region.clone(),
            endpoint: String::new(),
            connected_at: now,
        });

        println!("Successfully connected to region '{}'", safe_region);
        Ok(())
    }

    async fn disconnect(
        &self,
        #[zbus(header)] header: Header<'_>,
        #[zbus(connection)] connection: &zbus::Connection,
    ) -> Result<()> {
        self.verify_polkit("com.mycompany.vpn.disconnect", &header, connection)
            .await?;

        let mut lock = self.active_tunnel.lock().await;

        if let Some(active) = lock.take() {
            println!("Disconnecting WireGuard tunnel '{}'...", active.region);
            let output = Command::new("wg-quick")
                .args(["down", &active.config_path])
                .output()
                .map_err(|e| zbus::fdo::Error::Failed(format!("Failed to execute wg-quick down: {e}")))?;

            if !output.status.success() {
                let stderr = String::from_utf8_lossy(&output.stderr);
                eprintln!("wg-quick down warning/error: {stderr}");
            }
            println!("Disconnected WireGuard tunnel '{}'", active.region);
        } else {
            println!("No active tunnel in memory to disconnect.");
        }

        Ok(())
    }

    async fn get_status(&self) -> Result<String> {
        let lock = self.active_tunnel.lock().await;

        let status = match lock.as_ref() {
            Some(active) => {
                let mut bytes_rx = None;
                let mut bytes_tx = None;
                let mut latest_handshake = None;

                // Try to read transfer stats from wg command if possible
                if let Ok(output) = Command::new("wg")
                    .args(["show", &active.interface, "transfer"])
                    .output()
                {
                    if output.status.success() {
                        let text = String::from_utf8_lossy(&output.stdout);
                        // Format: <peer>\t<rx>\t<tx>
                        let parts: Vec<&str> = text.split_whitespace().collect();
                        if parts.len() >= 3 {
                            bytes_rx = parts[1].parse::<u64>().ok();
                            bytes_tx = parts[2].parse::<u64>().ok();
                        }
                    }
                }

                if let Ok(output) = Command::new("wg")
                    .args(["show", &active.interface, "latest-handshakes"])
                    .output()
                {
                    if output.status.success() {
                        let text = String::from_utf8_lossy(&output.stdout);
                        let parts: Vec<&str> = text.split_whitespace().collect();
                        if parts.len() >= 2 {
                            latest_handshake = parts[1].parse::<u64>().ok();
                        }
                    }
                }

                VpnStatus {
                    status: "connected".to_string(),
                    region: Some(active.region.clone()),
                    interface: Some(active.interface.clone()),
                    endpoint: if active.endpoint.is_empty() { None } else { Some(active.endpoint.clone()) },
                    connected_at: Some(active.connected_at),
                    bytes_rx,
                    bytes_tx,
                    latest_handshake,
                    message: None,
                }
            }
            None => VpnStatus {
                status: "disconnected".to_string(),
                region: None,
                interface: None,
                endpoint: None,
                connected_at: None,
                bytes_rx: None,
                bytes_tx: None,
                latest_handshake: None,
                message: None,
            },
        };

        serde_json::to_string(&status)
            .map_err(|e| zbus::fdo::Error::Failed(format!("Failed to serialize status: {e}")))
    }
}

#[proxy(
    interface = "org.freedesktop.PolicyKit1.Authority",
    default_service = "org.freedesktop.PolicyKit1",
    default_path = "/org/freedesktop/PolicyKit1/Authority"
)]
trait Polkit {
    fn check_authorization(
        &self,
        subject: (String, HashMap<String, OwnedValue>),
        action_id: String,
        details: HashMap<String, String>,
        flags: u32,
        cancellation_id: &str,
    ) -> zbus::Result<(bool, bool, HashMap<String, String>)>;
}

#[tokio::main]
async fn main() -> Result<()> {
    let vpn_service = VpnService::new();

    let _connection = Builder::system()?
        .name("com.mycompany.Vpn")?
        .serve_at("/com/mycompany/Vpn", vpn_service)?
        .build()
        .await?;

    println!("MyCompany VPN native agent running on system D-Bus (com.mycompany.Vpn)...");

    std::future::pending::<()>().await;

    Ok(())
}

