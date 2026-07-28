"use client";

import Link from "next/link";
import { Show, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";

export default function Home() {
  return (
    <main className="min-h-screen overflow-hidden bg-slate-950 text-slate-100">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <Link href="/" className="font-semibold tracking-tight text-sky-400">
          VPN Control Panel
        </Link>
        <div className="flex items-center gap-3">
          <Show when="signed-out">
            <SignInButton>
              <button type="button" className="rounded-lg px-3 py-2 text-sm font-medium text-slate-300 hover:text-white">Sign in</button>
            </SignInButton>
            <SignUpButton>
              <button type="button" className="rounded-lg bg-sky-500 px-3 py-2 text-sm font-semibold text-slate-950 hover:bg-sky-400">Create account</button>
            </SignUpButton>
          </Show>
          <Show when="signed-in">
            <Link href="/dashboard" className="rounded-lg bg-sky-500 px-3 py-2 text-sm font-semibold text-slate-950 hover:bg-sky-400">Open dashboard</Link>
            <UserButton />
          </Show>
        </div>
      </header>

      <section className="mx-auto grid max-w-6xl gap-12 px-5 pb-20 pt-20 lg:grid-cols-[1.2fr_0.8fr] lg:items-center lg:pt-28">
        <div>
          <p className="inline-flex rounded-full border border-sky-900 bg-sky-950/60 px-3 py-1 text-sm font-medium text-sky-300">WireGuard exit-node administration</p>
          <h1 className="mt-6 max-w-3xl text-5xl font-bold tracking-tight text-white sm:text-6xl">Operate your VPN without losing sight of the network.</h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-400">Provision peers, distribute secure WireGuard configurations, and manage the live exit-node tunnel from one protected control panel.</p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Show when="signed-out">
              <SignUpButton>
                <button type="button" className="rounded-lg bg-sky-500 px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-sky-400">Get started</button>
              </SignUpButton>
              <SignInButton>
                <button type="button" className="rounded-lg border border-slate-700 px-5 py-3 text-sm font-semibold text-slate-200 hover:border-slate-500 hover:bg-slate-900">Sign in to dashboard</button>
              </SignInButton>
            </Show>
            <Show when="signed-in">
              <Link href="/dashboard" className="rounded-lg bg-sky-500 px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-sky-400">Open dashboard</Link>
            </Show>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-2xl shadow-sky-950/30">
          <div className="flex items-center justify-between border-b border-slate-800 pb-5"><div><p className="text-sm text-slate-400">Exit node</p><p className="mt-1 font-semibold">wg0</p></div><span className="rounded-full bg-emerald-950 px-3 py-1 text-sm font-medium text-emerald-400">Operational</span></div>
          <dl className="mt-6 space-y-5 text-sm"><StatusRow label="Peer lifecycle" value="Provision and revoke" /><StatusRow label="Configuration delivery" value="QR code + WireGuard config" /><StatusRow label="Tunnel controls" value="Protected operator actions" /></dl>
        </div>
      </section>

      <section className="border-t border-slate-900 bg-slate-900/40"><div className="mx-auto grid max-w-6xl gap-6 px-5 py-14 md:grid-cols-3"><Feature title="Peer management" description="Create, inspect, and revoke client access without editing tunnel configuration files by hand." /><Feature title="Safe configuration hand-off" description="Present a one-time client configuration and QR code ready for the official WireGuard apps." /><Feature title="Live node visibility" description="See endpoint, interface, tunnel state, and active peer count in the dashboard." /></div></section>
    </main>
  );
}

function StatusRow({ label, value }: { label: string; value: string }) {
  return <div className="flex items-start justify-between gap-4"><dt className="text-slate-400">{label}</dt><dd className="text-right font-medium text-slate-200">{value}</dd></div>;
}

function Feature({ title, description }: { title: string; description: string }) {
  return <article className="rounded-xl border border-slate-800 bg-slate-950/60 p-5"><h2 className="font-semibold text-slate-100">{title}</h2><p className="mt-2 text-sm leading-6 text-slate-400">{description}</p></article>;
}
