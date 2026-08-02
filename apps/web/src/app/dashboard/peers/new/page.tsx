"use client";

import Link from "next/link";
import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { createPeer, type CreatedPeer } from "../../../action";

export default function NewPeerPage() {
  const [result, setResult] = useState<CreatedPeer | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleCreate() {
    setLoading(true);
    setError("");
    try {
      setResult(await createPeer());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to create peer.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-4xl">
      <Link href="/dashboard/peers" className="text-sm text-sky-400 hover:text-sky-300">
        ← All peers
      </Link>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">Create peer</h1>
      <p className="mt-3 text-[15px] leading-7 text-slate-400">
        Create a WireGuard client configuration and import it into the official client using its QR code.
      </p>
      {!result && (
        <section className="mt-8 rounded-xl border border-slate-800 bg-slate-900 p-6">
          <h2 className="font-semibold">New client configuration</h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            The client keypair is created server-side for this request. Save the resulting configuration now; its
            private key is not retained by the control panel.
          </p>
          {error && (
            <p className="mt-4 rounded-lg border border-red-900 bg-red-950/40 p-3 text-sm text-red-200">{error}</p>
          )}
          <button
            type="button"
            onClick={handleCreate}
            disabled={loading}
            className="mt-6 rounded-lg bg-sky-500 px-4 py-2.5 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Creating peer…" : "Create configuration"}
          </button>
        </section>
      )}
      {result && (
        <section className="mt-8 rounded-xl border border-emerald-900/70 bg-slate-900 p-6">
          <p className="text-sm font-medium text-emerald-400">Peer created</p>
          <h2 className="mt-1 text-xl font-semibold">{result.peer.allocatedIp}/32</h2>
          <div className="mt-6 flex flex-wrap gap-8">
            <div className="rounded-xl bg-white p-4">
              <QRCodeSVG value={result.clientConfig} size={220} level="M" />
            </div>
            <div className="min-w-72 flex-1">
              <p className="text-sm text-slate-400">
                Scan this code from the WireGuard mobile or desktop app, or copy the configuration below. Treat it like
                a password.
              </p>
              <textarea
                readOnly
                value={result.clientConfig}
                rows={13}
                className="mt-4 w-full rounded-lg border border-slate-700 bg-slate-950 p-3 font-mono text-xs text-sky-200"
              />
              <Link
                href={`/dashboard/peers/${result.peer.id}`}
                className="mt-4 inline-block text-sm font-medium text-sky-400 hover:text-sky-300"
              >
                View peer details →
              </Link>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
