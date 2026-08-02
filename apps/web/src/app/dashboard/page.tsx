"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getPeers, getTunnelStatus, type Peer, type TunnelStatus } from "../action";

export default function DashboardPage() {
  const [status, setStatus] = useState<TunnelStatus | null>(null);
  const [peers, setPeers] = useState<Peer[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([getTunnelStatus(), getPeers()])
      .then(([nextStatus, nextPeers]) => {
        setStatus(nextStatus);
        setPeers(nextPeers);
      })
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Unable to load dashboard."));
  }, []);

  const activePeers = peers.filter((peer) => peer.status === "active").length;

  return (
    <div className="space-y-10 py-10 sm:py-14">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-primary">Exit node administration</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">Control panel</h1>
          <p className="mt-3 max-w-2xl text-[15px] leading-7 text-muted-foreground">
            Monitor the WireGuard exit node and provision client peers.
          </p>
        </div>
        <Link
          href="/dashboard/peers/new"
          className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
        >
          Create peer
        </Link>
      </section>

      {error && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </p>
      )}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Metric
          label="Tunnel state"
          value={status?.status || "Loading"}
          accent={status?.status === "active" ? "text-success" : "text-warning"}
        />
        <Metric label="Active peers" value={String(activePeers)} />
        <Metric label="Endpoint" value={status?.endpoint || "—"} />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-xl border border-border bg-card p-5">
          <h2 className="font-semibold">Exit node</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <Row label="WAN interface" value={status?.wanInterface || "Loading…"} />
            <Row label="Assigned peer records" value={String(peers.length)} />
          </dl>
          <Link
            href="/dashboard/tunnel"
            className="mt-6 inline-block text-sm font-medium text-primary hover:text-primary/80"
          >
            Manage tunnel →
          </Link>
        </article>
        <article className="rounded-xl border border-border bg-card p-5">
          <h2 className="font-semibold">Peer provisioning</h2>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            A client keypair is generated only when a peer is created. The private key is returned once in the WireGuard
            configuration QR code.
          </p>
          <Link
            href="/dashboard/peers"
            className="mt-6 inline-block text-sm font-medium text-primary hover:text-primary/80"
          >
            View peers →
          </Link>
        </article>
      </section>
    </div>
  );
}

function Metric({ label, value, accent = "text-foreground" }: { label: string; value: string; accent?: string }) {
  return (
    <article className="rounded-xl border border-border bg-card p-5">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className={`mt-2 truncate text-[1.65rem] font-semibold tracking-tight ${accent}`}>{value}</p>
    </article>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium text-foreground">{value}</dd>
    </div>
  );
}
