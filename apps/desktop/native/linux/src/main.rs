use std::fs;
use std::os::unix::fs::PermissionsExt;
use std::path::Path;
use zbus::Connection;
use zbus::connection::Builder;
use zbus::fdo::Result;
use zbus::interface;
use zbus::message::Header;
use zbus::proxy;
use zbus::zvariant::OwnedValue;
use zbus::zvariant::Value;

use std::collections::HashMap;

struct VpnService;

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
        let dir = Path::new("/etc/mycompany-vpn/configs");

        // Create directory if it doesn't exist.
        fs::create_dir_all(dir).map_err(|e| zbus::fdo::Error::Failed(e.to_string()))?;

        let config = format!(
            "[Interface]\n\
         PrivateKey = {private_key}\n\
         DNS = {}\n\
         \n\
         [Peer]\n\
         PublicKey = {server_public_key}\n\
         Endpoint = {endpoint}\n\
         AllowedIPs = {}\n",
            dns.join(", "),
            allowed_ips.join(", "),
        );

        let path = dir.join(format!("{region}.conf"));

        fs::write(&path, config).map_err(|e| zbus::fdo::Error::Failed(e.to_string()))?;

        // Private key → file readable only by owner.
        fs::set_permissions(&path, fs::Permissions::from_mode(0o600))
            .map_err(|e| zbus::fdo::Error::Failed(e.to_string()))?;

        println!("Stored WireGuard config: {}", path.display());

        Ok(())
    }

    async fn connect(
        &self,
        #[zbus(header)] header: Header<'_>,
        #[zbus(connection)] connection: &Connection,
    ) -> Result<()> {
        let sender = header
            .sender()
            .ok_or_else(|| zbus::fdo::Error::Failed("No sender".into()))?
            .to_owned();
        let sender = zbus::names::BusName::from(sender);

        let name = Value::from(sender);

        let name =
            OwnedValue::try_from(name).map_err(|e| zbus::fdo::Error::Failed(e.to_string()))?;

        let mut subject_details: HashMap<String, OwnedValue> = HashMap::new();

        subject_details.insert("name".to_string(), name);

        let subject = ("system-bus-name".to_string(), subject_details);
        let action_id = "com.mycompany.vpn.connect".to_string();
        let details: HashMap<String, String> = HashMap::new();
        let flags = 1u32;
        let cancellation_id = "";

        let polkit = polkitProxyProxy::new(connection).await?;

        let result = polkit
            .check_authorization(subject, action_id, details, flags, cancellation_id)
            .await?;

        println!("CheckAuthorization result: {:?}", result);

        Ok(())
    }

    fn disconnect(&self) {
        println!("Disconnect() called");
    }
}

#[proxy(
    interface = "org.freedesktop.PolicyKit1.Authority",
    default_service = "org.freedesktop.PolicyKit1",
    default_path = "/org/freedesktop/PolicyKit1/Authority"
)]
trait polkitProxy {
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
    let _connection = Builder::system()?
        .name("com.mycompany.Vpn")?
        .serve_at("/com/mycompany/Vpn", VpnService)?
        .build()
        .await?;

    println!("VPN service running...");

    std::future::pending::<()>().await;

    Ok(())
}
