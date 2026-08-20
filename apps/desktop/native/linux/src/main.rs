use zbus::connection::Builder;

struct VpnService;

#[zbus::interface(name = "com.mycompany.Vpn")]
impl VpnService {
    fn connect(&self) {
        println!("Connect() called");
    }

    fn disconnect(&self) {
        println!("Disconnect() called");
    }
}

#[tokio::main]
async fn main() -> zbus::Result<()> {
    let _connection = Builder::system()?
        .name("com.mycompany.Vpn")?
        .serve_at("/com/mycompany/Vpn", VpnService)?
        .build()
        .await?;

    println!("VPN service running...");

    std::future::pending::<()>().await;

    Ok(())
}
