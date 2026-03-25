# QuickShare Docs

[English](README.md) | [简体中文](README.zh-CN.md)

This directory is the operational documentation hub for QuickShare.

## What to Read First

- [../README.md](../README.md): primary English product overview
- [../README.zh-CN.md](../README.zh-CN.md): Chinese overview
- [STATUS.md](STATUS.md): latest Chinese status snapshot
- [TESTING.md](TESTING.md): detailed Chinese testing and acceptance workflow
- [PLAN.md](PLAN.md): current Chinese roadmap and next-stage priorities
- [CHANGELOG.md](CHANGELOG.md): change history
- [PUBLISHING.md](PUBLISHING.md): publishing hygiene and release notes

## Current Documentation Model

- English is now the primary top-level entrypoint.
- Chinese remains the main language for deep operational notes and historical session logs.
- The archive under [`archive/`](archive) is intentionally detailed and mostly Chinese, because it records implementation and validation history chronologically.

## Current Verified Baseline

- `main` matches the validated hardening baseline.
- Remote validation has been completed on a Debian 12 test server with:
  - OpenJDK 17
  - Maven 3.8.7
  - Node 18 / npm 9
  - Docker plus `docker-compose`
- The latest remote smoke run passed:
  - JS syntax checks
  - Java compile
  - targeted JUnit
  - repo smoke script
  - Dockerized Playwright smoke
- The latest remote `quickdrop-real` run finished as `direct`.

## Recommended Reading Order

### For new contributors

1. [../README.md](../README.md)
2. [STATUS.md](STATUS.md)
3. [TESTING.md](TESTING.md)
4. [PLAN.md](PLAN.md)

### For release / deployment work

1. [PUBLISHING.md](PUBLISHING.md)
2. [TESTING.md](TESTING.md)
3. [CHANGELOG.md](CHANGELOG.md)
4. [archive/2026-03-26-remote-baseline-rebuild-and-direct-validation.md](archive/2026-03-26-remote-baseline-rebuild-and-direct-validation.md)

## Notes

- The remote test server is resource-constrained. Disk and memory checks are part of the expected workflow.
- If you need a precise, dated implementation record, start from [CHANGELOG.md](CHANGELOG.md) and then open the matching archive entry.
