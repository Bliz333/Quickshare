# QuickShare Documentation

[English](README.md) | [简体中文](README.zh-CN.md)

This directory separates current product facts, engineering knowledge, operator runbooks, and historical evidence. A dated archive entry is not a statement about the current release.

## Start Here

| Goal | Read |
| --- | --- |
| Install or understand the product | [`../README.md`](../README.md) |
| Work on the codebase with an AI tool | [`../AGENTS.md`](../AGENTS.md) |
| Understand the current maintenance state | [`STATUS.md`](STATUS.md) |
| Select the right validation | [`ai/validation.md`](ai/validation.md) |
| Run or deploy the service | [`ai/platform.md`](ai/platform.md) and [`ops/`](ops/) |
| Evaluate possible future work | [`PLAN.md`](PLAN.md) |
| Plan a mobile client | [`mobile/README.md`](mobile/README.md) |

## Documentation Layers

### Current engineering knowledge

The root [`AGENTS.md`](../AGENTS.md) is the project knowledge map. It routes readers to stable, code-backed details in [`ai/`](ai/):

- [`ai/architecture.md`](ai/architecture.md): system layers, data ownership, security, storage, and compatibility
- [`ai/frontend.md`](ai/frontend.md): static frontend, routes, session handling, styling, and localization
- [`ai/transfer.md`](ai/transfer.md): Quick Transfer direct/relay flows, task ledger, signaling, and relay E2EE
- [`ai/validation.md`](ai/validation.md): risk-based test matrix and CI boundaries
- [`ai/platform.md`](ai/platform.md): local, Compose, pre-production, production, and secret boundaries

### Operator runbooks

[`ops/`](ops/) covers first-time production deployment, HTTPS proxying, capacity, backup, and environment differences. Real hosts and credentials remain outside Git in `.env`, SSH config, or `.agents/local/`.

### Product state and planning

- [`STATUS.md`](STATUS.md) is a concise snapshot of supported capabilities and known boundaries.
- [`PLAN.md`](PLAN.md) lists uncommitted candidates, not a promised roadmap.
- [`CHANGELOG.md`](CHANGELOG.md) and [`archive/`](archive/) preserve chronological evidence.

### Historical and planning material

- [`archive/`](archive/) contains dated implementation records. Names, commands, and validation claims in those files may be obsolete.
- [`mobile/`](mobile/) describes a possible mobile product; no native Android or iOS client currently exists in this repository.
- [`web-design-phase.md`](web-design-phase.md) and older design notes are historical context unless the current frontend rules link to them explicitly.

## Maintenance Rule

Update documentation only when a code, configuration, operational, or product fact changes. Fix or delete stale text in place; do not append a new session log to current-state files. Commands and variable names must be checked against scripts, `.env.example`, `compose.yaml`, and source before publishing.
