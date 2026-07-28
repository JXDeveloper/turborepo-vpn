"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getPeer, revokePeer, type Peer } from "../../../action";

export default function PeerDetail({ peerId }: { peerId: string }) {
  const [peer, setPeer] = useState<Peer | null>(null);
  const [error, setError] = useState("");
  const [revoking, setRevoking] = useState(false);

  useEffect(() => { getPeer(peerId).then(setPeer).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Unable to load peer.")); }, [peerId]);

  async function handleRevoke() {
    if (!window.confirm("Revoke this peer? Its tunnel access will be removed.")) return;
    setRevoking(true);
    setError("");
    try { setPeer(await revokePeer(peerId)); } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to revoke peer."); } finally { setRevoking(false); }
  }

  return <div className="max-w-2xl"><Link href="/dashboard/peers" className="text-sm text-sky-400 hover:text-sky-300">← All peers</Link>{error && <p className="mt-6 rounded-lg border border-red-900 bg-red-950/40 p-4 text-sm text-red-200">{error}</p>}{!peer && !error && <p className="mt-6 text-slate-400">Loading peer…</p>}{peer && <section className="mt-6 rounded-xl border border-slate-800 bg-slate-900 p-6"><div className="flex items-start justify-between gap-4"><div><p className="text-sm text-slate-400">Peer</p><h1 className="mt-1 text-2xl font-bold">{peer.id}</h1></div><span className={peer.status === "active" ? "rounded-full bg-emerald-950 px-3 py-1 text-sm text-emerald-400" : "rounded-full bg-slate-800 px-3 py-1 text-sm text-slate-400"}>{peer.status}</span></div><dl className="mt-8 space-y-5 text-sm"><Field label="Assigned address" value={`${peer.allocatedIp}/32`} /><Field label="Public key" value={peer.publicKey} mono /><Field label="Created" value={new Date(peer.createdAt).toLocaleString()} /></dl>{peer.status === "active" && <button type="button" onClick={handleRevoke} disabled={revoking} className="mt-8 rounded-lg border border-red-900 px-4 py-2.5 text-sm font-semibold text-red-300 hover:bg-red-950 disabled:opacity-60">{revoking ? "Revoking…" : "Revoke peer"}</button>}</section>}</div>;
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) { return <div><dt className="text-slate-400">{label}</dt><dd className={`mt-1 break-all text-slate-100 ${mono ? "font-mono text-xs" : ""}`}>{value}</dd></div>; }
