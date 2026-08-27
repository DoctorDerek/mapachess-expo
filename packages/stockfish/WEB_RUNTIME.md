# Stockfish web runtime provenance

Mapachess currently evaluates the Stockfish.js `v18.0.0` lite single-threaded
release as its pinned browser candidate. The runtime is provisioned explicitly
for local verification and is not fetched by application code.

| Identity                  | Pin                                                                                                                          |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Stockfish.js release      | `v18.0.0`                                                                                                                    |
| Stockfish.js commit       | `31a98753a5d932511693f44775da908377c24513`                                                                                   |
| Upstream Stockfish commit | `cb3d4ee9b47d0c5aae855b12379378ea1439675c`                                                                                   |
| Loader                    | `stockfish-18-lite-single.js`, 20,670 bytes, SHA-256 `2278005057f381491f1c9bb3e44c9f5920b3a00bef9759e33cc6582769a1f1fe`      |
| WebAssembly               | `stockfish-18-lite-single.wasm`, 7,295,411 bytes, SHA-256 `a8fbc05ec6920b56d7485826dcb02c5ffd2826bcbf751cf973046f237a9096f1` |

Provision and verify the two release artifacts from the repository root:

```powershell
corepack pnpm stockfish:provision:web
```

The command downloads only those two release assets, verifies their exact byte
lengths and SHA-256 digests, and promotes them into the ignored
`apps/web/public/stockfish-runtime/` directory. Ordinary CI and Vercel do not
run this command. Application runtime code must load the provisioned files from
the same origin and must never fall back to a CDN.

The pinned source is available at the
[Stockfish.js release commit](https://github.com/nmrugg/stockfish.js/tree/31a98753a5d932511693f44775da908377c24513),
which identifies the
[upstream Stockfish revision](https://github.com/official-stockfish/Stockfish/tree/cb3d4ee9b47d0c5aae855b12379378ea1439675c).
Stockfish.js documents Emscripten 3.1.7 and
`node build.js --single-threaded --lite -f` for a source build. Mapachess uses
the verified upstream release artifacts for this candidate; an independently
reproduced byte-for-byte build has not been claimed.

Stockfish.js and Stockfish are GPLv3 software. The applicable upstream license
is available in
[Copying.txt](https://github.com/nmrugg/stockfish.js/blob/31a98753a5d932511693f44775da908377c24513/Copying.txt).
