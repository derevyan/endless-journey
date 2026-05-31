# Simulator API Reference

Complete specification for all simulator REST endpoints.

## Table of Contents

- [Authentication](#authentication)
- [POST /api/simulator/sessions](#post-apisimulatorssessions)
- [POST /api/simulator/execute](#post-apisimulatorexecute)
- [GET /api/simulator/sessions/:id/timers](#get-apisimulatorsessionsidtimers)
- [POST /api/simulator/timers/:edgeId/skip](#post-apisimulatortimersedgeidskip)
- [DELETE /api/simulator/sessions/:id](#delete-apisimulatorsessionsid)
- [Personas](#personas)
- [POST /api/simulator/cleanup](#post-apisimulatorcleanup)
- [GET /api/simulator/health](#get-apisimulatorhealth)

---

## Authentication

All simulator endpoints require authentication via Bearer token and organization context.

```http
Authorization: Bearer <access_token>
```

The authenticated user must have access to the organization that owns the journey/persona.

---

## POST /api/simulator/sessions

Start a new simulator session.

### Request

```http
POST /api/simulator/sessions
Content-Type: application/json
Authorization: Bearer <token>
```

#### Body Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `journeyId` | string | Yes | UUID of the journey to simulate |
| `startNodeId` | string | No | Node ID to start from (defaults to start node) |
| `personaId` | string | No | UUID of a persona to reuse |
| `clientProfile` | object | No | Test client profile |
| `clientProfile.firstName` | string | No | First name (default: "Simulator") |
| `clientProfile.lastName` | string | No | Last name (default: "User") |
| `clientProfile.username` | string | No | Username (default: `sim_{timestamp}`) |

#### Example Request

```json
{
  "journeyId": "d290f1ee-6c54-4b01-90e6-d701748f0851",
  "startNodeId": "node-welcome",
  "personaId": "persona-uuid",
  "clientProfile": {
    "firstName": "Test",
    "lastName": "User",
    "username": "testuser123"
  }
}
```

### Response

#### Success (201 Created)

```json
{
  "sessionId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "clientId": "simulator_1704067200000_abc123xyz",
  "journeyId": "d290f1ee-6c54-4b01-90e6-d701748f0851",
  "currentNodeId": "node-after-start",
  "status": "active"
}
```

---

## POST /api/simulator/execute

Send user input to the simulator engine.

### Request

```http
POST /api/simulator/execute
Content-Type: application/json
Authorization: Bearer <token>
```

#### Body Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `sessionId` | string | Yes | UUID of the active session |
| `event` | object | Yes | User input event |
| `event.type` | string | Yes | `text`, `button_click`, or `timeout` |
| `event.text` | string | Conditional | Required when `type="text"` |
| `event.buttonId` | string | Conditional | Required when `type="button_click"` |
| `event.edgeId` | string | Conditional | Required when `type="timeout"` |

#### Example: Text Message

```json
{
  "sessionId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "event": {
    "type": "text",
    "text": "Hello, I need help"
  }
}
```

#### Example: Timeout

```json
{
  "sessionId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "event": {
    "type": "timeout",
    "edgeId": "edge-timeout"
  }
}
```

### Response

```json
{ "success": true }
```

---

## GET /api/simulator/sessions/:id/timers

List active timers for a session.

### Response

```json
{
  "timers": [
    {
      "id": "timer-uuid",
      "edgeId": "edge-timeout",
      "firesAt": "2025-01-01T12:00:00.000Z",
      "createdAt": "2025-01-01T11:55:00.000Z",
      "bullmqJobId": "12345"
    }
  ]
}
```

---

## POST /api/simulator/timers/:edgeId/skip

Skip (fire immediately) a pending timer. This is "time travel" for testing timeout flows.

### Request

```http
POST /api/simulator/timers/{edgeId}/skip
Content-Type: application/json
Authorization: Bearer <token>
```

#### Body Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `sessionId` | string | Yes | UUID of the active session |

### Response

```json
{ "success": true }
```

---

## DELETE /api/simulator/sessions/:id

Cleanup and stop a simulator session.

### Response

```json
{ "success": true }
```

---

## Personas

Personas are reusable test profiles scoped to an organization.

### GET /api/simulator/personas

List personas.

### POST /api/simulator/personas

Create persona.

```json
{
  "name": "High-Intent Buyer",
  "profile": { "firstName": "Alex", "lastName": "Doe" },
  "userVars": { "plan": "enterprise" }
}
```

### GET /api/simulator/personas/:id

Get persona details.

### PUT /api/simulator/personas/:id

Update persona fields (`name`, `profile`, `userVars`).

### DELETE /api/simulator/personas/:id

Delete persona.

### POST /api/simulator/personas/:id/reset

Reset persona data (tags, CRM stages, sessions, variables).

---

## POST /api/simulator/cleanup

Bulk cleanup all simulator test data for the organization.

### Response

```json
{
  "success": true,
  "personasReset": 3,
  "anonymousClientsDeleted": 12,
  "totalTagsDeleted": 42,
  "totalSessionsDeleted": 18
}
```

---

## GET /api/simulator/health

Health check endpoint for monitoring.

### Response

```json
{
  "status": "ok",
  "activeSessions": 3,
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```
