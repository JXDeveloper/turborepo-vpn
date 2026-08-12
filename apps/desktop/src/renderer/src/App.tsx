import { SignIn, SignUp, UserButton, useAuth } from '@clerk/electron/react'
import {
  createHashHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Link,
  Navigate,
  Outlet,
  RouterProvider,
  useRouterState
} from '@tanstack/react-router'
import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import {
  createWebApiClient,
  resolveWebApiBaseUrl,
  type CreatedPeer,
  type Peer,
  type TunnelStatus,
  type WebApiClient,
  type WebApiError
} from './lib/api'

const DashboardApiContext = createContext<WebApiClient | null>(null)

function App(): React.JSX.Element {
  return <RouterProvider router={router} />
}

function HomePage(): React.JSX.Element {
  const { isLoaded, isSignedIn } = useAuth()

  if (!isLoaded) {
    return <LoadingScreen />
  }

  return isSignedIn ? <Navigate to="/dashboard" replace /> : <LandingScreen />
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
          <Link to="/auth/sign-in" className="ghost-button">
            Sign in
          </Link>
          <Link to="/auth/sign-up" className="primary-button">
            Create account
          </Link>
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
            <Link to="/auth/sign-up" className="primary-button large">
              Get started
            </Link>
            <Link to="/auth/sign-in" className="secondary-button large">
              Sign in to dashboard
            </Link>
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

function DashboardLayout(): React.JSX.Element {
  const { getToken, isLoaded, isSignedIn } = useAuth()
  const apiBaseUrl = resolveWebApiBaseUrl()
  const api = useMemo<WebApiClient | null>(() => {
    return apiBaseUrl ? createWebApiClient({ baseUrl: apiBaseUrl, getToken }) : null
  }, [apiBaseUrl, getToken])

  if (!isLoaded) {
    return <LoadingScreen />
  }

  if (!isSignedIn) {
    return <Navigate to="/auth/sign-in" replace />
  }

  if (!api) {
    return <MissingApiScreen />
  }

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
            API: <span>{apiBaseUrl}</span>
          </p>
        </div>

        <nav className="nav-list" aria-label="Primary">
          <NavButton to="/dashboard" label="Overview" hint="Status and metrics" />
          <NavButton to="/dashboard/peers" label="Peers" hint="Request configs" />
          <NavButton to="/dashboard/tunnel" label="Exit node" hint="Bring the tunnel up or down" />
        </nav>

        <div className="sidebar-footer">
          <UserButton />
        </div>
      </aside>

      <main className="dashboard-main">
        <header className="topbar surface">
          <div>
            <p className="eyebrow">Operator dashboard</p>
            <h1 className="page-title">WireGuard control panel</h1>
          </div>
          <div className="topbar-badge">Clerk authenticated</div>
        </header>

        <DashboardApiContext.Provider value={api}>
          <Outlet />
        </DashboardApiContext.Provider>
      </main>
    </div>
  )
}

function MissingApiScreen(): React.JSX.Element {
  return (
    <div className="app-frame">
      <div className="surface config-panel">
        <p className="eyebrow">Web API required</p>
        <h1 className="page-title">Desktop UI is ready, but the API base URL is missing.</h1>
        <p className="lead">
          Set <code>VITE_WEB_API_URL</code> or <code>VITE_WEB_APP_URL</code> in the desktop app env
          so the renderer can call the web app API routes.
        </p>
      </div>
    </div>
  )
}

function OverviewView({ api }: { api: WebApiClient }): React.JSX.Element {
  const [status, setStatus] = useState<TunnelStatus | null>(null)
  const [peers, setPeers] = useState<Peer[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function load(): Promise<void> {
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
          <Link to="/dashboard/tunnel" className="back-link">
            Manage tunnel →
          </Link>
        </article>

        <article className="surface card">
          <h2 className="section-title">Peer provisioning</h2>
          <p className="card-copy">
            A client keypair is generated locally with <code>@my-vpn/crypto-utils</code>, then the
            public key is sent to the web API. The private key is only injected into the returned
            config once.
          </p>
          <Link to="/dashboard/peers" className="back-link">
            View peers →
          </Link>
        </article>
      </div>
    </section>
  )
}

function PeersView({ api }: { api: WebApiClient }): React.JSX.Element {
  const [peers, setPeers] = useState<Peer[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [pendingAction, setPendingAction] = useState(false)

  const refresh = async (): Promise<void> => {
    try {
      const nextPeers = await api.getPeers()
      setPeers(nextPeers)
    } catch (cause) {
      setError(readError(cause, 'Unable to load peers.'))
    }
  }

  useEffect(() => {
    let cancelled = false

    async function load(): Promise<void> {
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

  async function revokePeer(peerId: string): Promise<void> {
    setPendingAction(true)
    setError('')

    try {
      await api.revokePeer(peerId)
      await refresh()
    } catch (cause) {
      setError(readError(cause, 'Unable to revoke peer.'))
    } finally {
      setPendingAction(false)
    }
  }

  return (
    <section className="stack">
      <div className="page-heading">
        <div>
          <p className="eyebrow">WireGuard clients</p>
          <h2 className="page-subtitle">Peers</h2>
        </div>
        <Link to="/dashboard/peers/new" className="primary-button">
          Create peer
        </Link>
      </div>

      {error ? <ErrorBanner message={error} /> : null}

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
                      <Link
                        to="/dashboard/peers/$peerId"
                        params={{ peerId: peer.id }}
                        className="peer-name"
                      >
                        {peer.id}
                      </Link>
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

  const refresh = async (): Promise<void> => {
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

    async function load(): Promise<void> {
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

  async function changeState(nextState: 'up' | 'down'): Promise<void> {
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
  to,
  label,
  hint
}: {
  to: '/dashboard' | '/dashboard/peers' | '/dashboard/tunnel'
  label: string
  hint: string
}): React.JSX.Element {
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const active = to === '/dashboard' ? pathname === to : pathname.startsWith(to)

  return (
    <Link to={to} className={`nav-button ${active ? 'active' : ''}`}>
      <span className="nav-button-label">{label}</span>
      <span className="nav-button-hint">{hint}</span>
    </Link>
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

function formatDate(value: string): string {
  return new Date(value).toLocaleString()
}

function useDashboardApi(): WebApiClient {
  const api = useContext(DashboardApiContext)
  if (!api) {
    throw new Error('Dashboard API is unavailable.')
  }
  return api
}

function SignInPage(): React.JSX.Element {
  const { isLoaded, isSignedIn } = useAuth()

  if (!isLoaded) {
    return <LoadingScreen />
  }

  if (isSignedIn) {
    return <Navigate to="/dashboard" replace />
  }

  return (
    <main className="auth-page">
      <SignIn />
    </main>
  )
}

function SignUpPage(): React.JSX.Element {
  const { isLoaded, isSignedIn } = useAuth()

  if (!isLoaded) {
    return <LoadingScreen />
  }

  if (isSignedIn) {
    return <Navigate to="/dashboard" replace />
  }

  return (
    <main className="auth-page">
      <SignUp />
    </main>
  )
}

function DashboardPage(): React.JSX.Element {
  return <OverviewView api={useDashboardApi()} />
}

function PeersPage(): React.JSX.Element {
  return <PeersView api={useDashboardApi()} />
}

function TunnelPage(): React.JSX.Element {
  return <TunnelView api={useDashboardApi()} />
}

function NewPeerPage(): React.JSX.Element {
  const api = useDashboardApi()
  const [result, setResult] = useState<CreatedPeer | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function createPeer(): Promise<void> {
    setLoading(true)
    setError('')
    try {
      setResult(await api.requestPeerConfig())
    } catch (cause) {
      setError(readError(cause, 'Unable to create peer.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="stack narrow">
      <Link to="/dashboard/peers" className="back-link">
        ← All peers
      </Link>
      <div>
        <p className="eyebrow">WireGuard clients</p>
        <h2 className="page-subtitle">Create peer</h2>
        <p className="lead">
          Create a client configuration, then copy it into the official WireGuard app. Treat this
          configuration like a password.
        </p>
      </div>
      {error ? <ErrorBanner message={error} /> : null}
      {!result ? (
        <article className="surface card">
          <h3 className="section-title">New client configuration</h3>
          <p className="card-copy">
            The client keypair is generated locally. Save the resulting configuration now; its
            private key is not retained by the control panel.
          </p>
          <button
            type="button"
            className="primary-button"
            onClick={() => void createPeer()}
            disabled={loading}
          >
            {loading ? 'Creating peer…' : 'Create configuration'}
          </button>
        </article>
      ) : (
        <article className="surface card config-card">
          <p className="eyebrow success-text">Peer created</p>
          <h3 className="section-title">{result.peer.allocatedIp}/32</h3>
          <textarea className="config-textarea mono" readOnly value={result.clientConfig} />
          <Link
            to="/dashboard/peers/$peerId"
            params={{ peerId: result.peer.id }}
            className="back-link"
          >
            View peer details →
          </Link>
        </article>
      )}
    </section>
  )
}

function PeerDetailPage(): React.JSX.Element {
  const api = useDashboardApi()
  const { peerId } = useRouterState({
    select: (state) => state.matches.at(-1)?.params as { peerId: string }
  })
  const [peer, setPeer] = useState<Peer | null>(null)
  const [error, setError] = useState('')
  const [revoking, setRevoking] = useState(false)

  useEffect(() => {
    void api
      .getPeer(peerId)
      .then(setPeer)
      .catch((cause) => setError(readError(cause, 'Unable to load peer.')))
  }, [api, peerId])

  async function revokePeer(): Promise<void> {
    if (!window.confirm('Revoke this peer? Its tunnel access will be removed.')) return
    setRevoking(true)
    setError('')
    try {
      setPeer(await api.revokePeer(peerId))
    } catch (cause) {
      setError(readError(cause, 'Unable to revoke peer.'))
    } finally {
      setRevoking(false)
    }
  }

  return (
    <section className="stack narrow">
      <Link to="/dashboard/peers" className="back-link">
        ← All peers
      </Link>
      {error ? <ErrorBanner message={error} /> : null}
      {!peer && !error ? <p className="card-copy">Loading peer…</p> : null}
      {peer ? (
        <article className="surface card">
          <div className="config-card-header">
            <div>
              <p className="eyebrow">Peer</p>
              <h2 className="page-subtitle">{peer.id}</h2>
            </div>
            <span className={`status-pill ${peer.status === 'active' ? 'success' : ''}`}>
              {peer.status}
            </span>
          </div>
          <dl className="detail-list">
            <DetailRow label="Assigned address" value={`${peer.allocatedIp}/32`} />
            <DetailRow label="Public key" value={peer.publicKey} />
            <DetailRow label="Created" value={formatDate(peer.createdAt)} />
          </dl>
          {peer.status === 'active' ? (
            <button
              type="button"
              className="danger-button"
              onClick={() => void revokePeer()}
              disabled={revoking}
            >
              {revoking ? 'Revoking…' : 'Revoke peer'}
            </button>
          ) : null}
        </article>
      ) : null}
    </section>
  )
}

const rootRoute = createRootRoute({ component: Outlet })
const homeRoute = createRoute({ getParentRoute: () => rootRoute, path: '/', component: HomePage })
const authRoute = createRoute({ getParentRoute: () => rootRoute, path: 'auth', component: Outlet })
const signInRoute = createRoute({
  getParentRoute: () => authRoute,
  path: 'sign-in',
  component: SignInPage
})
const signUpRoute = createRoute({
  getParentRoute: () => authRoute,
  path: 'sign-up',
  component: SignUpPage
})
const dashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'dashboard',
  component: DashboardLayout
})
const dashboardIndexRoute = createRoute({
  getParentRoute: () => dashboardRoute,
  path: '/',
  component: DashboardPage
})
const peersRoute = createRoute({
  getParentRoute: () => dashboardRoute,
  path: 'peers',
  component: PeersPage
})
const newPeerRoute = createRoute({
  getParentRoute: () => peersRoute,
  path: 'new',
  component: NewPeerPage
})
const peerDetailRoute = createRoute({
  getParentRoute: () => peersRoute,
  path: '$peerId',
  component: PeerDetailPage
})
const tunnelRoute = createRoute({
  getParentRoute: () => dashboardRoute,
  path: 'tunnel',
  component: TunnelPage
})

const routeTree = rootRoute.addChildren([
  homeRoute,
  authRoute.addChildren([signInRoute, signUpRoute]),
  dashboardRoute.addChildren([
    dashboardIndexRoute,
    peersRoute.addChildren([newPeerRoute, peerDetailRoute]),
    tunnelRoute
  ])
])

const router = createRouter({ routeTree, history: createHashHistory() })

export default App
