# QuickShare Mobile Responsibilities

## Purpose

This file clarifies who owns what once QuickShare gains a mobile client.

## Product / Project Owner

Responsible for:

- feature scope for each mobile release
- deciding MVP vs parity features
- store listing approval
- go/no-go release decisions

## Mobile Engineering

Responsible for:

- client code
- release builds
- signing setup
- app-store-ready artifacts
- mobile regression validation

## Backend / Platform Engineering

Responsible for:

- API stability
- auth compatibility
- upload/download/share reliability
- WebSocket signaling stability if used by mobile
- storage, backups, and production environment health

## Operations / DevOps

Responsible for:

- production deployment
- nginx / TLS / certbot
- backups
- monitoring
- alerting
- environment secret handling

## QA / Verification

Responsible for:

- release smoke tests
- device matrix checks
- regression tracking
- sign-off on release candidate builds

## User-side Responsibilities

Users should not be expected to do much, but documentation should make these clear:

- keep app updated
- keep device storage available
- grant required permissions when needed
- report reproducible issues with version/device info

## Practical Rule

No mobile release should depend on only one person knowing:

- signing secrets location
- store login process
- backend env dependencies
- production rollback process

Those items must be documented and recoverable.
