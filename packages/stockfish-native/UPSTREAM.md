# Stockfish mobile build inputs

Mapachess compiles Stockfish directly into its Android and iOS applications.
The preserved source under `third_party/stockfish` is the exact Stockfish 18
release lineage at revision
`cb3d4ee9b47d0c5aae855b12379378ea1439675c`. Its deterministic snapshot digest
is owned by `src/nativeBuildIdentity.ts` and verified before native build-input
provisioning.

The two release NNUE files are not committed because their combined size is
unsuitable for ordinary Git history. `pnpm --filter
@mapachess/stockfish-native provision` downloads them from official Stockfish
sources, verifies their complete SHA-256 digests, and promotes them atomically
under the ignored `.stockfish-networks` directory. The native build embeds the
verified networks so the application never downloads engine data at runtime.

Stockfish and Mapachess application source are distributed under GPL-3.0-or-
later. See `third_party/stockfish/Copying.txt`, the repository `LICENSE`, and
the complete corresponding source and build instructions before distributing
an application binary.
