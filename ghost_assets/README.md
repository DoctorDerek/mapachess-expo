# Licensed presentation assets

Mapachess keeps purchased source art outside Git while allowing authorized
builds to reproduce the Battle Stage and coach presentation.

- `presentation-assets.manifest.json` allowlists every runtime file and its
  SHA-256 digest.
- `presentation-assets.zip` contains only those files, encrypted as AES-256
  AE-2 data.
- `LICENSE.txt` records provenance, attribution, and the controlling source
  terms. The encrypted archive does not grant permission to reuse its contents.
- `vendor/presentation-assets/` is the ignored local source directory used to
  author a replacement archive.
- `apps/web/public/generated/presentation-assets/` is ignored build output.

Asset preparation selects its source automatically:

1. A complete, digest-verified local `vendor/presentation-assets/` directory is
   published without requiring an archive or key.
2. Otherwise, a supplied `GHOST_ASSET_KEY_MAPACHESS` requires the committed
   archive to decrypt and validate successfully. Invalid keys, archives, or
   expected contents fail the build instead of silently selecting placeholders.
3. Without either source, public clones use authored placeholders. Preparation
   removes any previously generated licensed images.

There is no user-configured public presentation-mode setting. Next.js derives
the renderer's compiled availability from the validated published files. The
private key is never included in that browser-visible availability value.

## Vercel setup

Use the `apps/web` project root and its Turbo-aware web build. Configure the
existing 43-character private `GHOST_ASSET_KEY_MAPACHESS` on the Mapachess web
project for Development, Preview, and Production. Mark it Sensitive where
supported; never expose it in source, logs, screenshots, or chat. It is the only
hosting setting required by this asset pipeline.

Use the same existing archive key from authorized local setup; do not regenerate
the archive or rotate a working key just to connect another build environment.
Vercel applies environment changes to subsequent deployments, not already-built
artifacts. Verify the project's actual Build Command and environment scopes;
storing a secret alone does not prove the consuming task receives it.

## Build inputs, cache outputs, and cleanup

`apps/web/turbo.json` makes the existing `assets:prepare` script a noncached
dependency of the web build. Both consuming tasks declare the private key as a
hashed environment input, so strict Turbo execution passes it through and
distinguishes key absence from key changes. The preparation dependency hashes
the root archive, manifest, preparation code, TypeScript configuration, and
consumed local environment/authoring inputs; changes invalidate the dependent
application build too.

Preparation runs even when the application build is restored from cache. This
recreates licensed images when needed and clears them for a keyless public clone;
restoring cached application files alone would not remove stale public images.
Presentation images therefore stay outside the cacheable build outputs. The
existing generated Stockfish runtime remains cached alongside inherited
application output. Authoring files, local environment files, and decrypted
extraction staging are never cache outputs. Local diagnostics use local cache
only.

Archive extraction is allowlisted and integrity-checked. The helper
removes its `vendor/presentation-assets-archive/` staging on success or failure,
preserving both authoring inputs and published runtime files. Fallback
preparation removes generated presentation files instead of decrypting them.

With a complete local authoring directory, local development needs no asset
environment variables or `.env.local`. The optional ignored environment file
remains supported for archive-backed local work. The application reads published
runtime files, not `vendor/` directly. The existing `prebuild` and `predev` hooks
also retain automatic preparation for direct package commands.

## Verification and native scope

Test archive preparation with isolated noncommercial fixtures and dummy keys in
the existing web Vitest runner. Check key and file-input cache identities,
cold/warm output transitions, invalid licensed inputs, and cleanup. Valid local
authoring files can bypass decryption, so a successful local build alone does not
prove the archive-only cloud path works.

Distinguish secret configuration, successful preparation, generated file digests,
compiled sprite availability, and deployed image delivery. Animated letter-tile
fallbacks and fallback-compatible tests do not prove licensed artwork shipped.
Hosted visual playtesting belongs to the project owner; agents use the approved
local verification scope.

The same existing key can be configured in EAS Development, Preview, and
Production; the project owner has configured both hosts. This does not by itself
connect a native asset consumer. The current `eas-build-post-install` hook
provisions native Stockfish, not this presentation inventory. Native licensed
presentation still needs its approved consumer and build integration. Do not
claim it ships because the EAS secret exists, or start a native build merely to
complete this web correction.

## Updating the encrypted source archive

Run `pnpm assets:create-encrypted-archive` only after updating the ignored
source directory and manifest together. Never commit the plaintext source, a
decryption key, generated public output, receipts, or purchase records.
