# QuickShare Mobile Testing Strategy

## Goal

Mobile testing must prove more than web correctness. It must also prove:

- device lifecycle resilience
- upload/download reliability
- session recovery
- store-release confidence

## Test Layers

### 1. API compatibility testing

Validate that the mobile client works against the real backend contract:

- auth
- netdisk listing
- upload
- download
- share creation
- pickup

### 2. UI / integration testing

Validate real app behavior:

- login flow
- navigation
- upload progress
- download state
- share-link creation and copy/share actions

### 3. Manual device testing

Always test on:

- at least one physical Android phone
- at least one physical iPhone
- at least one narrow-screen device
- at least one larger-screen device

## Core Mobile Regression Checklist

- login / logout
- invalid token recovery
- upload large file
- download shared file
- save shared file to personal storage
- open app from cold start
- return from background
- network loss and reconnect
- dark mode
- language switch if supported

## Release Gate Suggestion

A mobile build should not be released unless all of the following pass:

- automated unit/integration checks
- manual physical-device smoke tests
- production backend health check
- API compatibility confirmation
- release notes completed

## Recommended Monitoring After Release

- crash reporting
- upload failure rate
- download failure rate
- authentication failure rate
- reconnect failure patterns

## QuickShare-specific Testing Advice

For the first mobile release, do not over-scope tests around full QuickDrop parity unless that feature is truly in scope.

The most important early tests are:

- account auth
- file handling
- share-link creation
- pickup/download
- storage interactions
