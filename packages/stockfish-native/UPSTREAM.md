# Stockfish Lite mobile build inputs

Mapachess compiles Stockfish directly into its Android and iOS applications.
The existing C++ Turbo Native Module owns background execution; native does not
run Stockfish through a WebView or a WebAssembly host.

## Pinned source and configuration

The preserved source under `third_party/stockfish` follows
[Stockfish.js 18.0.0 at revision 31a98753a5d932511693f44775da908377c24513](https://github.com/nmrugg/stockfish.js/tree/31a98753a5d932511693f44775da908377c24513),
the fork selected by the web Lite runtime. Its underlying official Stockfish 18
revision is `cb3d4ee9b47d0c5aae855b12379378ea1439675c`.
`Copying.txt` retains upstream license text with the repository's required LF
line endings rather than upstream's CRLF encoding.

`cpp/StockfishMobileConfig.h` selects `__LITE_NET__`, `__NO_SYZYGY__` and the native
version string `18 Lite`. Android and iOS both include this configuration and
exclude the Syzygy implementation from compilation. Native retains pthreads and
its target-specific SIMD configuration; Emscripten scheduling and single-threaded
execution macros are not native configuration.

Lite selection includes the upstream network architecture, threat-feature
configuration and disabled small-network evaluation path. Replacing only an NNUE
file or engine name would not reproduce that selection.

The only local change inside the upstream snapshot is in `src/nnue/network.cpp`:
native Lite embeds the real big network and defines unused one-byte small-network
symbols, matching the pinned upstream
[embedding generator](https://github.com/nmrugg/stockfish.js/blob/31a98753a5d932511693f44775da908377c24513/build.js).
This avoids an `INCBIN` invocation with Lite's empty small-network filename.
Native Lite never downloads or evaluates a small network.

`src/nativeBuildIdentity.ts` owns the complete native source-snapshot digest,
including this patch. The existing source-snapshot check verifies it before
native input provisioning. Updating upstream source or this patch requires an
explicit corresponding digest and provenance update.

## Verified offline network input

The single network is `nn-9067e33176e8.nnue`, with SHA-256
`9067e33176e8c5edb7aa8db6a3aedd012f84a1f39872e86357c6c2d0993f314d`.
It is not committed. Prepare it through the existing command:

```powershell
pnpm --filter @mapachess/stockfish-native provision
```

The provisioner downloads from the official Stockfish network service, with the
official network repository as its fallback, verifies the complete digest, and
promotes the input atomically into the ignored
`.stockfish-networks/stockfish-18-lite` directory. `stockfish-18-lite` is a local
input identity, not an upstream release tag. The existing EAS post-install hook
already invokes this command; no additional hook or credential is required.

An existing installation is reused only when its exact manifest marker and
network digest match. A mismatched source identity, input manifest or corrupt
network is rejected rather than silently reused. Old Full inputs in other ignored
directories are not selected by the Lite compiler configuration.

Both native compiler owners embed the verified network. Engine data therefore
does not require a runtime download in the intended native build.

## Verification and distribution boundaries

Existing package tests cover source/network pin alignment, the patched snapshot,
provisioning integrity/reuse, compiler configuration structure, and the unchanged
typed session lifecycle. TypeScript tests and text checks do not prove Android or
iOS compilation, native execution, device performance, or chess strength.

Native application builds and the existing on-target engine proof remain
separately authorized verification steps. Sharing a Lite lineage does not prove
cross-target calibration equivalence: the actual compiled runtime and exact
search policy require that evidence before rated reuse. Standard and Chess960
retain separate calibration evidence. Web artifacts and the historical Full
Windows calibration reference are unchanged by this native input alignment.

Stockfish and Mapachess application source are distributed under GPL-3.0-or-later.
See `third_party/stockfish/Copying.txt`, the repository `LICENSE`, and the complete
corresponding source and platform build instructions before distributing an
application binary. Preserve this native patch and its build configuration in
the corresponding source; this document is not store-submission approval.
