"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getPeers, type Peer } from "../../action";

export default function PeersPage() {
  const [peers, setPeers] = useState<Peer[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    getPeers()
      .then(setPeers)
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Unable to load peers."));
  }, []);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-sky-400">WireGuard clients</p>
          <h1 className="mt-1 text-3xl font-bold">Peers</h1>
        </div>
        <Link
          href="/dashboard/peers/new"
          className="rounded-lg bg-sky-500 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-sky-400"
        >
          Create peer
        </Link>
      </div>
      {error && <p className="mt-6 rounded-lg border border-red-900 bg-red-950/40 p-4 text-sm text-red-200">{error}</p>}
      <div className="mt-8 overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-800 text-slate-400">
            <tr>
              <th className="px-5 py-3 font-medium">Peer</th>
              <th className="px-5 py-3 font-medium">Address</th>
              <th className="px-5 py-3 font-medium">Status</th>
              <th className="px-5 py-3 font-medium">Created</th>
            </tr>
          </thead>
          <tbody>
            {peers.map((peer) => (
              <tr key={peer.id} className="border-b border-slate-800 last:border-0 hover:bg-slate-800/40">
                <td className="px-5 py-4">
                  <Link className="font-medium text-sky-400 hover:text-sky-300" href={`/dashboard/peers/${peer.id}`}>
                    {peer.id}
                  </Link>
                  <p className="mt-1 max-w-48 truncate font-mono text-xs text-slate-500">{peer.publicKey}</p>
                </td>
                <td className="px-5 py-4 font-mono text-slate-200">{peer.allocatedIp}/32</td>
                <td className="px-5 py-4">
                  <span className={peer.status === "active" ? "text-emerald-400" : "text-slate-500"}>
                    {peer.status}
                  </span>
                </td>
                <td className="px-5 py-4 text-slate-400">{new Date(peer.createdAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!error && peers.length === 0 && (
          <p className="p-8 text-center text-sm text-slate-400">No peers have been provisioned.</p>
        )}
      </div>
    </div>
  );
}
