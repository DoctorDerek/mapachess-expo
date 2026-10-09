# Licensed presentation assets

## Independent chess-art bundle

The existing presentation archive and its manifest remain unchanged. The
separate `backterria-toffeecraft-chess.zip` contains 213 runtime PNGs: 198
authored piece cells and 15 playable board images. Its existing filename is
retained; the inventory now also includes Cosunosuke's twelve gold/blue piece
cells and frameless board. `chess-assets.manifest.json`
allowlists their SHA-256 digests; `chess-assets.provenance.json` records source
file identities, crop rectangles, transformations and runtime geometry for
these images and the public-license chess artwork. Full private source packs
are not shipped. Source-linked notices live in `licenses/<source>/LICENSE.txt`.

The two immutable descriptors in `scripts/ghost-assets/licensedAssetBundles.ts`
own archive, manifest, input, staging and generated-output paths. Both use the
existing private key. Preparation validates them independently; missing
keyless chess inputs cannot disable the animal, coach or avatar bundle.
`MAPACHESS_BUILD_HAS_CHESS_ASSETS` reports validated chess-file availability,
separately from `MAPACHESS_BUILD_HAS_PRESENTATION_ASSETS`; neither exposes a key.

The chess authoring directory is ignored `vendor/chess-runtime-assets/` and its
generated output is ignored `apps/web/public/generated/chess-assets/`. Rebuild
only the chess archive from verified authoring files with:

```powershell
pnpm assets:create-encrypted-archive --bundle=chess
```

Omitting the argument preserves the existing presentation-archive command.
Public-license Chessnut and Skoll SVGs and Cat chess PNGs are under
`apps/web/public/chess-assets/`, each with source and license notices. The shared
catalog records role, side, native dimensions and delivery ownership, not player
preferences. Settings exposes Credits for both existing and prepared artwork.
The default board and pieces are unchanged; Settings offers independent artwork
selectors. Catalog inclusion alone does not certify every board/piece combination
for release. Cosunosuke's source-linked notice records the creator's game-use
permission and prohibition on standalone raw-asset redistribution. The framed
board and selection indicator remain private: Mapachess keeps its own coordinates
and interaction overlays. GreyFox is not part of the runtime catalogs or this archive.

## Existing animal, portrait and avatar bundle

Mapachess keeps purchased source art outside Git while allowing authorized
builds to reproduce the Battle Stage, coach portraits, and player avatars.

- `presentation-assets.manifest.json` allowlists every runtime file and its
  SHA-256 digest.
- `seethingswarm-captainskolot-heroes99.zip` contains only those files, encrypted
  as AES-256 AE-2 data: SeethingSwarm animal sprites, CaptainSkolot coach portraits,
  and Heroes99 avatar layers by AU_pixel.
- `LICENSE.txt` records provenance, attribution, and the controlling source
  terms. The encrypted archive does not grant permission to reuse its contents.
- `vendor/presentation-assets/` is the ignored local source directory used to
  author a replacement archive.
- `apps/web/public/generated/presentation-assets/` is ignored build output.

The archive's filename identifies its source families; the existing manifest,
authoring directory, and generated browser URLs retain their presentation-domain
names. A filename-only migration does not re-encrypt the archive or change its
password, inventory, or runtime paths.

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
private `GHOST_ASSET_KEY_MAPACHESS` on the Mapachess web
project for Development, Preview, and Production. Mark it Sensitive where
supported; never expose it in source, logs, screenshots, or chat. It is the only
hosting setting required by this asset pipeline.

Use the same owner-selected password that encrypted the committed archive.
If the hosting password was selected separately, an authorized operator can
re-encrypt the verified local assets with that password using the command below;
the hosting settings do not need to be replaced with a different local key.
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

The same archive password can be configured in EAS Development, Preview, and
Production; the project owner has configured both hosts. This does not by itself
connect a native asset consumer. The current `eas-build-post-install` hook
provisions native Stockfish, not this presentation inventory. Native licensed
presentation still needs its approved consumer and build integration. Do not
claim it ships because the EAS secret exists, or start a native build merely to
complete this web correction.

## Updating the encrypted source archive

From the repository root, supply `GHOST_ASSET_KEY_MAPACHESS` privately in the
process environment or the ignored `apps/web/.env.local` file, then run:

```powershell
pnpm assets:create-encrypted-archive
```

When using the environment file, quote values containing `#` or leading/trailing
spaces so the dotenv parser preserves the password. See
[Node's environment-file syntax](https://nodejs.org/api/environment_variables.html#dotenv).

Creation and decryption use the exact supplied password, without a minimum
length, exact-length requirement, character-set restriction, trimming, or
normalization. Missing or empty creation passwords fail instead of producing
plaintext. Choose and retain a strong, unique password privately.

The command validates `vendor/presentation-assets/` against the manifest and
writes or replaces `ghost_assets/seethingswarm-captainskolot-heroes99.zip` with
encrypted data.
An existing ZIP does not need to be deleted first, and its old password is not
needed when the verified local source files are available. Re-encrypting unchanged
files does not require changing the manifest; update its digests only when the
approved source content changes.

The success message confirms creation, not archive-only extraction or hosted
delivery. Verify a replacement with its password before committing it; a local
build that uses the authoring directory bypasses archive decryption. Commit only
the encrypted archive and approved text changes, never the plaintext source,
decryption key, local environment file, generated public output, receipts, or
purchase records.
