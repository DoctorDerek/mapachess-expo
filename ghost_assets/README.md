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

The web build defaults to authored public fallbacks. An authorized build sets
`NEXT_PUBLIC_MAPACHESS_PRESENTATION_ASSETS=licensed` and supplies the
43-character, high-entropy `GHOST_ASSET_KEY_MAPACHESS` secret. It then validates
the ignored local source when present or decrypts and validates the committed
archive before copying the allowlisted runtime files.

Run `pnpm assets:create-encrypted-archive` only after updating the ignored
source directory and manifest together. Never commit the plaintext source, a
decryption key, generated public output, receipts, or purchase records.
