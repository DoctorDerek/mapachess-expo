import { CryptoDigestAlgorithm, digestStringAsync } from "expo-crypto"
import type { Sha256HexDigest } from "@mapachess/profile/portable-backup"

const expoSha256: Sha256HexDigest = (canonicalValue) =>
  digestStringAsync(CryptoDigestAlgorithm.SHA256, canonicalValue)

export default expoSha256
