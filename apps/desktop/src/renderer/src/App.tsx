import {
  Show,
  SignIn,
  SignInButton,
  SignUpButton,
  UserButton,
  useAuth
} from '@clerk/electron/react'
import { useEffect, useMemo, useState } from 'react'
import {
  createWebApiClient,
  resolveWebApiBaseUrl,
  type CreatedPeer,
  type Peer,
  type TunnelStatus,
  type WebApiClient,
  type WebApiError
} from './lib/api'
import type { VpnStatus } from "./../../preload/index.d";

type ViewId = 'overview' | 'client' | 'peers' | 'tunnel'

function App(): React.JSX.Element {
  const [view, setView] = useState<ViewId>('client')
  const [ready, setReady] = useState(false)
  const { getToken, isLoaded, isSignedIn } = useAuth()
  const apiBaseUrl = resolveWebApiBaseUrl()

  const api = useMemo<WebApiClient | null>(() => {
    if (!apiBaseUrl) {
      return null
    }

    return createWebApiClient({ baseUrl: apiBaseUrl, getToken })
  }, [apiBaseUrl, getToken])

  useEffect(() => {
    if (isLoaded) {
      setReady(true)
    }
  }, [isLoaded])

  if (!ready) {
    return <LoadingScreen />
  }

  if (!isSignedIn) {
    return <LandingScreen />
  }

  if (!api) {
    return (
      <div className="app-frame">
        <div className="surface config-panel">
          <p className="eyebrow">Web API required</p>
          <h1 className="page-title">Desktop UI is ready, but the API base URL is missing.</h1>
          <p className="lead">
            Set <code>VITE_WEB_API_URL</code> or <code>VITE_WEB_APP_URL</code> in the desktop app
            env so the renderer can call the future <code>/app/api</code> routes from the web app.
          </p>
        </div>
      </div>
    )
  }

  return <DashboardShell api={api} activeView={view} onNavigate={setView} baseUrl={apiBaseUrl} />
}

function LoadingScreen(): React.JSX.Element {
  return (
    <div className="app-frame centered">
      <div className="surface loading-card">
        <p className="eyebrow">Clerk</p>
        <h1 className="page-title">Loading session…</h1>
        <p className="lead">Restoring your authenticated desktop workspace.</p>
      </div>
    </div>
  )
}

function LandingScreen(): React.JSX.Element {
  return (
    <main className="landing">
      <section className="landing-nav">
        <div className="brand-lockup">
          <div className="brand-mark">V</div>
          <div>
            <p className="brand-name">VPN Control Panel</p>
            <p className="brand-subtitle">Electron desktop companion</p>
          </div>
        </div>
        <div className="auth-actions">
          <Show when="signed-out">
            <SignIn />
          </Show>
          <SignUpButton>
            <button type="button" className="primary-button">
              Create account
            </button>
          </SignUpButton>
        </div>
      </section>

      <section className="hero-grid">
        <div className="hero-copy">
          <p className="eyebrow">WireGuard exit-node administration</p>
          <h1 className="hero-title">
            Operate your VPN from a desktop app that feels like the web.
          </h1>
          <p className="hero-text">
            Provision peers, distribute client configs, and manage tunnel state in a native Electron
            shell that mirrors the web dashboard you already designed.
          </p>
          <div className="cta-row">
            <SignUpButton>
              <button type="button" className="primary-button large">
                Get started
              </button>
            </SignUpButton>
            <SignInButton>
              <button type="button" className="secondary-button large">
                Sign in to dashboard
              </button>
            </SignInButton>
          </div>
        </div>

        <aside className="hero-card surface">
          <div className="hero-card-header">
            <div>
              <p className="eyebrow">Exit node</p>
              <h2 className="section-title">wg0</h2>
            </div>
            <span className="status-pill success">Operational</span>
          </div>
          <dl className="detail-list">
            <DetailRow label="Peer lifecycle" value="Create and revoke access" />
            <DetailRow label="Configuration delivery" value="Config + QR-ready payload" />
            <DetailRow label="Tunnel controls" value="Protected operator actions" />
          </dl>
        </aside>
      </section>

      <section className="feature-grid">
        <FeatureCard
          title="Peer management"
          description="Create, inspect, and revoke client access without jumping out to the server directly."
        />
        <FeatureCard
          title="Config hand-off"
          description="Request a client config from the web API and surface it in the desktop UI for copy/export."
        />
        <FeatureCard
          title="Live node visibility"
          description="See tunnel state, endpoint details, and active peer counts in the same familiar layout."
        />
      </section>
    </main>
  )
}

function DashboardShell({
  api,
  activeView,
  baseUrl,
  onNavigate
}: {
  api: WebApiClient
  activeView: ViewId
  baseUrl: string
  onNavigate: (view: ViewId) => void
}): React.JSX.Element {
  return (
    <div className="dashboard-layout">
      <aside className="sidebar surface">
        <div className="sidebar-top">
          <div className="brand-lockup">
            <div className="brand-mark">V</div>
            <div>
              <p className="brand-name">VPN Control Panel</p>
              <p className="brand-subtitle">Desktop operator view</p>
            </div>
          </div>
          <p className="sidebar-note">
            API: <span>{baseUrl}</span>
          </p>
        </div>

        <nav className="nav-list" aria-label="Primary">
          <NavButton
            active={activeView === 'client'}
            onClick={() => onNavigate('client')}
            label="Client VPN"
            hint="Connect this device"
          />
          <NavButton
            active={activeView === 'overview'}
            onClick={() => onNavigate('overview')}
            label="Overview"
            hint="Status and metrics"
          />
          <NavButton
            active={activeView === 'peers'}
            onClick={() => onNavigate('peers')}
            label="Peers"
            hint="Request configs"
          />
          <NavButton
            active={activeView === 'tunnel'}
            onClick={() => onNavigate('tunnel')}
            label="Exit node"
            hint="Bring the tunnel up or down"
          />
        </nav>

        <div className="sidebar-footer">
          <UserButton />
        </div>
      </aside>

      <main className="dashboard-main">
        <header className="topbar surface">
          <div>
            <p className="eyebrow">Desktop Client & Operator Dashboard</p>
            <h1 className="page-title">WireGuard control panel</h1>
          </div>
          <div className="topbar-badge">Clerk authenticated</div>
        </header>

        {activeView === 'client' ? (
          <ClientView api={api} />
        ) : activeView === 'overview' ? (
          <OverviewView api={api} />
        ) : activeView === 'peers' ? (
          <PeersView api={api} />
        ) : (
          <TunnelView api={api} />
        )}
      </main>
    </div>
  )
}

function ClientView({ api }: { api: WebApiClient }): React.JSX.Element {
  const [vpnStatus, setVpnStatus] = useState<VpnStatus | null>(null)
  const [serviceAvailable, setServiceAvailable] = useState<boolean>(true)
  const [loading, setLoading] = useState<boolean>(true)
  const [busy, setBusy] = useState<boolean>(false)
  const [error, setError] = useState<string>('')
  const [region, setRegion] = useState<string>('us-east')

  const poll = async () => {
    try {
      if (window.vpn?.getStatus) {
        const current = await window.vpn.getStatus()
        setVpnStatus(current)
      }
      if (window.vpn?.checkService) {
        const available = await window.vpn.checkService()
        setServiceAvailable(available)
      }
    } catch (cause) {
      console.warn('Status polling warning:', cause)
    }
  }

  useEffect(() => {
    let cancelled = false

    async function init() {
      setLoading(true)
      await poll()
      if (!cancelled) {
        setLoading(false)
      }
    }

    void init()
    const timer = setInterval(() => {
      void poll()
    }, 2000)

    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [])

  const handleConnect = async () => {
    setBusy(true)
    setError('')

    try {
      // Step 1: Provision client peer keys via Web API
      const created = await api.requestPeerConfig()

      // Extract client private key from the assembled config or payload
      const match = created.clientConfig.match(/PrivateKey\s*=\s*(.+)/)
      const privateKey = match ? match[1].trim() : ''

      // Step 2: Store config and connect via Linux D-Bus native agent
      await window.vpn.connect({
        regionId: region,
        storeParams: {
          region,
          privateKey,
          serverPublicKey: created.peer.publicKey,
          endpoint: created.endpoint,
          allowedIps: ['0.0.0.0/0', '::/0']
        }
      })

      await poll()
    } catch (cause) {
      setError(readError(cause, 'Unable to connect to VPN.'))
    } finally {
      setBusy(false)
    }
  }

  const handleDisconnect = async () => {
    setBusy(true)
    setError('')

    try {
      await window.vpn.disconnect()
      await poll()
    } catch (cause) {
      setError(readError(cause, 'Unable to disconnect VPN.'))
    } finally {
      setBusy(false)
    }
  }

  const isConnected = vpnStatus?.status === 'connected'

  return (
    <section className="stack">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Local client connection</p>
          <h2 className="page-subtitle">Client VPN</h2>
        </div>
        <button
          type="button"
          className="secondary-button"
          onClick={() => void poll()}
          disabled={loading || busy}
        >
          {busy ? 'Working…' : 'Refresh status'}
        </button>
      </div>

      {error ? <ErrorBanner message={error} /> : null}

      {!serviceAvailable ? (
        <article className="surface card" style={{ borderColor: 'var(--amber-8, #f59e0b)' }}>
          <p className="eyebrow" style={{ color: 'var(--amber-10, #d97706)' }}>
            Native Service Inactive
          </p>
          <h3 className="section-title">Linux System D-Bus Daemon Not Detected</h3>
          <p className="card-copy">
            The native agent (<code>com.mycompany.vpn.service</code>) is not running on the system
            bus. If you are developing locally, fallback simulator mode is active. In production,
            start the service using:
          </p>
          <pre className="mono" style={{ padding: '0.75rem', borderRadius: '4px', background: 'rgba(0,0,0,0.3)', margin: '0.5rem 0' }}>
            sudo systemctl start com.mycompany.vpn.service
          </pre>
        </article>
      ) : null}

      <div className="metric-grid">
        <MetricCard
          label="Client Status"
          value={loading ? 'Loading…' : isConnected ? 'Connected' : 'Disconnected'}
          tone={isConnected ? 'success' : 'default'}
        />
        <MetricCard
          label="Active Region"
          value={vpnStatus?.region ? vpnStatus.region.toUpperCase() : 'None'}
        />
        <MetricCard
          label="Interface"
          value={vpnStatus?.interface ?? '—'}
        />
      </div>

      <article className="surface card">
        <div className="hero-card-header">
          <div>
            <p className="eyebrow">Tunnel Control</p>
            <h3 className="section-title">
              {isConnected ? `Connected to ${vpnStatus?.region ?? region}` : 'Ready to Connect'}
            </h3>
          </div>
          <span className={isConnected ? 'status-pill success' : 'status-pill'}>
            {isConnected ? 'Active Tunnel' : 'Idle'}
          </span>
        </div>

        <div className="config-grid" style={{ margin: '1.5rem 0' }}>
          <div>
            <label className="field-label" htmlFor="vpn-region-select">Target Region</label>
            <select
              id="vpn-region-select"
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              disabled={isConnected || busy}
              style={{
                width: '100%',
                padding: '0.6rem 0.8rem',
                borderRadius: '6px',
                background: 'rgba(255, 255, 255, 0.05)',
                color: 'inherit',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                marginTop: '0.3rem'
              }}
            >
              <option value="us-east">US East (N. Virginia)</option>
              <option value="us-west">US West (Oregon)</option>
              <option value="eu-central">Europe (Frankfurt)</option>
              <option value="ap-south">Asia Pacific (Mumbai)</option>
            </select>
          </div>
          <div>
            <p className="field-label">Connected Duration</p>
            <p className="mono wrap" style={{ marginTop: '0.5rem', fontSize: '1.1rem' }}>
              {formatDuration(vpnStatus?.connectedAt)}
            </p>
          </div>
        </div>

        <div className="metric-detail-grid" style={{ marginBottom: '1.5rem' }}>
          <DetailCard label="Downloaded (Rx)" value={formatBytes(vpnStatus?.bytesRx)} />
          <DetailCard label="Uploaded (Tx)" value={formatBytes(vpnStatus?.bytesTx)} />
          <DetailCard label="Gateway Endpoint" value={vpnStatus?.endpoint ?? '198.51.100.1:51820'} />
          <DetailCard
            label="Latest Handshake"
            value={vpnStatus?.latestHandshake ? `${Math.max(0, Math.floor(Date.now() / 1000) - vpnStatus.latestHandshake)}s ago` : '—'}
          />
        </div>

        <div className="actions-row">
          {!isConnected ? (
            <button
              type="button"
              className="primary-button large"
              onClick={handleConnect}
              disabled={busy}
            >
              {busy ? 'Establishing WireGuard Tunnel…' : `Connect to ${region.toUpperCase()}`}
            </button>
          ) : (
            <button
              type="button"
              className="danger-button large"
              onClick={handleDisconnect}
              disabled={busy}
            >
              {busy ? 'Disconnecting…' : 'Disconnect VPN'}
            </button>
          )}
        </div>
      </article>

      <article className="surface card">
        <h3 className="section-title">Linux System Integration Details</h3>
        <dl className="detail-list compact">
          <DetailRow label="D-Bus Bus Name" value="com.mycompany.Vpn" />
          <DetailRow label="D-Bus Object Path" value="/com/mycompany/Vpn" />
          <DetailRow label="Polkit Policy Action" value="com.mycompany.vpn.connect (Active Local Session)" />
          <DetailRow label="Config Storage Path" value={`/etc/mycompany-vpn/configs/${region}.conf`} />
        </dl>
      </article>
    </section>
  )
}

function OverviewView({ api }: { api: WebApiClient }): React.JSX.Element {
  const [status, setStatus] = useState<TunnelStatus | null>(null)
  const [peers, setPeers] = useState<Peer[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError('')

      try {
        const [nextStatus, nextPeers] = await Promise.all([api.getTunnelStatus(), api.getPeers()])

        if (cancelled) {
          return
        }

        setStatus(nextStatus)
        setPeers(nextPeers)
      } catch (cause) {
        if (cancelled) {
          return
        }

        setError(readError(cause, 'Unable to load dashboard.'))
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [api])

  const activePeers = peers.filter((peer) => peer.status === 'active').length

  return (
    <section className="stack">
      {error ? <ErrorBanner message={error} /> : null}

      <div className="metric-grid">
        <MetricCard
          label="Tunnel state"
          value={loading ? 'Loading…' : (status?.status ?? 'Unknown')}
          tone={status?.status === 'active' ? 'success' : 'warning'}
        />
        <MetricCard label="Active peers" value={String(activePeers)} />
        <MetricCard label="Endpoint" value={status?.endpoint ?? '—'} />
      </div>

      <div className="info-grid">
        <article className="surface card">
          <h2 className="section-title">Exit node</h2>
          <dl className="detail-list compact">
            <DetailRow label="WAN interface" value={status?.wanInterface ?? 'Loading…'} />
            <DetailRow label="Assigned peer records" value={String(peers.length)} />
            <DetailRow label="Server config path" value={status?.serverConfigPath ?? '—'} />
          </dl>
        </article>

        <article className="surface card">
          <h2 className="section-title">Peer provisioning</h2>
          <p className="card-copy">
            A client keypair is generated locally with <code>@my-vpn/crypto-utils</code>, then the
            public key is sent to the web API. The private key is only injected into the returned
            config once.
          </p>
        </article>
      </div>
    </section>
  )
}

function PeersView({ api }: { api: WebApiClient }): React.JSX.Element {
  const [peers, setPeers] = useState<Peer[]>([])
  const [createdPeer, setCreatedPeer] = useState<CreatedPeer | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [pendingAction, setPendingAction] = useState(false)
  const [copyLabel, setCopyLabel] = useState('Copy config')

  const refresh = async () => {
    try {
      const nextPeers = await api.getPeers()
      setPeers(nextPeers)
    } catch (cause) {
      setError(readError(cause, 'Unable to load peers.'))
    }
  }

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError('')

      try {
        const nextPeers = await api.getPeers()
        if (!cancelled) {
          setPeers(nextPeers)
        }
      } catch (cause) {
        if (!cancelled) {
          setError(readError(cause, 'Unable to load peers.'))
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [api])

  async function requestConfig() {
    setPendingAction(true)
    setError('')
    setCopyLabel('Copy config')

    try {
      const peer = await api.requestPeerConfig()
      setCreatedPeer(peer)
      await refresh()
    } catch (cause) {
      setError(readError(cause, 'Unable to request a peer config.'))
    } finally {
      setPendingAction(false)
    }
  }

  async function revokePeer(peerId: string) {
    setPendingAction(true)
    setError('')

    try {
      await api.revokePeer(peerId)
      if (createdPeer?.peer.id === peerId) {
        setCreatedPeer(null)
      }
      await refresh()
    } catch (cause) {
      setError(readError(cause, 'Unable to revoke peer.'))
    } finally {
      setPendingAction(false)
    }
  }

  async function copyConfig() {
    if (!createdPeer) {
      return
    }

    await navigator.clipboard.writeText(createdPeer.clientConfig)
    setCopyLabel('Copied')
    window.setTimeout(() => setCopyLabel('Copy config'), 1500)
  }

  return (
    <section className="stack">
      <div className="page-heading">
        <div>
          <p className="eyebrow">WireGuard clients</p>
          <h2 className="page-subtitle">Peers</h2>
        </div>
        <button
          type="button"
          className="primary-button"
          onClick={requestConfig}
          disabled={pendingAction}
        >
          {pendingAction ? 'Working…' : 'Request config'}
        </button>
      </div>

      {error ? <ErrorBanner message={error} /> : null}

      {createdPeer ? (
        <article className="surface card config-card">
          <div className="config-card-header">
            <div>
              <p className="eyebrow">Latest requested config</p>
              <h3 className="section-title">{createdPeer.peer.id}</h3>
            </div>
            <div className="config-meta">
              <span className="status-pill">{createdPeer.peer.status}</span>
              <span className="mono">{createdPeer.peer.allocatedIp}/32</span>
            </div>
          </div>

          <div className="config-grid">
            <div>
              <p className="field-label">Endpoint</p>
              <p className="mono wrap">{createdPeer.endpoint}</p>
            </div>
            <div>
              <p className="field-label">Public key</p>
              <p className="mono wrap">{createdPeer.peer.publicKey}</p>
            </div>
          </div>

          <label className="config-textarea-wrap">
            <span className="field-label">Client config</span>
            <textarea className="config-textarea mono" readOnly value={createdPeer.clientConfig} />
          </label>

          <div className="actions-row">
            <button type="button" className="secondary-button" onClick={copyConfig}>
              {copyLabel}
            </button>
          </div>
        </article>
      ) : null}

      <article className="surface table-card">
        <div className="table-header">
          <div>
            <h3 className="section-title">Provisioned peers</h3>
            <p className="card-copy">Loaded from the future web API routes.</p>
          </div>
          <button
            type="button"
            className="secondary-button"
            onClick={() => {
              void refresh()
            }}
            disabled={loading}
          >
            Refresh
          </button>
        </div>

        <div className="table-scroll">
          <table className="peer-table">
            <thead>
              <tr>
                <th>Peer</th>
                <th>Address</th>
                <th>Status</th>
                <th>Created</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {peers.map((peer) => (
                <tr key={peer.id}>
                  <td>
                    <div className="peer-cell">
                      <p className="peer-name">{peer.id}</p>
                      <p className="peer-key mono">{peer.publicKey}</p>
                    </div>
                  </td>
                  <td className="mono">{peer.allocatedIp}/32</td>
                  <td>
                    <span
                      className={peer.status === 'active' ? 'status-pill success' : 'status-pill'}
                    >
                      {peer.status}
                    </span>
                  </td>
                  <td>{formatDate(peer.createdAt)}</td>
                  <td className="row-actions">
                    <button
                      type="button"
                      className="danger-button"
                      onClick={() => {
                        void revokePeer(peer.id)
                      }}
                      disabled={pendingAction}
                    >
                      Revoke
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!error && peers.length === 0 ? (
          <p className="empty-state">No peers have been provisioned yet.</p>
        ) : null}
      </article>
    </section>
  )
}

function TunnelView({ api }: { api: WebApiClient }): React.JSX.Element {
  const [status, setStatus] = useState<TunnelStatus | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [pendingAction, setPendingAction] = useState(false)

  const refresh = async () => {
    setError('')

    try {
      const nextStatus = await api.getTunnelStatus()
      setStatus(nextStatus)
    } catch (cause) {
      setError(readError(cause, 'Unable to load tunnel status.'))
    }
  }

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      try {
        const nextStatus = await api.getTunnelStatus()
        if (!cancelled) {
          setStatus(nextStatus)
        }
      } catch (cause) {
        if (!cancelled) {
          setError(readError(cause, 'Unable to load tunnel status.'))
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [api])

  async function changeState(nextState: 'up' | 'down') {
    setPendingAction(true)
    setError('')

    try {
      await api.setTunnelState(nextState)
      await refresh()
    } catch (cause) {
      setError(readError(cause, 'Unable to update tunnel.'))
    } finally {
      setPendingAction(false)
    }
  }

  return (
    <section className="stack narrow">
      <div className="page-heading">
        <div>
          <p className="eyebrow">WireGuard interface</p>
          <h2 className="page-subtitle">Exit node</h2>
        </div>
        <button
          type="button"
          className="secondary-button"
          onClick={() => void refresh()}
          disabled={loading}
        >
          Refresh
        </button>
      </div>

      {error ? <ErrorBanner message={error} /> : null}

      <article className="surface card">
        <div className="status-header">
          <div>
            <p className="field-label">Current status</p>
            <p
              className={`status-word ${status?.status === 'active' ? 'success-text' : 'warning-text'}`}
            >
              {loading ? 'Loading…' : (status?.status ?? 'Unknown')}
            </p>
          </div>
          <div className="status-pill-group">
            <span className="status-pill">{status?.endpoint ?? '—'}</span>
          </div>
        </div>

        <dl className="metric-detail-grid">
          <DetailCard label="Endpoint" value={status?.endpoint ?? '—'} />
          <DetailCard label="WAN interface" value={status?.wanInterface ?? '—'} />
          <DetailCard label="Active peers" value={String(status?.activePeers ?? '—')} />
          <DetailCard label="Server config path" value={status?.serverConfigPath ?? '—'} />
        </dl>

        <div className="actions-row">
          <button
            type="button"
            className="primary-button"
            disabled={pendingAction || status?.status === 'active'}
            onClick={() => {
              void changeState('up')
            }}
          >
            Bring up
          </button>
          <button
            type="button"
            className="danger-button"
            disabled={pendingAction || status?.status === 'inactive'}
            onClick={() => {
              void changeState('down')
            }}
          >
            Bring down
          </button>
        </div>
      </article>
    </section>
  )
}

function NavButton({
  active,
  label,
  hint,
  onClick
}: {
  active: boolean
  label: string
  hint: string
  onClick: () => void
}): React.JSX.Element {
  return (
    <button type="button" className={`nav-button ${active ? 'active' : ''}`} onClick={onClick}>
      <span className="nav-button-label">{label}</span>
      <span className="nav-button-hint">{hint}</span>
    </button>
  )
}

function MetricCard({
  label,
  value,
  tone = 'default'
}: {
  label: string
  value: string
  tone?: 'default' | 'success' | 'warning'
}): React.JSX.Element {
  return (
    <article className="surface metric-card">
      <p className="field-label">{label}</p>
      <p
        className={`metric-value ${tone === 'success' ? 'success-text' : tone === 'warning' ? 'warning-text' : ''}`}
      >
        {value}
      </p>
    </article>
  )
}

function FeatureCard({
  title,
  description
}: {
  title: string
  description: string
}): React.JSX.Element {
  return (
    <article className="surface feature-card">
      <h2 className="section-title">{title}</h2>
      <p className="card-copy">{description}</p>
    </article>
  )
}

function DetailRow({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <div className="detail-row">
      <dt className="detail-label">{label}</dt>
      <dd className="detail-value">{value}</dd>
    </div>
  )
}

function DetailCard({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <div className="detail-card">
      <dt className="detail-label">{label}</dt>
      <dd className="detail-value">{value}</dd>
    </div>
  )
}

function ErrorBanner({ message }: { message: string }): React.JSX.Element {
  return (
    <p className="surface error-banner" role="alert">
      {message}
    </p>
  )
}

function readError(cause: unknown, fallback: string): string {
  if (cause instanceof Error) {
    return cause.message
  }

  if (isWebApiError(cause)) {
    return cause.message
  }

  return fallback
}

function isWebApiError(value: unknown): value is WebApiError {
  return (
    typeof value === 'object' &&
    value !== null &&
    'name' in value &&
    (value as { name?: unknown }).name === 'WebApiError' &&
    'message' in value &&
    typeof (value as { message?: unknown }).message === 'string'
  )
}

function formatBytes(bytes?: number): string {
  if (bytes == null || isNaN(bytes) || bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

function formatDuration(connectedAt?: number): string {
  if (!connectedAt) return '—'
  const now = Math.floor(Date.now() / 1000)
  const diff = Math.max(0, now - connectedAt)
  const mins = Math.floor(diff / 60)
  const secs = diff % 60
  const hrs = Math.floor(mins / 60)
  if (hrs > 0) return `${hrs}h ${mins % 60}m`
  return `${mins}m ${secs}s`
}

function formatDate(value: string): string {
  return new Date(value).toLocaleString()
}

export default App


