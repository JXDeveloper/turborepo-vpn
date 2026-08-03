"use client";

import Link from "next/link";
import { Show, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";
import { getExitNodes } from "./action";
import { useState, useEffect, useTransition } from "react";
import Navbar from "@/components/navbar";

export default function Home() {
  const [_, startTransition] = useTransition();
  useEffect(() => {
    startTransition(async () => {
      const exitNodes = await getExitNodes();
      console.log(exitNodes);
    });
  }, []);
  return (
    <main className="min-h-screen overflow-hidden bg-background text-foreground">
      <Navbar>
        <div className="flex items-center justify-between">
          <Link href="/" className="font-semibold tracking-tight text-primary">
            VPN Control Panel
          </Link>
          <div className="flex items-center gap-3">
            <Show when="signed-out">
              <SignInButton>
                <button
                  type="button"
                  className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
                >
                  Sign in
                </button>
              </SignInButton>
              <SignUpButton>
                <button
                  type="button"
                  className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
                >
                  Create account
                </button>
              </SignUpButton>
            </Show>
            <Show when="signed-in">
              <Link
                href="/dashboard"
                className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
              >
                Open dashboard
              </Link>
              <UserButton />
            </Show>
          </div>
        </div>
      </Navbar>

      <section className="mx-auto grid max-w-6xl gap-12 px-5 pb-20 pt-30 lg:grid-cols-[1.2fr_0.8fr] lg:items-center lg:pt-28">
        <div>
          <p className="inline-flex rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
            WireGuard exit-node administration
          </p>
          <h1 className="mt-6 max-w-3xl text-5xl font-bold tracking-tight text-foreground sm:text-6xl">
            Operate your VPN without losing sight of the network.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">
            Provision peers, distribute secure WireGuard configurations, and
            manage the live exit-node tunnel from one protected control panel.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Show when="signed-out">
              <SignUpButton>
                <button
                  type="button"
                  className="rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
                >
                  Get started
                </button>
              </SignUpButton>
              <SignInButton>
                <button
                  type="button"
                  className="rounded-lg border border-border bg-background px-5 py-3 text-sm font-semibold text-foreground hover:border-border/80 hover:bg-muted"
                >
                  Sign in to dashboard
                </button>
              </SignInButton>
            </Show>
            <Show when="signed-in">
              <Link
                href="/dashboard"
                className="rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
              >
                Open dashboard
              </Link>
            </Show>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card/80 p-6 shadow-2xl shadow-primary/10">
          <div className="flex items-center justify-between border-b border-border pb-5">
            <div>
              <p className="text-sm text-muted-foreground">Exit node</p>
              <p className="mt-1 font-semibold text-foreground">wg0</p>
            </div>
            <span className="rounded-full bg-success/10 px-3 py-1 text-sm font-medium text-success">
              Operational
            </span>
          </div>
          <dl className="mt-6 space-y-5 text-sm">
            <StatusRow label="Peer lifecycle" value="Provision and revoke" />
            <StatusRow
              label="Configuration delivery"
              value="QR code + WireGuard config"
            />
            <StatusRow
              label="Tunnel controls"
              value="Protected operator actions"
            />
          </dl>
        </div>
      </section>

      <section className="border-t border-border bg-card/40">
        <div className="mx-auto grid max-w-6xl gap-6 px-5 py-14 md:grid-cols-3">
          <Feature
            title="Peer management"
            description="Create, inspect, and revoke client access without editing tunnel configuration files by hand."
          />
          <Feature
            title="Safe configuration hand-off"
            description="Present a one-time client configuration and QR code ready for the official WireGuard apps."
          />
          <Feature
            title="Live node visibility"
            description="See endpoint, interface, tunnel state, and active peer count in the dashboard."
          />
        </div>
      </section>
    </main>
  );
}

function StatusRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium text-foreground">{value}</dd>
    </div>
  );
}

function Feature({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <article className="rounded-xl border border-border bg-card/70 p-5">
      <h2 className="font-semibold text-foreground">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        {description}
      </p>
    </article>
  );
}
