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
      .catch((cause: unknown) =>
        setError(
          cause instanceof Error ? cause.message : "Unable to load peers.",
        ),
      );
  }, []);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-primary">WireGuard clients</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">
            Peers
          </h1>
        </div>
        <Link
          href="/dashboard/peers/new"
          className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
        >
          Create peer
        </Link>
      </div>
      {error && (
        <p className="mt-6 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="mt-8 overflow-hidden rounded-xl border border-border bg-card">
        <table className="w-full text-left text-[0.8125rem] leading-5">
          <thead className="border-b border-border text-muted-foreground">
            <tr>
              <th className="px-5 py-3 font-medium">Peer</th>
              <th className="px-5 py-3 font-medium">Address</th>
              <th className="px-5 py-3 font-medium">Status</th>
              <th className="px-5 py-3 font-medium">Created</th>
            </tr>
          </thead>
          <tbody>
            {peers.map((peer) => (
              <tr
                key={peer.id}
                className="border-b border-border hover:bg-muted/40"
              >
                <td className="px-5 py-4">
                  <Link
                    className="font-medium text-primary hover:text-primary/80"
                    href={`/dashboard/peers/${peer.id}`}
                  >
                    {peer.id}
                  </Link>
                  <p className="mt-1 max-w-48 truncate font-mono text-xs text-muted-foreground">
                    {peer.publicKey}
                  </p>
                </td>
                <td className="px-5 py-4 font-mono text-foreground">
                  {peer.allocatedIp}/32
                </td>
                <td className="px-5 py-4">
                  <span
                    className={
                      peer.status === "active"
                        ? "text-success"
                        : "text-muted-foreground"
                    }
                  >
                    {peer.status}
                  </span>
                </td>
                <td className="px-5 py-4 text-muted-foreground">
                  {new Date(peer.createdAt).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!error && peers.length === 0 && (
          <p className="p-8 text-center text-sm text-muted-foreground">
            No peers have been provisioned.
          </p>
        )}
      </div>
    </div>
  );
}
