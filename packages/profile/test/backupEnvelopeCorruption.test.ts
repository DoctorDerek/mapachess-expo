import { describe, expect, it } from "vitest"
import createInitialPlayerData, {
  MAPACHESS_PLAYER_DATA_SCHEMA_VERSION,
} from "../src/playerData"
import { canonicalPlayerData } from "../src/playerDataCodec"
import {
  decodeMapachessPortableBackup,
  MAPACHESS_PORTABLE_BACKUP_FORMAT,
  MAPACHESS_PORTABLE_BACKUP_FORMAT_VERSION,
} from "../src/portableBackup"
import {
  decodeStoredPlayerData,
  MAPACHESS_STORED_PLAYER_DATA_FORMAT,
  MAPACHESS_STORED_PLAYER_DATA_FORMAT_VERSION,
} from "../src/storedPlayerData"
import { sha256 } from "./profileTestSupport"

type Envelope = Readonly<{
  format: string
  formatVersion: number
  integrity: Readonly<{ algorithm: string; payloadHash: string }>
  payload: ReturnType<typeof createInitialPlayerData>
  saveSchemaVersion: number
}>
const damage: readonly Readonly<{
  problem: string
  corrupt: (envelope: Envelope) => unknown
}>[] = [
  { problem: "null root", corrupt: () => null },
  { problem: "array root", corrupt: () => [] },
  {
    problem: "extra envelope fields",
    corrupt: (envelope) => ({ ...envelope, unexpected: true }),
  },
  {
    problem: "wrong format identity",
    corrupt: (envelope) => ({ ...envelope, format: "other-game" }),
  },
  {
    problem: "old unsupported envelope version",
    corrupt: (envelope) => ({ ...envelope, formatVersion: 0 }),
  },
  {
    problem: "string envelope version",
    corrupt: (envelope) => ({ ...envelope, formatVersion: "1" }),
  },
  {
    problem: "future envelope version",
    corrupt: (envelope) => ({ ...envelope, formatVersion: 99 }),
  },
  {
    problem: "mismatched save schema",
    corrupt: (envelope) => ({ ...envelope, saveSchemaVersion: 1 }),
  },
  {
    problem: "corrupt payload",
    corrupt: (envelope) => ({
      ...envelope,
      payload: { ...envelope.payload, totalXp: -1 },
    }),
  },
  {
    problem: "null integrity",
    corrupt: (envelope) => ({ ...envelope, integrity: null }),
  },
  {
    problem: "extra integrity fields",
    corrupt: (envelope) => ({
      ...envelope,
      integrity: { ...envelope.integrity, unexpected: true },
    }),
  },
  {
    problem: "unsupported digest algorithm",
    corrupt: (envelope) => ({
      ...envelope,
      integrity: { ...envelope.integrity, algorithm: "SHA-512" },
    }),
  },
  {
    problem: "non-string digest",
    corrupt: (envelope) => ({
      ...envelope,
      integrity: { ...envelope.integrity, payloadHash: 7 },
    }),
  },
  {
    problem: "short digest",
    corrupt: (envelope) => ({
      ...envelope,
      integrity: { ...envelope.integrity, payloadHash: "abcd" },
    }),
  },
  {
    problem: "non-hex digest",
    corrupt: (envelope) => ({
      ...envelope,
      integrity: { ...envelope.integrity, payloadHash: "z".repeat(64) },
    }),
  },
]

describe("backup and durable envelope rejection before replacement", () => {
  it.each(damage)(
    "rejects $problem for both portable and durable saves without changing the valid source",
    async ({ corrupt }) => {
      const payload = createInitialPlayerData()
      const before = canonicalPlayerData(payload)
      const common = {
        payload,
        integrity: { algorithm: "SHA-256", payloadHash: await sha256(before) },
        saveSchemaVersion: MAPACHESS_PLAYER_DATA_SCHEMA_VERSION,
      }
      const portable = {
        ...common,
        applicationVersion: "owned-test",
        gddRevision: "owned-test",
        format: MAPACHESS_PORTABLE_BACKUP_FORMAT,
        formatVersion: MAPACHESS_PORTABLE_BACKUP_FORMAT_VERSION,
      }
      const stored = {
        ...common,
        format: MAPACHESS_STORED_PLAYER_DATA_FORMAT,
        formatVersion: MAPACHESS_STORED_PLAYER_DATA_FORMAT_VERSION,
      }
      expect(
        (await decodeMapachessPortableBackup(JSON.stringify(portable), sha256))
          .ok,
      ).toBe(true)
      expect(
        (await decodeStoredPlayerData(JSON.stringify(stored), sha256)).ok,
      ).toBe(true)
      expect(
        (
          await decodeMapachessPortableBackup(
            JSON.stringify(corrupt(portable)),
            sha256,
          )
        ).ok,
      ).toBe(false)
      expect(
        (await decodeStoredPlayerData(JSON.stringify(corrupt(stored)), sha256))
          .ok,
      ).toBe(false)
      expect(canonicalPlayerData(payload)).toBe(before)
    },
  )

  it.each([null, 7, "", " padded "])(
    "rejects invalid portable backup identity fields (%#)",
    async (identity) => {
      const payload = createInitialPlayerData()
      const base = {
        applicationVersion: "owned-test",
        gddRevision: "owned-test",
        format: MAPACHESS_PORTABLE_BACKUP_FORMAT,
        formatVersion: MAPACHESS_PORTABLE_BACKUP_FORMAT_VERSION,
        payload,
        saveSchemaVersion: MAPACHESS_PLAYER_DATA_SCHEMA_VERSION,
        integrity: {
          algorithm: "SHA-256",
          payloadHash: await sha256(canonicalPlayerData(payload)),
        },
      }
      for (const field of ["applicationVersion", "gddRevision"] as const)
        expect(
          (
            await decodeMapachessPortableBackup(
              JSON.stringify({ ...base, [field]: identity }),
              sha256,
            )
          ).ok,
        ).toBe(false)
    },
  )
})
