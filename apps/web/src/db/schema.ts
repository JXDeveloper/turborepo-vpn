import {
  pgTable,
  text,
  integer,
  uuid,
  timestamp,
  pgEnum,
  boolean,
  index,
} from "drizzle-orm/pg-core";

/**
 * Desired operational state of an exit node.
 *
 * This is controlled by the control plane.
 * Actual reachability is tracked separately by `online`.
 */
export const ExitNodeStatus = pgEnum("exit_node_status", [
  "up",
  "down",
  "maintenance",
  "draining",
]);

/**
 * Lifecycle state of a WireGuard peer.
 */
export const peerStatus = pgEnum("peer_status", [
  "active",
  "inactive",
  "revoked",
]);

export const devicePlatform = pgEnum("device_platform", [
  "windows",
  "macos",
  "linux",
  "android",
  "ios",
]);

export const deviceStatus = pgEnum("device_status", [
  "active",
  "revoked",
  "pending",
]);

export const deviceType = pgEnum("device_type", [
  "desktop",
  "laptop",
  "phone",
  "tablet",
  "server",
]);

/**
 * Why a peer was assigned or migrated to another exit node.
 * Useful for auditing and debugging scheduler decisions.
 */
export const assignmentReason = pgEnum("assignment_reason", [
  "initial",
  "manual",
  "failover",
  "maintenance",
  "load_balancing",
  "user_selected",
]);

/**
 * Snapshot of the current state of every exit node.
 *
 * This table stores the latest metrics only.
 * Historical metrics should be stored in a monitoring system.
 */
export const exitNodes = pgTable("exit_nodes", {
  id: uuid("id").defaultRandom().primaryKey(),

  /** Human-friendly name (e.g. fra-01). */
  hostname: text("hostname").notNull().unique(),

  /** WireGuard public key of the server. */
  publicKey: text("public_key").notNull().unique(),

  /** Public IPv4/IPv6 address of the exit node. */
  publicIp: text("public_ip").notNull().unique(),

  /** WireGuard listening port. */
  portNo: integer("port_no").notNull(),

  /** Desired operational state controlled by the control plane. */
  status: ExitNodeStatus("status").notNull().default("down"),

  /** Geographic location shown to users. */
  country: text("country").notNull().default("Unknown"),
  region: text("region").notNull().default("Unknown"),

  /** Scheduler metrics. Define units consistently. */
  connectionLoad: integer("connection_load").notNull().default(0),
  bandwidthLoad: integer("bandwidth_load").notNull().default(0),

  /** Last successful heartbeat received from the node agent. */
  lastHeartbeat: timestamp("last_heartbeat", {
    withTimezone: true,
  })
    .defaultNow()
    .notNull(),

  /** Maximum peers this node should serve. */
  maxPeers: integer("max_peers").notNull().default(0),

  /** Latest health metrics reported by the node agent. */
  latencyMs: integer("latency_ms").notNull().default(0),
  cpuUsage: integer("cpu_usage").notNull().default(0),
  memoryUsage: integer("memory_usage").notNull().default(0),

  /** Peer counters. Keep semantics well-defined. */
  activePeers: integer("active_peers").notNull().default(0),
  totalPeers: integer("total_peers").notNull().default(0),
  connectedPeers: integer("connected_peers").notNull().default(0),

  /** Actual reachability based on heartbeats. */
  online: boolean("online").notNull().default(false),

  /** Reported software versions. */
  wireguardVersion: text("wireguard_version").notNull().default("Unknown"),
  agentVersion: text("agent_version").notNull().default("Unknown"),
});

/**
 * One WireGuard peer owned by a Clerk user.
 */
export const peers = pgTable(
  "peers",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    /** device id */
    deviceId: uuid("device_id")
      .notNull()
      .references(() => devices.id, { onDelete: "cascade" }),

    /** WireGuard public key for this device/peer. */
    publicKey: text("public_key").notNull().unique(),

    /** Allocated VPN address. */
    allocatedIp: text("allocated_ip").notNull().unique(),

    status: peerStatus("status").notNull().default("inactive"),

    createdAt: timestamp("created_at", {
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("clerk_user_id_index").on(table.deviceId),
    index("allocated_ip_index").on(table.allocatedIp),
  ],
);

/**
 * Current peer -> exit node mapping.
 *
 * One active assignment per peer.
 */
export const currentAssignments = pgTable("current_assignments", {
  peerId: uuid("peer_id")
    .primaryKey()
    .references(() => peers.id, { onDelete: "cascade" }),

  exitNodeId: uuid("exit_node_id")
    .notNull()
    .references(() => exitNodes.id, { onDelete: "cascade" }),

  assignedAt: timestamp("assigned_at", {
    withTimezone: true,
  })
    .defaultNow()
    .notNull(),

  /** Who performed the assignment (scheduler, admin, etc.). */
  assignedBy: text("assigned_by").notNull().default("scheduler"),
});

/**
 * Immutable audit log of peer assignments.
 *
 * A new row should be inserted for every migration.
 * Existing rows should only receive `revokedAt`.
 */
export const assignmentHistory = pgTable("assignment_history", {
  id: uuid("id").defaultRandom().primaryKey(),

  peerId: uuid("peer_id")
    .notNull()
    .references(() => peers.id, { onDelete: "cascade" }),

  exitNodeId: uuid("exit_node_id")
    .notNull()
    .references(() => exitNodes.id, { onDelete: "cascade" }),

  assignedAt: timestamp("assigned_at", {
    withTimezone: true,
  })
    .defaultNow()
    .notNull(),

  /** NULL means this assignment is still active in history. */
  revokedAt: timestamp("revoked_at", {
    withTimezone: true,
  }),

  /** Why the assignment occurred. */
  reason: assignmentReason("reason").notNull().default("initial"),
});

export const devices = pgTable(
  "devices",
  {
    /** Unique identifier for the device. Genrated by server */
    id: uuid("id").defaultRandom().primaryKey(),

    /** Unique identifier for the device. Genrerated by client */
    deviceIdentifier: text("device_id").notNull().unique(),

    /** user id which device belongs to. */
    clerkUserId: text("clerk_user_id").notNull(),

    /** Device name (e.g. "iPhone", "Laptop"). */
    name: text("name").notNull(),

    /** Device type (e.g. "mobile", "desktop"). */
    type: deviceType("type").notNull(),

    /** Device platform (e.g. "iOS", "Windows"). */
    platform: devicePlatform("platform").notNull(),

    /** Device model (e.g. "iPhone 14 Pro", "MacBook Pro"). */
    model: text("model"),

    /** Device status (e.g. "active", "revoked"). */
    status: deviceStatus("status").notNull().default("active"),

    /** Last time the device was seen online. */
    lastSeenAt: timestamp("last_seen_at", {
      withTimezone: true,
    }),

    createdAt: timestamp("created_at", {
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
  },
  (policy) => [index("user_id_index").on(policy.clerkUserId)],
);
