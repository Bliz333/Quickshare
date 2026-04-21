# QuickShare Store Submission Guide

## Purpose

This file covers the store-facing release checklist for both Google Play and the Apple App Store.

It is an operational release guide, not a claim that store submission artifacts are tracked inside this repository.

## Shared Prerequisites

Before any submission:

- production backend is live and stable
- privacy policy exists publicly
- support/contact path exists publicly
- screenshots are current
- version number is final
- testing is complete

Repository implementation proof and store submission readiness are different bars:

- repository proof = tracked code, native projects, tests, CI, and documented validation evidence exist in this repo
- store readiness = signing, screenshots, metadata, review notes, and release operations are complete in the relevant store tooling

## Google Play Checklist

- Play developer account available
- signed Android App Bundle (`.aab`)
- store description
- icon / feature graphics / screenshots
- content rating completed
- data safety section completed
- privacy policy URL added
- internal or closed testing validated

## App Store Checklist

- Apple Developer membership active
- signed iOS release archive ready
- App Store Connect metadata completed
- screenshots for required device classes
- privacy policy URL added
- support URL added
- TestFlight testing completed
- App Review notes prepared

## Metadata to Prepare Early

- app name
- subtitle / short description
- full description
- keywords
- support email or support page
- privacy policy page
- marketing website (optional but recommended)

## Operational Recommendation

Keep a release folder or release note template for every mobile version containing:

- version number
- backend version dependency
- release date
- store submission date
- review notes
- rollout / rollback notes

## Review Reality

Store submission is not just a build problem. It is an operational process.

Be ready for:

- screenshot rejections
- policy clarification requests
- privacy wording updates
- payment / file-handling review questions

## QuickShare-specific Warning

If the first mobile version is only a thin wrapper around the website, App Store review risk is higher. A more product-shaped client usually has a smoother long-term path.
