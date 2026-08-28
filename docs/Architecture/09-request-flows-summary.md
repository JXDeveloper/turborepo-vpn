# Request Flows Summary

> This document provides a consolidated overview of the primary request flows
> within the VPN platform.
>
> It summarizes how the Client, Control Plane, Database, and Exit Nodes
> collaborate during the normal lifecycle of the system.
>
> Individual workflows are documented in detail elsewhere. This document serves
> as a high-level navigation guide and architectural summary.

---

# Overview

The platform consists of four primary request flows:

1. Initial Provisioning
2. Returning Connection
3. Reprovisioning
4. Subscription Revocation

These workflows together describe the complete operational lifecycle of a VPN
device.

---

# Architecture Overview

```mermaid
flowchart LR

    Client["Client"]

    Control["Control Plane"]

    Database[(Database)]

    Exit["Exit Node"]

    Client --> Control

    Control --> Database

    Control --> Exit

    Client <-->|VPN Tunnel| Exit

    Exit --> Database
```

The Control Plane orchestrates platform operations.

The Exit Node transports VPN traffic.

The Client provides the user experience.

The Database stores persistent platform information.

---

# Workflow Overview

```mermaid
flowchart TD

    Connect["User Presses Connect"]

    Config{"Configuration Exists?"}

    Initial["Initial Provisioning"]

    Direct["Direct Connection"]

    Success{"Connection Successful?"}

    Recovery["Reprovisioning"]

    Connected["VPN Connected"]

    Connect --> Config

    Config -->|No| Initial

    Config -->|Yes| Direct

    Initial --> Connected

    Direct --> Success

    Success -->|Yes| Connected

    Success -->|No| Recovery

    Recovery --> Connected
```

This diagram illustrates the decision points involved in establishing a VPN
connection.

---

# Workflow 1 — Initial Provisioning

## Purpose

Provision a VPN peer for a device that does not yet possess a usable VPN
configuration.

### Participants

- Client
- Control Plane
- Database
- Exit Node

### Summary

```mermaid
sequenceDiagram

    Client->>Control: Provisioning Request

    Control->>Database: Validate Platform State

    Control->>Exit: Provision Peer

    Exit-->>Control: Provisioning Complete

    Control-->>Client: Return Configuration
```

Result:

- Device receives VPN configuration.
- Peer is provisioned.
- Future connections may use the stored configuration.

See:

**03-first-time-provisioning-sequence.md**

---

# Workflow 2 — Returning Connection

## Purpose

Reuse an existing VPN configuration without contacting the Control Plane.

### Participants

- Client
- Exit Node
- Database

### Summary

```mermaid
sequenceDiagram

    Client->>Exit: Connect

    Exit-->>Client: VPN Established

    Exit->>Database: Runtime Information
```

Result:

- Fast connection.
- Minimal infrastructure usage.
- Control Plane remains outside the VPN data path.

See:

**04-returning-connection-sequence.md**

---

# Workflow 3 — Reprovisioning

## Purpose

Recover from a failed VPN connection using an existing device.

### Participants

- Client
- Control Plane
- Database
- Exit Node

### Summary

```mermaid
sequenceDiagram

    Client->>Exit: Connect

    Exit-->>Client: Connection Failure

    Client->>Control: Recovery Request

    Control->>Database: Evaluate State

    Control->>Exit: Evaluate Assignment

    Exit-->>Control: Current Status

    Control-->>Client: Recovery Response

    Client->>Exit: Retry Connection
```

Result:

- Existing assignment may remain valid.
- Configuration may be updated.
- Replacement provisioning may occur.

See:

**05-reprovisioning-sequence.md**

---

# Workflow 4 — Subscription Revocation

## Purpose

Remove VPN access after a subscription is no longer valid.

### Participants

- Billing Provider
- Control Plane
- Database
- Exit Node

### Summary

```mermaid
sequenceDiagram

    Billing->>Control: Subscription Update

    Control->>Database: Update Subscription

    Control->>Database: Locate Devices

    Control->>Exit: Revoke Device Peers

    Exit-->>Control: Revocation Complete
```

Result:

- Device peers are revoked.
- Future provisioning may be denied.
- VPN access is removed.

See:

**06-subscription-revocation-sequence.md**

---

# Platform Lifecycle

```mermaid
flowchart LR

    Provision["Provision"]

    Ready["Ready"]

    Connected["Connected"]

    Disconnected["Disconnected"]

    Recover["Recover"]

    Revoked["Revoked"]

    Provision --> Ready

    Ready --> Connected

    Connected --> Disconnected

    Disconnected --> Connected

    Connected --> Recover

    Disconnected --> Recover

    Recover --> Ready

    Ready --> Revoked

    Connected --> Revoked

    Disconnected --> Revoked
```

This diagram summarizes the conceptual lifecycle described throughout the
architecture documentation.

---

# Component Participation

| Workflow                | Client | Control Plane | Database | Exit Node |
| ----------------------- | :----: | :-----------: | :------: | :-------: |
| Initial Provisioning    |   ✓    |       ✓       |    ✓     |     ✓     |
| Returning Connection    |   ✓    |               |    ✓     |     ✓     |
| Reprovisioning          |   ✓    |       ✓       |    ✓     |     ✓     |
| Subscription Revocation |        |       ✓       |    ✓     |     ✓     |

---

# Domain Relationships

```mermaid
flowchart TD

    User

    Subscription

    Device

    Peer

    ExitNode["Exit Node"]

    Region

    User --> Subscription

    User --> Device

    Device --> Peer

    Peer --> ExitNode

    ExitNode --> Region
```

This ownership hierarchy remains consistent across every workflow described in
the architecture.

---

# Architectural Principles

The workflows presented throughout these documents follow several consistent
principles.

## Simple User Experience

The customer interaction remains consistent:

1. Select a region.
2. Press **Connect**.

Operational complexity remains inside the platform.

---

## Separation of Responsibilities

- Client handles user interaction.
- Control Plane performs orchestration.
- Exit Nodes provide VPN connectivity.
- Database stores persistent platform state.

---

## Device-Oriented Provisioning

Provisioning occurs for devices rather than directly for users.

Devices own peers.

Peers establish VPN connectivity.

---

## Independent Scaling

Each architectural component may scale independently.

Future deployments may contain:

- Multiple Control Plane instances
- Multiple Exit Nodes
- Multiple Regions
- Additional infrastructure services

The conceptual workflows remain unchanged.

---

# Documentation Map

```mermaid
flowchart TD

    D1["01 System Overview"]

    D2["02 Component Responsibilities"]

    D3["03 First-Time Provisioning"]

    D4["04 Returning Connection"]

    D5["05 Reprovisioning"]

    D6["06 Subscription Revocation"]

    D7["07 Domain Model"]

    D8["08 Peer Lifecycle"]

    D9["09 Request Flows Summary"]

    D1 --> D2

    D2 --> D3

    D3 --> D4

    D4 --> D5

    D5 --> D6

    D6 --> D7

    D7 --> D8

    D8 --> D9
```

The documents are intended to be read in this order, progressing from
high-level concepts to detailed workflows and finally to a consolidated
summary.

---

# Complete Connection Journey

```mermaid
journey

    title Typical Customer VPN Journey

    section Initial Setup

      Sign In: 5: User

      Subscription Active: 5: Platform

      Select Region: 5: User

      Initial Provisioning: 4: Platform

    section Daily Usage

      Press Connect: 5: User

      Direct VPN Connection: 5: Platform

      Browse Internet: 5: User

      Disconnect: 5: User

    section Recovery

      Connection Failure: 2: Platform

      Automatic Recovery: 4: Platform

      VPN Restored: 5: Platform

    section Subscription End

      Subscription Ends: 3: Platform

      Peer Revoked: 5: Platform
```

This journey represents the complete conceptual lifecycle of a customer using
the VPN platform.

---

# Final Notes

This architecture documentation intentionally focuses on **conceptual system
design** rather than implementation.

As the platform evolves, implementation details such as APIs, deployment
topology, database schemas, monitoring, security mechanisms, and infrastructure
can change while preserving the architectural concepts documented here.

The goal of these documents is to provide a stable foundation that guides
future development without constraining implementation choices.
