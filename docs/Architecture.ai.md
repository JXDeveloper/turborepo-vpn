```mermaid
sequenceDiagram
  autonumber
  actor Client
  participant CSServer as Control Plane (CSServer)
  participant DataBase as PostgreSQL
  participant ExitNode as Exit Node Agent

  Client->>CSServer: 1. Subscribe / Authenticate & send Client Public Key
  CSServer->>DataBase: 2. Allocate IP & store Peer Record (User ID, PubKey, Allocated IP)
  DataBase-->>CSServer: 3. Return IP Allocation Success
  CSServer->>ExitNode: 4. POST /api/peers (PubKey + Allocated IP)
  ExitNode-->>CSServer: 5. 200 OK (Peer active in kernel memory)
  CSServer-->>Client: 6. Return Config Payload (Server PubKey, Endpoint, Allocated IP)
```

```
┌──────────────────────────────────────────────────────────────┐
│                       POSTGRESQL DB                          │
├──────────────────────────────────────────────────────────────┤
│ 1. IPAM (IP Address Management):                             │
│    Prevents IP collisions by tracking assigned internal IPs  │
│    (e.g., User A gets 10.10.1.2/32, User B gets 10.10.1.3/32)│
│                                                              │
│ 2. Device / Peer Registry:                                   │
│    Stores [user_id, public_key, allocated_ip, is_active]     │
│                                                              │
│ 3. Disaster Recovery / Exit Node Reboots:                    │
│    WireGuard stores peers in volatile kernel memory.         │
│    If an exit node restarts, it boots back up EMPTY!         │
│    The DB allows a boot script to re-populate all peers:     │
│    `SELECT public_key, ip FROM peers WHERE active = true`    │
│                                                              │
│ 4. Subscription State Synchronization:                       │
│    When Stripe fires `invoice.payment_failed`, DB marks      │
│    `is_active = false` and triggers revocation.              │
└──────────────────────────────────────────────────────────────┘
```

1. public key to encrypt traffic going to clients
2. jwt id for verifying its a user
