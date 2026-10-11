/**
 * Live WireGuard runtime helpers.
 *
 * The `@shurahbil/wireguard-tools-2` library we use for the config file only
 * knows how to edit wg0.conf and to run `wg-quick up` / `wg-quick down`. It has
 * **no `wg set` support**, so a peer added while the interface is already up
 * exists only on disk: the kernel never answers that peer's handshake and the
 * client hangs until somebody restarts the tunnel.
 *
 * Everything in this module talks to the real kernel state (`wg`, `wg-quick`,
 * `ip`) so the API can:
 *   - hot-register / hot-revoke peers without restarting the interface
 *   - reconcile conf <-> kernel on boot (heals restarts, deploys, manual edits)
 *   - report a status that is measured instead of remembered
 *
 * Every command runs through `execFile` (argument vector, no shell), as root on
 * the EC2 host (see deployment/vpn-exit-node.service) or with NET_ADMIN inside
 * the Docker container.
 */
import { execFile } from "node:child_process";
import fs from "node:fs";

/** A peer as it should exist according to wg0.conf. */
export interface DesiredPeer {
  publicKey?: string;
  allowedIps?: string[];
}

/** A peer as it currently exists in the kernel. */
export interface LivePeer {
  publicKey: string;
  /** `host:port` the last handshake came from, `null` if it never connected. */
  endpoint: string | null;
  allowedIps: string[];
  /** Unix seconds of the last handshake, `0` when it never completed one. */
  latestHandshake: number;
  /** Bytes received / transmitted by the kernel for this peer. */
  rx: number;
  tx: number;
  persistentKeepalive: number;
}

export interface InterfaceState {
  /** `wg` is installed and runnable. */
  available: boolean;
  /** The interface exists in the kernel right now. */
  exists: boolean;
  name: string;
  /** Public key the kernel interface is actually using, `null` when down. */
  publicKey: string | null;
  peers: LivePeer[];
  /** Set when we could not determine the state (permissions, missing tools...). */
  error?: string;
}

export class WgCommandError extends Error {
  readonly command: string;
  readonly stderr: string;
  readonly missingBinary: boolean;

  constructor(command: string, detail: string, missingBinary = false) {
    super(`${command} failed: ${detail}`);
    this.name = "WgCommandError";
    this.command = command;
    this.stderr = detail;
    this.missingBinary = missingBinary;
  }
}

function run(file: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      file,
      args,
      { encoding: "utf8", maxBuffer: 4 * 1024 * 1024, timeout: 15_000 },
      (error, stdout, stderr) => {
        if (!error) {
          resolve(stdout);
          return;
        }
        const code = (error as NodeJS.ErrnoException & { code?: unknown }).code;
        const missing = code === "ENOENT";
        const detail = missing
          ? `\`${file}\` is not installed`
          : (stderr || error.message || "").trim();
        reject(new WgCommandError(`${file} ${args.join(" ")}`, detail, missing));
      },
    );
  });
}

/** Does the interface exist in the kernel right now? */
export async function interfaceExists(name: string): Promise<boolean> {
  try {
    await run("ip", ["link", "show", "dev", name]);
    return true;
  } catch (error) {
    if (error instanceof WgCommandError && error.missingBinary) {
      // iproute2 missing — fall back to wireguard-tools itself.
      try {
        await run("wg", ["show", name]);
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }
}

/**
 * Read the live interface state. Never throws: an interface that is down (or a
 * host without wireguard-tools) is reported through the returned object so the
 * status endpoint can stay truthful without failing.
 */
export async function readInterface(name: string): Promise<InterfaceState> {
  let stdout: string;
  try {
    stdout = await run("wg", ["show", name, "dump"]);
  } catch (error) {
    const detail = error instanceof WgCommandError ? error.message : String(error);
    const missing = error instanceof WgCommandError && error.missingBinary;
    const down = /unable to access interface/i.test(
      error instanceof WgCommandError ? error.stderr : detail,
    );
    return {
      available: !missing,
      exists: false,
      name,
      publicKey: null,
      peers: [],
      ...(missing || down ? {} : { error: detail }),
    };
  }

  // dump format (tab separated), see `wg show ... dump`:
  //   private-key, public-key, listen-port, fwmark
  //   public-key, preshared-key, endpoint, allowed-ips,
  //   latest-handshake, transfer-rx, transfer-tx, persistent-keepalive
  const lines = stdout.split("\n").filter((line) => line.length > 0);
  const interfaceFields = (lines[0] ?? "").split("\t");
  const peers: LivePeer[] = lines.slice(1).map((line) => {
    const fields = line.split("\t");
    return {
      publicKey: fields[0] ?? "",
      endpoint: fields[2] && fields[2] !== "(none)" ? fields[2] : null,
      allowedIps: (fields[3] ?? "").split(",").filter(Boolean),
      latestHandshake: Number(fields[4]) || 0,
      rx: Number(fields[5]) || 0,
      tx: Number(fields[6]) || 0,
      persistentKeepalive: Number(fields[7]) || 0,
    };
  });

  return {
    available: true,
    exists: true,
    name,
    publicKey: interfaceFields[1] || null,
    peers,
  };
}

/** Register a peer in the running interface — takes effect immediately. */
export async function setPeer(
  iface: string,
  publicKey: string,
  allowedIps: string[],
): Promise<void> {
  if (!allowedIps.length) {
    throw new Error(
      `refusing to register peer ${publicKey} without allowed-ips (it could not route anything)`,
    );
  }
  await run("wg", [
    "set",
    iface,
    "peer",
    publicKey,
    "allowed-ips",
    allowedIps.join(","),
  ]);
}

/** Drop a peer from the running interface — it stops working immediately. */
export async function removePeer(iface: string, publicKey: string): Promise<void> {
  await run("wg", ["set", iface, "peer", publicKey, "remove"]);
}

export interface ReconcileResult {
  /** False when the interface is down, so there was nothing to hot-apply to. */
  applied: boolean;
  added: number;
  updated: number;
  removed: number;
  unchanged: number;
  reason?: string;
}

function sameStringSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const left = [...a].sort();
  const right = [...b].sort();
  return left.every((value, index) => value === right[index]);
}

/**
 * Make the kernel match the config file without restarting the interface:
 * peers missing from the kernel are added, peers that were deleted from the
 * conf are dropped, changed allowed-ips are rewritten. Existing peers that
 * already match are left untouched, so live sessions are never disturbed.
 */
export async function reconcilePeers(
  iface: string,
  desired: DesiredPeer[],
): Promise<ReconcileResult> {
  const state = await readInterface(iface);
  const empty = { added: 0, updated: 0, removed: 0, unchanged: 0 };

  if (!state.available) {
    throw new WgCommandError(
      `wg show ${iface}`,
      state.error ?? "wireguard-tools is not installed",
      true,
    );
  }
  if (!state.exists) {
    return {
      applied: false,
      ...empty,
      reason: state.error ?? "interface is down",
    };
  }

  const live = new Map(state.peers.map((peer) => [peer.publicKey, peer]));
  const wanted = new Map<string, string[]>();
  let added = 0;
  let updated = 0;
  let unchanged = 0;

  for (const peer of desired) {
    const publicKey = peer.publicKey?.trim();
    if (!publicKey) continue;
    const allowedIps = (peer.allowedIps ?? []).map((ip) => ip.trim()).filter(Boolean);
    if (!allowedIps.length) continue;
    wanted.set(publicKey, allowedIps);

    const current = live.get(publicKey);
    if (!current) {
      await setPeer(iface, publicKey, allowedIps);
      added += 1;
      continue;
    }
    if (sameStringSet(current.allowedIps, allowedIps)) {
      unchanged += 1;
      continue;
    }
    await setPeer(iface, publicKey, allowedIps);
    updated += 1;
  }

  let removed = 0;
  for (const publicKey of live.keys()) {
    if (wanted.has(publicKey)) continue;
    await removePeer(iface, publicKey);
    removed += 1;
  }

  return { applied: true, added, updated, removed, unchanged };
}

/**
 * `wg-quick up <config>` if the interface is not there yet. Returns what
 * happened so callers can report the truth — and throws the real wg-quick
 * stderr instead of pretending it worked.
 */
export async function bringUp(
  configPath: string,
  iface: string,
): Promise<"created" | "already-up"> {
  if (await interfaceExists(iface)) {
    return "already-up";
  }
  await run("wg-quick", ["up", configPath]);
  return "created";
}

export async function bringDown(
  configPath: string,
  iface: string,
): Promise<"removed" | "already-down"> {
  if (!(await interfaceExists(iface))) {
    return "already-down";
  }
  try {
    await run("wg-quick", ["down", configPath]);
  } catch (error) {
    // wg-quick down re-reads the config for PostDown; if the file moved or was
    // regenerated we still need the link gone. iptables PostDown rules are then
    // left in place (harmless: they only match a now non-existent interface).
    const detail = error instanceof WgCommandError ? error.message : String(error);
    console.warn(`[wireguard] ${detail} — deleting the \`${iface}\` link directly`);
    await run("ip", ["link", "delete", "dev", iface]);
  }
  return "removed";
}

/**
 * Enable IPv4 forwarding so NAT'd client traffic can leave the host. Required
 * on EC2 (the Docker image sets it through `sysctls`, the systemd unit does
 * not) — without it the tunnel handshakes fine and carries no traffic.
 */
export function enableIpForward(): { enabled: boolean; error?: string } {
  try {
    fs.writeFileSync("/proc/sys/net/ipv4/ip_forward", "1\n");
    return { enabled: fs.readFileSync("/proc/sys/net/ipv4/ip_forward", "utf8").trim() === "1" };
  } catch (error) {
    return { enabled: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/** Read-only view of the same setting, for the status endpoint. */
export function readIpForward(): boolean | null {
  try {
    return fs.readFileSync("/proc/sys/net/ipv4/ip_forward", "utf8").trim() === "1";
  } catch {
    return null;
  }
}
