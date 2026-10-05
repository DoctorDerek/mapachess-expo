import { describe, expect, it } from "vitest"
import { createActor, waitFor } from "xstate"
import SerializedPlayerDataStore from "../src/durableStore.js"
import { HERO_CATALOG } from "../src/heroCatalog.js"
import {
  decodePlayerAppearance,
  DEFAULT_PLAYER_APPEARANCE,
  eligiblePlayerAnimals,
  heroLayerPaths,
} from "../src/playerAppearance.js"
import createInitialMapachessPlayerData from "../src/playerData.js"
import { decodeMapachessPlayerDataWithSource } from "../src/playerDataCodec.js"
import {
  createMapachessPortableBackup,
  decodeMapachessPortableBackup,
} from "../src/portableBackup.js"
import profileMachine, {
  selectCurrentPlayerData,
} from "../src/profileMachine.js"
import { changePlayerAppearance } from "../src/profileMutations.js"
import { InMemoryDurableStoreAdapter, sha256 } from "./profileTestSupport.js"

describe("the saved personal appearance", () => {
  it("always permits raccoon without unlocking its opponent", () => {
    const data = createInitialMapachessPlayerData()
    expect(eligiblePlayerAnimals(data.storyProgress)).toEqual([
      "raccoon-stockfish",
      "chicken-stockfish",
    ])
    const changed = changePlayerAppearance(data, {
      ...data.appearance,
      animal: "chicken-stockfish",
      hair: "f9",
      hairColor: 10,
    })
    expect(changed.storyProgress).toBe(data.storyProgress)
    expect(changed.ratings).toBe(data.ratings)
    expect(changed.totalXp).toBe(data.totalXp)
    expect(changed.challengeHistory).toBe(data.challengeHistory)
    expect(changed.unlockedAchievementIds).toBe(data.unlockedAchievementIds)
    expect(changed.activeMatch).toBe(data.activeMatch)
    expect(changed.revision).toBe(data.revision + 1)
  })

  it.each([
    { animal: "dragonfly-stockfish" },
    { skin: 7 },
    { face: 0 },
    { hair: "m15" },
    { hairColor: 11 },
    { cloth: "cloth18" },
    { clothColor: 9 },
    { playerName: "unexpected" },
  ])("rejects unsupported or locked choices %j", (change) => {
    const data = createInitialMapachessPlayerData()
    expect(() =>
      decodePlayerAppearance(
        { ...data.appearance, ...change },
        data.storyProgress,
        "$.appearance",
      ),
    ).toThrow()
  })

  it("has six synchronized layer paths for every supported style/color", () => {
    for (const hair of HERO_CATALOG.hair)
      for (const hairColor of hair.colors) {
        const paths = heroLayerPaths({
          ...DEFAULT_PLAYER_APPEARANCE,
          hair: hair.id,
          hairColor,
        })
        expect(paths).toHaveLength(6)
        expect(paths[1]).toContain(`${hair.id}_c${hairColor}_bot.png`)
        expect(paths[5]).toContain(`${hair.id}_c${hairColor}_top.png`)
      }
    for (const cloth of HERO_CATALOG.cloth)
      for (const clothColor of cloth.colors) {
        const paths = heroLayerPaths({
          ...DEFAULT_PLAYER_APPEARANCE,
          cloth: cloth.id,
          clothColor,
        })
        expect(paths[3]).toContain(`${cloth.id}_c${clothColor}_bot.png`)
        expect(paths[4]).toContain(`${cloth.id}_c${clothColor}_top.png`)
      }
  })

  it("migrates schema9 without changing its checksum input or progression", () => {
    const current = createInitialMapachessPlayerData()
    const { appearance: _appearance, ...fields } = current
    const legacy = { ...fields, schemaVersion: 9 }
    const decoded = decodeMapachessPlayerDataWithSource(legacy)
    expect(decoded.ok).toBe(true)
    if (!decoded.ok) throw new Error("Expected supported legacy profile")
    expect(decoded.data).toEqual(current)
    expect(decoded.source.schemaVersion).toBe(9)
    expect(decoded.source.canonical).not.toContain("skin")
  })

  it("round-trips appearance in authenticated portable backup", async () => {
    const current = createInitialMapachessPlayerData()
    const changed = changePlayerAppearance(current, {
      ...current.appearance,
      skin: 6,
      face: 7,
      cloth: "cloth17",
      clothColor: 8,
    })
    const backup = await createMapachessPortableBackup({
      playerData: changed,
      sha256,
      applicationVersion: "test",
      gddRevision: "5.0",
    })
    const decoded = await decodeMapachessPortableBackup(backup, sha256)
    expect(decoded.ok).toBe(true)
    if (!decoded.ok) throw new Error("Expected valid portable backup")
    expect(decoded.backup.payload.appearance).toEqual(changed.appearance)
  })

  it("accepts appearance only after its existing durable transaction finishes", async () => {
    const store = new SerializedPlayerDataStore(
      new InMemoryDurableStoreAdapter(),
      sha256,
    )
    const actor = createActor(profileMachine, {
      input: {
        store,
        decodePortableBackup: (rawBackup) =>
          decodeMapachessPortableBackup(rawBackup, sha256),
      },
    }).start()
    await waitFor(actor, (snapshot) => snapshot.matches("ready"))
    const appearance = {
      ...DEFAULT_PLAYER_APPEARANCE,
      animal: "chicken-stockfish" as const,
    }
    actor.send({ type: "PROFILE.APPEARANCE_SAVE_REQUESTED", appearance })
    expect(selectCurrentPlayerData(actor.getSnapshot())?.appearance).toEqual(
      DEFAULT_PLAYER_APPEARANCE,
    )
    await waitFor(actor, (snapshot) => snapshot.matches("ready"))
    expect(selectCurrentPlayerData(actor.getSnapshot())?.appearance).toEqual(
      appearance,
    )
    expect((await store.load()).current).toMatchObject({
      type: "valid",
      data: { appearance },
    })
    actor.stop()
  })
})
