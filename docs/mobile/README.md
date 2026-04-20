# QuickShare Mobile Docs

This directory collects the planning and operational documents for turning QuickShare into a mobile product.

## Current Reality

QuickShare is currently a **web product**:

- Spring Boot backend
- static HTML / JS frontend
- Docker Compose deployment
- no native Android project
- no native iOS project
- no store publishing pipeline yet

These docs therefore describe both:

1. the **current architecture readiness** for mobile, and
2. the **full process** required to ship Android and iOS apps.

## Read This First

1. [architecture.md](architecture.md) — choose the mobile route first
2. [testing.md](testing.md) — understand how mobile quality should be verified
3. [android.md](android.md) — Android build, signing, release flow
4. [ios.md](ios.md) — iOS build, signing, release flow
5. [store-submission.md](store-submission.md) — Google Play + App Store submission checklist
6. [responsibilities.md](responsibilities.md) — ownership and operational responsibilities
7. [../ops/production-deployment.md](../ops/production-deployment.md) — production backend/server checklist

## Recommended Reading Order by Goal

### If you are deciding whether to build mobile at all

1. [architecture.md](architecture.md)
2. [responsibilities.md](responsibilities.md)
3. [testing.md](testing.md)

### If you want to ship an Android app first

1. [architecture.md](architecture.md)
2. [android.md](android.md)
3. [store-submission.md](store-submission.md)
4. [testing.md](testing.md)

### If you want to ship iOS

1. [architecture.md](architecture.md)
2. [ios.md](ios.md)
3. [store-submission.md](store-submission.md)
4. [testing.md](testing.md)

## Scope Boundaries

These docs cover:

- architecture choices
- build and signing workflows
- store submission checklists
- mobile testing expectations
- production backend requirements for mobile

These docs do **not** claim that a mobile client already exists.

## Working Principle

For QuickShare, the backend is already a strong foundation for mobile. The main product choice is not whether mobile is possible, but **which client approach** is worth maintaining long-term.
