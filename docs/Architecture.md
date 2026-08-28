# Top Level Flow

```mermaid
sequenceDiagram
  Participant Client
  Participant CSServer
  Participant ExitNode
  Participant DataBase

  Client ->> CSServer: Subscribe for vpn service, generate keys and send to Server
  CSServer ->> DataBase: Write User Public key and id to Database
  CSServer ->> ExitNode: Create Peer with user provided keys
  ExitNode ->> CSServer: Reply with required info to create peer in client configs
  CSServer ->> Client: give configs to client
```

## Why DB

1. It will be used to store user keys etc to update peer config ih for any reason previous configs curropt

# VPN Infrastructure Architecture

This document describes the system architecture, component interactions, sequence flows, and database responsibilities for the WireGuard VPN control plane and exit node infrastructure.

---

## 1. System Overview

```mermaid
flowchart LR
    subgraph Client App
        Mobile[Android / React App]
    end

    subgraph Control Plane
        API[Hono API Server]
        DB[(PostgreSQL)]
    end

    subgraph Infrastructure
        ExitNode[WireGuard Exit Node]
    end

    Mobile -->|1. Auth & Send PubKey| API
    API -->|2. Allocate IP & Store Peer| DB
    API -->|3. Provision Peer API| ExitNode
    Mobile -.->|4. Encrypted UDP Tunnel| ExitNode
```

```mermaid
sequenceDiagram
  autonumber
  actor Client as Mobile Client
  participant CSServer as Control Plane (Hono)
  participant DataBase as PostgreSQL
  participant ExitNode as Exit Node Agent

  Client->>Client: 1. Generate local X25519 Keypair (@noble/curves)
  Client->>CSServer: 2. POST /api/peers (publicKey)

  rect rgb(20, 20, 20)
    Note over CSServer,DataBase: IPAM & Persistence Phase
    CSServer->>DataBase: 3. Select next free IP & insert peer record
    DataBase-->>CSServer: 4. Confirm DB insert (e.g., 10.10.1.5/32)
  end

  rect rgb(40, 40, 40)
    Note over CSServer,ExitNode: Runtime Kernel Sync
    CSServer->>ExitNode: 5. POST /api/peers (publicKey, allocatedIp)
    ExitNode->>ExitNode: Exec: wg set wg0 peer <pubkey> allowed-ips 10.10.1.5/32
    ExitNode-->>CSServer: 6. 200 OK
  end

  CSServer-->>Client: 7. Return Server PubKey, Endpoint IP, Allocated IP
  Client->>ExitNode: 8. Handshake & Establish UDP WireGuard Tunnel
```

```mermaid
sequenceDiagram
  autonumber
  actor Node as Rebooted Exit Node
  participant Agent as Hono Exit Node Agent
  participant CSServer as Control Plane API
  participant DataBase as PostgreSQL

  Node->>Agent: Systemd boots wg-agent.service
  Agent->>CSServer: POST /api/nodes/sync (Node ID + Bearer Token)
  CSServer->>DataBase: SELECT public_key, allocated_ip FROM vpn_peers WHERE is_active = true
  DataBase-->>CSServer: Return active peers array
  CSServer-->>Agent: JSON array of active peers
  loop For each peer
    Agent->>Agent: Execute wg set wg0 peer <pubkey> allowed-ips <ip>
  end
  Agent-->>Node: All peers restored to Linux kernel memory
```

## Exit Node

1. create peer
2. revoke peer
3. handshake with client
