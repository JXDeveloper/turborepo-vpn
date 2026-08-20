use zbus::Connection;
use zbus::connection::Builder;
use zbus::fdo::DBusProxy;
use zbus::fdo::Result;
use zbus::interface;
use zbus::message::Header;
use zbus::proxy;
use zbus::zvariant::Fd;
use zbus::zvariant::OwnedValue;
use zbus::zvariant::Value;

use std::collections::HashMap;
use std::process::exit;

struct VpnService;

#[interface(name = "com.mycompany.Vpn")]
impl VpnService {
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

        let sender_name = sender.to_owned();
        let dbus = DBusProxy::new(connection).await?;

        let credentials = dbus.get_connection_credentials(sender.clone()).await?;
        let name = Value::from(sender);

        let uid = match credentials.unix_user_id() {
            Some(val) => val,
            None => exit(0),
        };
        let pfd = match credentials.process_fd() {
            Some(val) => val,
            None => exit(0),
        };
        let pidfd_value = OwnedValue::try_from(Fd::from(pfd))
            .map_err(|e| zbus::fdo::Error::Failed(e.to_string()))?;

        let name =
            OwnedValue::try_from(name).map_err(|e| zbus::fdo::Error::Failed(e.to_string()))?;

        let mut subject_details: HashMap<String, OwnedValue> = HashMap::new();

        subject_details.insert("name".to_string(), name);
        // subject_details.insert("pidfd".to_string(), pidfd_value);

        let subject = ("system-bus-name".to_string(), subject_details);
        let action_id = "com.mycompany.vpn.connect".to_string();
        let details: HashMap<String, String> = HashMap::new();
        let flags = 0;
        let cancellation_id = "";

        let polkit = polkitProxyProxy::new(connection).await?;

        let result = polkit
            .check_authorization(subject, action_id, details, flags, cancellation_id)
            .await?;

        println!("CheckAuthorization result: {:?}", result);

        // Ok(());
        // println!("uid: {:?}", uid);
        // println!("pfd: {:?}", pfd);
        // println!("subject_details: {:?}", subject_details);

        println!("😈process_id: {:?}", uid);
        println!("😈unix_user_id: {:?}", credentials.unix_user_id());
        println!("😈unix_group_ids: {:?}", credentials.unix_group_ids());
        println!("😈process_fd: {:?}", credentials.process_fd());

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
