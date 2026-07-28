"use client";

import { useState, useEffect } from "react";
import { QRCodeSVG } from "qrcode.react";
import makeReq, {
  toggleTunnelUpAction,
  toggleTunnelDownAction,
  getTunnelStatusAction,
} from "./action";

export default function Home() {
  const [loading, setLoading] = useState<boolean>(false);
  const [tunnelStatus, setTunnelStatus] = useState<any>(null);
  const [peerResult, setPeerResult] = useState<any>(null);
  const [notification, setNotification] = useState<string>("");

  const refreshStatus = async () => {
    try {
      const status = await getTunnelStatusAction();
      setTunnelStatus(status);
    } catch {
      // Ignore network errors on load
    }
  };

  useEffect(() => {
    refreshStatus();
  }, []);

  const handleCreatePeer = async () => {
    setLoading(true);
    setNotification("");
    try {
      const res = await makeReq();
      setPeerResult(res);
      setNotification(`Peer ${res.peer?.id} created & config saved!`);
      await refreshStatus();
    } catch (err: any) {
      setNotification(`Error: ${err.message || "Failed to create peer"}`);
    } finally {
      setLoading(false);
    }
  };

  const handleTunnelUp = async () => {
    setLoading(true);
    try {
      const res = await toggleTunnelUpAction();
      setNotification(res.message);
      await refreshStatus();
    } catch (err: any) {
      setNotification(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleTunnelDown = async () => {
    setLoading(true);
    try {
      const res = await toggleTunnelDownAction();
      setNotification(res.message);
      await refreshStatus();
    } catch (err: any) {
      setNotification(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={{ minHeight: "100vh", backgroundColor: "#0f172a", color: "#f8fafc", fontFamily: "sans-serif", padding: "2rem" }}>
      <div style={{ maxWidth: "900px", margin: "0 auto" }}>
        
        {/* Header */}
        <header style={{ borderBottom: "1px solid #334155", paddingBottom: "1.5rem", marginBottom: "2rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h1 style={{ fontSize: "1.875rem", fontWeight: "700", color: "#38bdf8", margin: 0 }}>
              WireGuard Exit Node Control Panel
            </h1>
            <p style={{ color: "#94a3b8", marginTop: "0.5rem", fontSize: "0.95rem" }}>
              Provision peers, generate mobile QR codes & control the WireGuard wg0 tunnel.
            </p>
          </div>
          <div style={{ textAlign: "right" }}>
            <span style={{
              display: "inline-block",
              padding: "0.35rem 0.85rem",
              borderRadius: "9999px",
              fontWeight: "600",
              fontSize: "0.875rem",
              backgroundColor: tunnelStatus?.status === "active" ? "#15803d" : "#334155",
              color: tunnelStatus?.status === "active" ? "#86efac" : "#cbd5e1"
            }}>
              STATUS: {tunnelStatus?.status?.toUpperCase() || "UNKNOWN"}
            </span>
          </div>
        </header>

        {/* Notification Banner */}
        {notification && (
          <div style={{ backgroundColor: "#1e293b", borderLeft: "4px solid #38bdf8", padding: "1rem", borderRadius: "0.375rem", marginBottom: "1.5rem" }}>
            <p style={{ margin: 0, fontSize: "0.9rem" }}>{notification}</p>
          </div>
        )}

        {/* Status & Control Section */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem", marginBottom: "2rem" }}>
          
          {/* Server Info Card */}
          <div style={{ backgroundColor: "#1e293b", padding: "1.5rem", borderRadius: "0.75rem", border: "1px solid #334155" }}>
            <h2 style={{ fontSize: "1.1rem", fontWeight: "600", color: "#f1f5f9", marginBottom: "1rem" }}>
              Server Tunnel Info
            </h2>
            <div style={{ fontSize: "0.9rem", display: "flex", flexDirection: "column", gap: "0.5rem", color: "#cbd5e1" }}>
              <div><strong>Endpoint IP:</strong> {tunnelStatus?.endpoint || "192.168.2.220:51820"}</div>
              <div><strong>WAN Interface:</strong> {tunnelStatus?.wanInterface || "eth0"}</div>
              <div><strong>Active Peers:</strong> {tunnelStatus?.activePeers ?? 0}</div>
              <div style={{ wordBreak: "break-all" }}><strong>Config File:</strong> {tunnelStatus?.serverConfigPath || "/apps/server/configs/wg0.conf"}</div>
            </div>
          </div>

          {/* Controls Card */}
          <div style={{ backgroundColor: "#1e293b", padding: "1.5rem", borderRadius: "0.75rem", border: "1px solid #334155", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <h2 style={{ fontSize: "1.1rem", fontWeight: "600", color: "#f1f5f9", marginBottom: "1rem" }}>
              Exit Node Controls
            </h2>
            <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={handleTunnelUp}
                disabled={loading}
                style={{
                  flex: "1",
                  padding: "0.75rem 1rem",
                  backgroundColor: "#16a34a",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "0.5rem",
                  fontWeight: "600",
                  cursor: "pointer",
                }}
              >
                Turn Exit Node ON (UP)
              </button>
              <button
                type="button"
                onClick={handleTunnelDown}
                disabled={loading}
                style={{
                  flex: "1",
                  padding: "0.75rem 1rem",
                  backgroundColor: "#dc2626",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "0.5rem",
                  fontWeight: "600",
                  cursor: "pointer",
                }}
              >
                Turn Exit Node OFF (DOWN)
              </button>
            </div>
            <button
              type="button"
              onClick={handleCreatePeer}
              disabled={loading}
              style={{
                width: "100%",
                marginTop: "0.75rem",
                padding: "0.85rem 1rem",
                backgroundColor: "#0284c7",
                color: "#ffffff",
                border: "none",
                borderRadius: "0.5rem",
                fontWeight: "700",
                fontSize: "1rem",
                cursor: "pointer",
              }}
            >
              {loading ? "Processing..." : "Create Peer & Generate WireGuard QR Code"}
            </button>
          </div>
        </div>

        {/* QR Code & Client Config Output */}
        {peerResult && peerResult.config && (
          <div style={{ backgroundColor: "#1e293b", padding: "1.5rem", borderRadius: "0.75rem", border: "1px solid #334155" }}>
            <h2 style={{ fontSize: "1.25rem", fontWeight: "700", color: "#38bdf8", marginBottom: "1rem" }}>
              Scan QR Code on Official WireGuard Android/iOS App
            </h2>
            
            <div style={{ display: "flex", gap: "2rem", alignItems: "flex-start", flexWrap: "wrap" }}>
              
              {/* QR Code Canvas/SVG Container */}
              <div style={{ backgroundColor: "#ffffff", padding: "1.25rem", borderRadius: "0.75rem", display: "inline-block" }}>
                <QRCodeSVG value={peerResult.config} size={220} level="M" includeMargin={true} />
              </div>

              {/* Details & Config Textarea */}
              <div style={{ flex: 1, minWidth: "280px" }}>
                <p style={{ fontSize: "0.9rem", color: "#cbd5e1", marginBottom: "0.5rem" }}>
                  <strong>Config Saved To:</strong> <code style={{ color: "#38bdf8" }}>{peerResult.configPath}</code>
                </p>
                <p style={{ fontSize: "0.9rem", color: "#cbd5e1", marginBottom: "0.5rem" }}>
                  <strong>Peer Assigned IP:</strong> <code style={{ color: "#4ade80" }}>{peerResult.peer?.allocatedIp}/32</code>
                </p>
                <textarea
                  readOnly
                  rows={9}
                  value={peerResult.config}
                  style={{
                    width: "100%",
                    backgroundColor: "#0f172a",
                    color: "#38bdf8",
                    fontFamily: "monospace",
                    fontSize: "0.85rem",
                    padding: "0.75rem",
                    borderRadius: "0.5rem",
                    border: "1px solid #334155",
                    resize: "none",
                  }}
                />
              </div>
            </div>
          </div>
        )}

      </div>
    </main>
  );
}

