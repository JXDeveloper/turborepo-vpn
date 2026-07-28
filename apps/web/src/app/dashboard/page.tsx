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
    <div className="space-y-8">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-sky-400">Exit node administration</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">Control panel</h1>
          <p className="mt-2 max-w-2xl text-slate-400">Monitor the WireGuard exit node and provision client peers.</p>
        </div>
        <Link
          href="/dashboard/peers/new"
          className="rounded-lg bg-sky-500 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-sky-400"
        >
          Create peer
        </Link>
      </section>

      {error && <p className="rounded-lg border border-red-900 bg-red-950/40 p-4 text-sm text-red-200">{error}</p>}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Metric
          label="Tunnel state"
          value={status?.status || "Loading"}
          accent={status?.status === "active" ? "text-emerald-400" : "text-amber-300"}
        />
        <Metric label="Active peers" value={String(activePeers)} />
        <Metric label="Endpoint" value={status?.endpoint || "—"} />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-xl border border-slate-800 bg-slate-900 p-5">
          <h2 className="font-semibold">Exit node</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <Row label="WAN interface" value={status?.wanInterface || "Loading…"} />
            <Row label="Assigned peer records" value={String(peers.length)} />
          </dl>
          <Link
            href="/dashboard/tunnel"
            className="mt-6 inline-block text-sm font-medium text-sky-400 hover:text-sky-300"
          >
            Manage tunnel →
          </Link>
        </article>
        <article className="rounded-xl border border-slate-800 bg-slate-900 p-5">
          <h2 className="font-semibold">Peer provisioning</h2>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            A client keypair is generated only when a peer is created. The private key is returned once in the WireGuard
            configuration QR code.
          </p>
          <Link
            href="/dashboard/peers"
            className="mt-6 inline-block text-sm font-medium text-sky-400 hover:text-sky-300"
          >
            View peers →
          </Link>
        </article>
      </section>
    </div>
  );
}

function Metric({ label, value, accent = "text-slate-100" }: { label: string; value: string; accent?: string }) {
  return (
    <article className="rounded-xl border border-slate-800 bg-slate-900 p-5">
      <p className="text-sm text-slate-400">{label}</p>
      <p className={`mt-2 truncate text-2xl font-semibold ${accent}`}>{value}</p>
    </article>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-slate-400">{label}</dt>
      <dd className="text-right font-medium text-slate-200">{value}</dd>
    </div>
  );
}
