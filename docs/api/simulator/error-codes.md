# Simulator Error Codes

Error handling guide for the simulator API.

## Table of Contents

- [Error Response Format](#error-response-format)
- [HTTP Status Codes](#http-status-codes)
- [Error Catalog](#error-catalog)
- [Session Expiration](#session-expiration)
- [Validation Errors](#validation-errors)
- [Troubleshooting](#troubleshooting)

---

## Error Response Format

All errors return a JSON response with `error`, `code`, and `requestId`:

```json
{
  "error": "Human-readable error message",
  "code": "NOT_FOUND",
  "requestId": "req-uuid"
}
```

Validation errors include additional details:

```json
{
  "error": "Invalid request",
  "code": "VALIDATION_ERROR",
  "requestId": "req-uuid",
  "details": {
    "fieldName": ["Error message for this field"]
  }
}
```

---

## HTTP Status Codes

| Status | Meaning | Typical Cause |
|--------|---------|---------------|
| 400 | Bad Request | Missing required field or validation failed |
| 401 | Unauthorized | Missing or invalid authentication token |
| 404 | Not Found | Session expired or resource doesn't exist |
| 500 | Internal Server Error | Unexpected server error |

---

## Error Catalog

### POST /api/simulator/sessions

| Error | Status | Cause | Solution |
|-------|--------|-------|----------|
| `journeyId is required` | 400 | Missing journeyId in request body | Include `journeyId` field |
| `Journey not found or access denied: {id}` | 500 | Journey doesn't exist or belongs to different org | Verify journeyId and org membership |
| `Journey is not active: {id} (status: {status})` | 500 | Journey status is not "active" | Activate the journey first |
| `No start node found in journey: {id}` | 500 | Journey configuration has no start node | Add a start node to the journey |

**Example Error:**
```json
{
  "error": "Journey not found or access denied: d290f1ee-6c54-4b01-90e6-d701748f0851"
}
```

### POST /api/simulator/execute

| Error | Status | Cause | Solution |
|-------|--------|-------|----------|
| `Invalid request` | 400 | Zod validation failed | Check `details.fieldErrors` for specifics |
| `Session not found or expired` | 404 | Session timed out or doesn't exist | Create a new session |

**Validation Error Example:**
```json
{
  "error": "Invalid request",
  "details": {
    "sessionId": ["Session ID is required"],
    "event": ["Invalid discriminator value. Expected 'text' | 'button_click' | 'timeout'"]
  }
}
```

### GET /api/simulator/sessions/:id/timers

| Error | Status | Cause | Solution |
|-------|--------|-------|----------|
| `Session not found or expired` | 404 | Session timed out or doesn't exist | Create a new session |

### POST /api/simulator/timers/:edgeId/skip

| Error | Status | Cause | Solution |
|-------|--------|-------|----------|
| `sessionId is required` | 400 | Missing sessionId in request body | Include `sessionId` field |
| `Session not found or expired` | 404 | Session timed out or doesn't exist | Create a new session |
| `Timer not found or already fired` | 404 | No active timer with this edgeId | Refresh debug state; timer may have fired |

**Example Error:**
```json
{
  "error": "Timer not found or already fired"
}
```

### DELETE /api/simulator/sessions/:id

This endpoint rarely returns errors - cleanup is best-effort.

| Error | Status | Cause | Solution |
|-------|--------|-------|----------|
| `Internal server error` | 500 | Unexpected error during cleanup | Check server logs |

### Persona Endpoints

#### POST /api/simulator/personas

| Error | Status | Cause | Solution |
|-------|--------|-------|----------|
| `Invalid request` | 400 | Validation failed | Check `details` for specifics |
| `A persona with this name already exists` | 409 | Unique name constraint | Use a different name |

#### GET/PUT/DELETE /api/simulator/personas/:id

| Error | Status | Cause | Solution |
|-------|--------|-------|----------|
| `Persona not found` | 404 | Persona ID not in org | Verify persona ID |

#### POST /api/simulator/personas/:id/reset

| Error | Status | Cause | Solution |
|-------|--------|-------|----------|
| `Persona not found` | 404 | Persona ID not in org | Verify persona ID |

---

## Session Expiration

### Timeout Behavior

Sessions expire after **30 minutes of inactivity**:

- Timeout resets on every API call (execute, skip timer, get session)
- Creating a session resets its timeout
- Expired sessions are removed from the in-memory cache

### Detection

When a session expires, all API calls return:

```json
{
  "error": "Session not found or expired"
}
```

Status code: **404**

### Resolution

1. Create a new session with POST `/api/simulator/sessions`
2. Reconnect SSE (if disconnected)
3. Resume testing from the start

### Prevention

- Keep sending heartbeat requests if idle
- Handle 404 errors by prompting user to restart
- Consider implementing session resumption from database state

---

## Validation Errors

### Zod Schema Validation

The `/api/simulator/execute` endpoint uses Zod for strict validation:

```typescript
// Valid text event
{ "type": "text", "text": "Hello" }

// Valid button click event
{ "type": "button_click", "buttonId": "btn-yes" }
```

### Common Validation Errors

#### Missing Required Field

```json
// Request
{ "sessionId": "abc-123" }

// Response
{
  "error": "Invalid request",
  "details": {
    "event": ["Required"]
  }
}
```

#### Invalid Event Type

```json
// Request
{
  "sessionId": "abc-123",
  "event": { "type": "invalid" }
}

// Response
{
  "error": "Invalid request",
  "details": {
    "event": ["Invalid discriminator value. Expected 'text' | 'button_click'"]
  }
}
```

#### Empty Text

```json
// Request
{
  "sessionId": "abc-123",
  "event": { "type": "text", "text": "" }
}

// Response
{
  "error": "Invalid request",
  "details": {
    "event": {
      "text": ["Text message cannot be empty"]
    }
  }
}
```

#### Missing Button ID

```json
// Request
{
  "sessionId": "abc-123",
  "event": { "type": "button_click" }
}

// Response
{
  "error": "Invalid request",
  "details": {
    "event": {
      "buttonId": ["Button ID is required"]
    }
  }
}
```

---

## Troubleshooting

### Session Immediately Expires

**Symptom**: Session works for a few seconds then returns 404

**Possible Causes**:
1. Server restarted (in-memory cache cleared)
2. Another instance handling requests (load balancer)
3. Clock skew between server and database

**Solution**:
- Sessions are recreated from DB if cache miss
- Check if journey is still active
- Verify database connection

### Timer Not Found

**Symptom**: Skip timer returns "Timer not found or already fired"

**Possible Causes**:
1. Timer already fired naturally
2. User responded before timeout (timer cancelled)
3. Using wrong edgeId
4. Session was recreated (different timer IDs)

**Solution**:
- Check `_debug.pendingTimers` for active timer edgeIds
- Use the exact `edgeId` from `simulator.timer_scheduled` event
- Verify timer hasn't already fired via SSE events

### No SSE Events Received

**Symptom**: Session starts but no events arrive

**Possible Causes**:
1. SSE not connected before session creation
2. Not filtering by correct sessionId
3. Redis pub/sub not configured
4. CORS blocking SSE connection

**Solution**:
1. Connect SSE before calling POST /sessions
2. Verify sessionId matches events
3. Check Redis connection in server logs
4. Check browser console for CORS errors

### Validation Errors on Valid-Looking Input

**Symptom**: Execute returns 400 even with correct-looking payload

**Possible Causes**:
1. Using camelCase instead of snake_case (or vice versa)
2. Extra fields being validated
3. Type mismatch (number vs string)

**Solution**:
- Use exact field names from schema
- `type`: `"text"` or `"button_click"`
- `text`: string (for text type)
- `buttonId`: string (for button_click type)

---

## Logging

Server logs include detailed error information:

```
simulator:sessions:error { err: { message, stack }, journeyId }
simulator:execute:error { err: { message, stack }, sessionId }
simulator:timers:skip:error { err, sessionId, edgeId }
```

Check server logs with:
- `journeyId` - for session creation errors
- `sessionId` - for execution/timer errors
- `edgeId` - for timer-specific errors

---

## Source Files

| File | Purpose |
|------|---------|
| `apps/api/src/modules/simulator/routes/index.ts` | Error response generation |
| `packages/schemas/src/simulator.ts` | Zod validation schemas |
