import { CryptoDigestAlgorithm, digest, getRandomValues } from "expo-crypto"
import type { generateMatchSeed } from "@mapachess/gameplay/opponent"
import type { Sha256HexDigest } from "@mapachess/profile/portable-backup"
import type { OpponentSeedDigest } from "@mapachess/stockfish/opponent-move-selection"
import expoSha256 from "../profile/expoSha256"

export type NativeMatchCryptography = Readonly<{
  digestBytes: OpponentSeedDigest
  fillRandomWords: Parameters<typeof generateMatchSeed>[0]
  sha256: Sha256HexDigest
}>

const nativeCryptography: NativeMatchCryptography = Object.freeze({
  digestBytes: (bytes) => digest(CryptoDigestAlgorithm.SHA256, bytes),
  fillRandomWords: (words) => getRandomValues(words),
  sha256: expoSha256,
})

export default nativeCryptography
