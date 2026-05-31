# Database Security Guidelines

## Overview

This document defines how sensitive data is stored, accessed, and rotated in the database.

## Sensitive Columns

Encrypted at rest (AES-256-GCM via `@journey/db`):

- `messaging_channels.bot_token_encrypted`
- `messaging_channels.webhook_secret_encrypted`
- `automation_webhooks.secret_key_encrypted`

Hashed for deterministic lookups:

- `messaging_channels.bot_token_hash`
- `messaging_channels.webhook_secret_hash`
- `automation_webhooks.secret_key_hash`

Plaintext (out of scope - managed by Better Auth):

- `account.access_token`
- `account.refresh_token`
- `account.id_token`

## Encryption Requirements

- `ENCRYPTION_KEY` must be set for any environment that reads or writes encrypted secrets.
- New secrets are encrypted on write; existing plaintext values should be backfilled.

## Rotation Plan

1. Set a new `ENCRYPTION_KEY` in a controlled environment.
2. Run a backfill job to decrypt with the old key and re-encrypt with the new key.
3. Verify read/write paths with the new key.
4. Retire the old key.

## Access and Logging Guidelines

- Never log decrypted secrets.
- Prefer hash comparisons for lookups (e.g., bot token uniqueness).
- Limit access to encrypted columns to services that need them.
- Restrict database roles used by analytics/BI from sensitive columns.
