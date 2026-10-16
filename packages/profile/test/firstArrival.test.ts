import { describe, expect, it, vi } from "vitest"
import { createActor, waitFor } from "xstate"
import loadCatalog from "@mapachess/localization/catalog"
import resolveLocale, {
  CANDIDATE_LOCALES,
  LOCALE_LABELS,
  SHIPPED_LOCALES,
} from "@mapachess/localization/locale"
import { PLAYER_INPUT_ACTIONS } from "@mapachess/match/player-input"
import SerializedPlayerDataStore from "../src/durableStore.js"
import createInitialMapachessPlayerData from "../src/playerData.js"
import {
  canonicalPlayerData,
  decodeMapachessPlayerData,
  decodeMapachessPlayerDataWithSource,
} from "../src/playerDataCodec.js"
import {
  createMapachessPortableBackup,
  decodeMapachessPortableBackup,
} from "../src/portableBackup.js"
import profileMachine, {
  selectCurrentPlayerData,
  selectPendingPlayerData,
} from "../src/profileMachine.js"
import { decodeStoredPlayerData } from "../src/storedPlayerData.js"
import {
  InMemoryDurableStoreAdapter,
  sha256,
  withoutFirstArrivalPreferences,
} from "./profileTestSupport.js"

describe("first-arrival preferences", () => {
  it("resolves the explicit shipped languages without pretending other candidates are shipped", () => {
    expect(SHIPPED_LOCALES).toEqual(["en", "es-419"])
    expect(Object.keys(LOCALE_LABELS)).toEqual(SHIPPED_LOCALES)
    expect(CANDIDATE_LOCALES).toContain("es-419")
    expect(resolveLocale({ selection: "en", preferences: ["es-MX"] })).toBe(
      "en",
    )
    expect(resolveLocale({ selection: "es-419", route: "en-US" })).toBe(
      "es-419",
    )
    expect(resolveLocale({ selection: "es-ES", route: "en-US" })).toBe("en")
    expect(resolveLocale({ preferences: ["unsupported", "en-GB"] })).toBe("en")
    expect(resolveLocale({})).toBe("en")
    expect(loadCatalog("en").introduction.paragraphs).toHaveLength(5)
    expect(loadCatalog("en").introduction.website).toBe("DoctorDerek.com")
  })

  it("authenticates exact schema14 bytes before marking an existing player introduced", async () => {
    const current = createInitialMapachessPlayerData()
    const payload = {
      ...withoutFirstArrivalPreferences(current),
      schemaVersion: 14,
    }
    const canonical = JSON.stringify([
      "mapachess-player-data",
      14,
      0,
      "auto-move-hints",
      [100, 100],
      null,
      ["standard", "white", null, "chicken-stockfish", 100],
      [[], []],
      [
        [[], []],
        [[], []],
      ],
      [100, 100, 100, 100],
      [0, 0],
      [],
      0,
      [],
      null,
      current.appearance,
      ["current", "current"],
      "mapachito",
      PLAYER_INPUT_ACTIONS.map((action) => [
        current.settings.inputBindings.controller[action],
        current.settings.inputBindings.keyboard[action],
      ]),
    ])
    const decoded = decodeMapachessPlayerDataWithSource(payload)
    expect(decoded.ok).toBe(true)
    if (!decoded.ok) throw new Error("Schema14 must remain valid")
    expect(decoded.source.canonical).toBe(canonical)
    expect(decoded.data).toEqual({ ...current, introductionCompleted: true })
    const stored = {
      format: "mapachess-stored-player-data",
      formatVersion: 1,
      saveSchemaVersion: 14,
      payload,
      integrity: { algorithm: "SHA-256", payloadHash: await sha256(canonical) },
    }
    expect(
      await decodeStoredPlayerData(JSON.stringify(stored), sha256),
    ).toEqual({ ok: true, data: decoded.data })
    expect(
      await decodeMapachessPortableBackup(
        JSON.stringify({
          ...stored,
          format: "mapachess-portable-backup",
          applicationVersion: "test",
          gddRevision: "5.2",
        }),
        sha256,
      ),
    ).toMatchObject({ ok: true, backup: { payload: decoded.data } })
    expect(canonicalPlayerData(decoded.data)).not.toBe(canonical)
  })

  it("preserves candidate locale data in backups and validates both new fields strictly", async () => {
    const initial = createInitialMapachessPlayerData()
    const data = {
      ...initial,
      introductionCompleted: true,
      settings: { ...initial.settings, locale: "es-419" as const },
    }
    const raw = await createMapachessPortableBackup({
      playerData: data,
      applicationVersion: "test",
      gddRevision: "5.2",
      sha256,
    })
    expect(await decodeMapachessPortableBackup(raw, sha256)).toMatchObject({
      ok: true,
      backup: { payload: data },
    })
    for (const locale of ["es-MX", "invented", false, undefined, 1])
      expect(
        decodeMapachessPlayerData({
          ...initial,
          settings: { ...initial.settings, locale },
        }).ok,
      ).toBe(false)
    for (const introductionCompleted of [null, undefined, 1, "true"])
      expect(
        decodeMapachessPlayerData({ ...initial, introductionCompleted }).ok,
      ).toBe(false)
    const tampered = raw.replace(
      /"introductionCompleted":\s*true/u,
      '"introductionCompleted":false',
    )
    expect(tampered).not.toBe(raw)
    expect(await decodeMapachessPortableBackup(tampered, sha256)).toMatchObject(
      { ok: false, issue: { type: "PROFILE.BACKUP_INTEGRITY_MISMATCH" } },
    )
  })

  it("queues Start and language during a save, preserving every other preference and avoiding duplicate completion writes", async () => {
    const store = new SerializedPlayerDataStore(
      new InMemoryDurableStoreAdapter(),
      sha256,
    )
    const actor = createActor(profileMachine, {
      input: {
        store,
        decodePortableBackup: (raw: string) =>
          decodeMapachessPortableBackup(raw, sha256),
      },
    }).start()
    await waitFor(actor, (snapshot) => snapshot.matches("ready"))
    const initial = selectCurrentPlayerData(actor.getSnapshot())
    if (initial === null) throw new Error("Expected initial player data")
    expect(initial.introductionCompleted).toBe(false)
    actor.send({
      type: "PROFILE.AUTO_HINT_MODE_CHANGED",
      autoHintMode: "no-auto-hints",
    })
    actor.send({ type: "PROFILE.INTRODUCTION_COMPLETED", locale: "en" })
    actor.send({ type: "PROFILE.LOCALE_CHANGED", locale: "en" })
    expect(selectPendingPlayerData(actor.getSnapshot())).toMatchObject({
      introductionCompleted: true,
      settings: { locale: "en", autoHintMode: "no-auto-hints" },
    })
    await waitFor(actor, (snapshot) => snapshot.matches("ready"))
    const saved = selectCurrentPlayerData(actor.getSnapshot())
    expect(saved).toEqual({
      ...initial,
      introductionCompleted: true,
      revision: 2,
      settings: {
        ...initial.settings,
        locale: "en",
        autoHintMode: "no-auto-hints",
      },
    })
    actor.send({ type: "PROFILE.INTRODUCTION_COMPLETED", locale: "en" })
    expect(selectCurrentPlayerData(actor.getSnapshot())).toBe(saved)
    actor.stop()
  })

  it("retains the pending introduction after a failed write and completes it only on verified retry", async () => {
    const store = new SerializedPlayerDataStore(
      new InMemoryDurableStoreAdapter(),
      sha256,
    )
    const actor = createActor(profileMachine, {
      input: {
        store,
        decodePortableBackup: (raw: string) =>
          decodeMapachessPortableBackup(raw, sha256),
      },
    }).start()
    await waitFor(actor, (snapshot) => snapshot.matches("ready"))
    const initial = selectCurrentPlayerData(actor.getSnapshot())
    vi.spyOn(store, "commitCurrent").mockRejectedValueOnce(
      new Error("Storage busy"),
    )
    actor.send({ type: "PROFILE.INTRODUCTION_COMPLETED", locale: "en" })
    await waitFor(actor, (snapshot) => snapshot.matches("persistenceFailure"))
    expect(selectCurrentPlayerData(actor.getSnapshot())).toEqual(initial)
    expect(selectPendingPlayerData(actor.getSnapshot())).toMatchObject({
      introductionCompleted: true,
      settings: { locale: "en" },
    })
    actor.send({ type: "PROFILE.PERSISTENCE_RETRY_REQUESTED" })
    await waitFor(actor, (snapshot) => snapshot.matches("ready"))
    expect(selectCurrentPlayerData(actor.getSnapshot())).toMatchObject({
      introductionCompleted: true,
      revision: 1,
      settings: { locale: "en" },
    })
    actor.stop()
  })
})
