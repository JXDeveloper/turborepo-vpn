"use client";

import { useEffect, useState } from "react";
import { getTunnelStatus, setTunnelState, type TunnelStatus } from "../../action";

export default function TunnelPage() {
  const [status, setStatus] = useState<TunnelStatus | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const refresh = () =>
    getTunnelStatus()
      .then(setStatus)
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Unable to load tunnel status."));
  useEffect(() => {
    refresh();
  }, []);
  async function changeState(nextState: "up" | "down") {
    setLoading(true);
    setError("");
    try {
      await setTunnelState(nextState);
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to update tunnel.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-3xl">
      <p className="text-sm font-medium text-sky-400">WireGuard interface</p>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">Exit node</h1>
      <p className="mt-3 text-[15px] leading-7 text-slate-400">The controls below change the live wg0 interface on the exit node.</p>
      {error && <p className="mt-6 rounded-lg border border-red-900 bg-red-950/40 p-4 text-sm text-red-200">{error}</p>}
      <section className="mt-8 rounded-xl border border-slate-800 bg-slate-900 p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-400">Current status</p>
            <p
              className={
                status?.status === "active"
                  ? "mt-1 text-[1.65rem] font-semibold tracking-tight text-emerald-400"
                  : "mt-1 text-[1.65rem] font-semibold tracking-tight text-amber-300"
              }
            >
              {status?.status || "Loading…"}
            </p>
          </div>
          <button type="button" onClick={refresh} className="text-sm text-sky-400 hover:text-sky-300">
            Refresh
          </button>
        </div>
        <dl className="mt-8 grid gap-5 sm:grid-cols-2">
          <Info label="Endpoint" value={status?.endpoint || "—"} />
          <Info label="WAN interface" value={status?.wanInterface || "—"} />
          <Info label="Active peers" value={String(status?.activePeers ?? "—")} />
        </dl>
        <div className="mt-8 flex gap-3">
          <button
            type="button"
            disabled={loading || status?.status === "active"}
            onClick={() => changeState("up")}
            className="rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-slate-950 disabled:opacity-50"
          >
            Bring up
          </button>
          <button
            type="button"
            disabled={loading || status?.status === "inactive"}
            onClick={() => changeState("down")}
            className="rounded-lg border border-red-900 px-4 py-2.5 text-sm font-semibold text-red-300 disabled:opacity-50"
          >
            Bring down
          </button>
        </div>
      </section>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-sm text-slate-400">{label}</dt>
      <dd className="mt-1 font-medium">{value}</dd>
    </div>
  );
}
