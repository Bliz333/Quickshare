# QuickShare Mobile Architecture

## Executive Summary

QuickShare can support a mobile app without a backend rewrite.

The current backend already provides:

- JWT-based auth
- file upload/download
- share links and pickup flows
- netdisk APIs
- WebSocket-based pairing and discovery foundations

The main constraint is the **current frontend transport model**, which is strongly browser-shaped.

## Current Backend Strengths

The existing backend is already reusable for mobile clients because it is largely based on:

- stateless HTTP APIs
- JWT authentication
- public share endpoints
- authenticated user file APIs
- WebSocket signaling

This means a mobile client can reuse the server-side foundation instead of requiring a new backend from scratch.

## Main Mobile Routes

### Option A — PWA / wrapper-first

Examples: PWA, Capacitor, Ionic shell, lightweight WebView wrapper.

**Pros**

- fastest path to stores
- reuses most existing frontend assets
- low initial cost

**Cons**

- inherits browser limitations
- background transfer is weak
- device discovery and direct transfer remain browser-constrained
- long-term UX is less native

**Best when**

- you want a quick MVP
- main goal is easy install/distribution
- native integrations are limited

### Option B — dedicated mobile client on top of current backend

Examples: Flutter, React Native, or native Android/iOS apps.

**Pros**

- best long-term product shape
- backend can mostly be reused
- native file handling, notifications, and device integration are much cleaner
- easier to evolve toward robust mobile transfer flows

**Cons**

- UI must be rebuilt
- testing matrix is larger
- release and store operations become ongoing work

**Best when**

- you want a real app, not just a wrapped website
- you care about smoother upload/download/share/device flows
- you plan to invest in mobile as a real product surface

### Option C — full parity with browser QuickDrop on day one

This is not a separate client technology choice; it is a scope choice.

**Pros**

- strongest feature story if achieved

**Cons**

- highest risk
- most transport-specific work
- most likely to slow first release

**Recommendation**: do not make this the day-one requirement.

## Current Implementation Update

The tracked repository has already moved beyond pure planning:

- the Expo mobile client exists under `mobile/`
- generated native Android and iOS projects exist under `mobile/android/` and `mobile/ios/`
- mobile direct-transfer groundwork is implemented, including:
  - RTC config fetch
  - direct-session creation
  - WebSocket signaling client
  - local peer-connection and data-channel setup
  - packet protocol encode/decode
  - incoming chunk persistence / assembly
  - backend direct-attempt sync

That means QuickShare is no longer deciding whether to start mobile direct-transfer work; it is deciding how much further to harden and validate the current tracked implementation.

## Current Product Shape

### Sequence already reflected in the tracked baseline

1. **A dedicated mobile client route was chosen** on top of the current backend
2. **Core account and file flows were implemented first**
3. **Same-account device convenience was added next**
4. **Further QuickDrop/direct-transfer parity work is now optional hardening on top of the tracked baseline, not a prerequisite for the baseline to exist**

## Baseline mobile scope already represented in the repository

Ship first:

- login / logout
- netdisk browsing
- upload / download
- create share link
- pickup shared file
- save shared file to account storage

Optional follow-on work, not baseline gaps:

- complete browser-parity QuickDrop UX across all edge cases
- broader real-device / real-network validation of the already implemented direct-transfer path
- advanced LAN discovery assumptions copied from the web UI

## Why the web frontend itself is not the ideal long-term mobile client

The current frontend depends on browser-specific assumptions such as:

- `localStorage`
- page lifecycle behavior
- file inputs and drag/drop
- browser history and SPA state
- browser WebSocket lifecycle
- browser-oriented transfer logic

These are workable on the web, but they are not the cleanest foundation for a maintainable mobile product.

## Final Recommendation

QuickShare **should** get a mobile app, but the cleanest route is:

> reuse the existing backend, and build a dedicated mobile client instead of treating the current web frontend as the permanent mobile app.

If you need a very fast first experiment, a wrapper can be used as an interim step — but it should not be mistaken for the long-term architecture.
