import "./nativeUiEnvironment"
import { beforeEach, expect, it, jest } from "@jest/globals"
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native"
import { AccessibilityInfo } from "react-native"
import * as motion from "react-native-reanimated"
import Home from "@mapachess/application-ui/home"
import loadCatalog from "@mapachess/localization/catalog"
import resolveOpponentPresentation from "@mapachess/match-presentation/opponent-presentation"
import { MATCH_MODE_CHOICES } from "@mapachess/match/match-setup"
import {
  DEFAULT_PLAYER_APPEARANCE,
  heroLayerPaths,
  type PlayerAppearance,
} from "@mapachess/profile/player-appearance"
import createInitialPlayerData from "@mapachess/profile/player-data"
import {
  cardFacts,
  INITIAL_CARD_CONTENT,
} from "@mapachess/profile/profile-card-model"
import { playerRatingId } from "@mapachess/profile/rating-context"
import nativeHomeElements from "@/components/gameplay/NativeHomeElements"
import NativeAnimatedPlayerArtwork from "@/components/profile/NativeAnimatedPlayerArtwork"
import NativeCardArtwork from "@/components/profile/NativeCardArtwork"

const mockMissing = new Set<string>()
let mockActive = true
const mockActivityListeners = new Set<() => void>()
jest.mock("@/lib/gameplay/nativeApplicationActivity", () => ({
  __esModule: true,
  default: () => ({
    isActive: () => mockActive,
    subscribe: (listener: () => void) => {
      mockActivityListeners.add(listener)
      return () => mockActivityListeners.delete(listener)
    },
  }),
}))
jest.mock("@/lib/presentation/nativeAssetManifest", () => ({
  __esModule: true,
  default: {
    svg: {},
    images: new Proxy(
      {},
      {
        get: (_target, key) =>
          typeof key === "string" && mockMissing.has(key) ? undefined : 1,
      },
    ),
  },
}))

const copy = loadCatalog("en")
function sources(appearance: PlayerAppearance): string[] {
  const animal = resolveOpponentPresentation(appearance.animal)
  return [
    ...heroLayerPaths(appearance).map(
      (path) => `/generated/presentation-assets/${path}`,
    ),
    ...(animal.kind === "sprite" ? [animal.steps[0].animation.sourceId] : []),
  ]
}
async function loadAppearance(appearance: PlayerAppearance) {
  for (const source of sources(appearance))
    for (const image of screen.getAllByTestId(source))
      await fireEvent(image, "load")
}
beforeEach(() => {
  mockMissing.clear()
  mockActive = true
  mockActivityListeners.clear()
  jest
    .spyOn(AccessibilityInfo, "isReduceMotionEnabled")
    .mockResolvedValue(false)
})

it("starts a synchronized appearance only after every required source loads and cancels when backgrounded", async () => {
  const timing = jest.spyOn(motion, "withTiming")
  const cancel = jest.spyOn(motion, "cancelAnimation")
  const view = await render(
    <NativeAnimatedPlayerArtwork appearance={DEFAULT_PLAYER_APPEARANCE} />,
  )
  expect(timing).not.toHaveBeenCalled()
  const [first] = sources(DEFAULT_PLAYER_APPEARANCE)
  if (first === undefined)
    throw new Error("The selected appearance requires artwork.")
  await fireEvent(screen.getByTestId(first), "load")
  expect(timing).not.toHaveBeenCalled()
  await loadAppearance(DEFAULT_PLAYER_APPEARANCE)
  await waitFor(() => expect(timing).toHaveBeenCalled())
  timing.mockClear()
  await act(() => {
    mockActive = false
    for (const listener of mockActivityListeners) listener()
  })
  expect(cancel).toHaveBeenCalled()
  expect(timing).not.toHaveBeenCalled()
  await act(() => {
    mockActive = true
    for (const listener of mockActivityListeners) listener()
  })
  expect(timing).toHaveBeenCalled()
  await view.unmount()
})

it("retains the accepted artwork while a replacement prepares, fails, and retries", async () => {
  const original = DEFAULT_PLAYER_APPEARANCE
  const changed: PlayerAppearance = { ...original, skin: 2 }
  const oldOnly = sources(original).find(
    (source) => !sources(changed).includes(source),
  )
  const newOnly = sources(changed).find(
    (source) => !sources(original).includes(source),
  )
  if (oldOnly === undefined || newOnly === undefined)
    throw new Error("The fixture must change its actual skin layer.")
  const view = await render(
    <NativeAnimatedPlayerArtwork appearance={original} />,
  )
  await loadAppearance(original)
  await view.rerender(<NativeAnimatedPlayerArtwork appearance={changed} />)
  expect(screen.getByTestId(oldOnly)).toBeOnTheScreen()
  await fireEvent(screen.getByTestId(newOnly), "error")
  expect(screen.getByRole("alert")).toHaveTextContent(
    copy.interface.profileCard.profileArtworkCouldNotLoad,
  )
  expect(screen.getByTestId(oldOnly)).toBeOnTheScreen()
  await fireEvent.press(
    screen.getByRole("button", {
      name: copy.interface.profileCard.retryArtwork,
    }),
  )
  expect(screen.getByTestId(oldOnly)).toBeOnTheScreen()
  await loadAppearance(changed)
  expect(screen.queryByTestId(oldOnly)).toBeNull()
  expect(screen.queryByRole("alert")).toBeNull()
  await view.unmount()
})

it("does not let an obsolete appearance replace a newer selected source set", async () => {
  const original = DEFAULT_PLAYER_APPEARANCE
  const obsolete: PlayerAppearance = { ...original, skin: 2 }
  const selected: PlayerAppearance = { ...original, skin: 3 }
  const oldOnly = sources(original).find(
    (source) => !sources(selected).includes(source),
  )
  if (oldOnly === undefined)
    throw new Error("The fixture requires a distinct skin.")
  const view = await render(
    <NativeAnimatedPlayerArtwork appearance={original} />,
  )
  await loadAppearance(original)
  await view.rerender(<NativeAnimatedPlayerArtwork appearance={obsolete} />)
  const obsoleteOnly = sources(obsolete).find(
    (source) => !sources(original).includes(source),
  )
  if (obsoleteOnly === undefined)
    throw new Error("The obsolete appearance requires its own source.")
  const late: unknown = screen.getByTestId(obsoleteOnly).props.onLoad
  if (typeof late !== "function")
    throw new Error("The native image must report decoded readiness.")
  await view.rerender(<NativeAnimatedPlayerArtwork appearance={selected} />)
  await act(() => late())
  expect(screen.getByTestId(oldOnly)).toBeOnTheScreen()
  await loadAppearance(selected)
  expect(screen.queryByTestId(oldOnly)).toBeNull()
  await view.unmount()
})

it("reports missing artwork without starting a frame clock or breaking Home controls", async () => {
  const [missing] = sources(DEFAULT_PLAYER_APPEARANCE)
  if (missing === undefined)
    throw new Error("The appearance must have a required source.")
  mockMissing.add(missing)
  const timing = jest.spyOn(motion, "withTiming")
  await render(
    <NativeAnimatedPlayerArtwork appearance={DEFAULT_PLAYER_APPEARANCE} />,
  )
  expect(screen.getByRole("alert")).toBeOnTheScreen()
  expect(
    screen.getByRole("button", {
      name: copy.interface.profileCard.retryArtwork,
    }),
  ).toBeOnTheScreen()
  expect(timing).not.toHaveBeenCalled()
  mockMissing.clear()
  await fireEvent.press(
    screen.getByRole("button", {
      name: copy.interface.profileCard.retryArtwork,
    }),
  )
  await loadAppearance(DEFAULT_PLAYER_APPEARANCE)
  expect(screen.queryByRole("alert")).toBeNull()
})

it("keeps the same loaded artwork static under Reduced Motion", async () => {
  jest.mocked(AccessibilityInfo.isReduceMotionEnabled).mockResolvedValue(true)
  const timing = jest.spyOn(motion, "withTiming")
  const view = await render(
    <NativeAnimatedPlayerArtwork appearance={DEFAULT_PLAYER_APPEARANCE} />,
  )
  await loadAppearance(DEFAULT_PLAYER_APPEARANCE)
  expect(timing).not.toHaveBeenCalled()
  expect(screen.queryByRole("alert")).toBeNull()
  await view.unmount()
})

it("uses the canonical contextual facts while keeping all four play modes directly operable", async () => {
  const initial = createInitialPlayerData()
  const context = { category: "bullet", assistance: "gold" } as const
  const data = {
    ...initial,
    totalXp: 180,
    ratings: {
      ...initial.ratings,
      [playerRatingId("standard", "bullet", "gold")]: 445.2123,
    },
    settings: { ...initial.settings, cardRatingContext: context },
  }
  const facts = cardFacts(data, context)
  const label = copy.profile.cardRatingContext(
    copy.gameplay.clock.category.bullet,
    copy.shared.story.medals.gold,
  )
  const select = jest.fn()
  const customize = jest.fn()
  const share = jest.fn()
  await render(
    <Home
      state={{
        playerData: data,
        disabled: false,
        settingsDisabled: false,
        settingsOpen: false,
        resumeMatch: null,
      }}
      commands={{
        selectMode: select,
        resume: jest.fn(),
        settings: jest.fn(),
        customize,
        share,
      }}
      copy={copy}
      locale="en"
      elements={nativeHomeElements}
      settingsFocusTarget={null}
    />,
  )
  expect(
    screen.getByLabelText(
      copy.profile.cardDescription(
        facts.level,
        facts.standard,
        facts.chess960,
        label,
      ),
    ),
  ).toBeOnTheScreen()
  for (const choice of MATCH_MODE_CHOICES) {
    await fireEvent.press(
      screen.getByRole("button", {
        name: copy.setup.presentations[choice.variant][choice.mode].title,
      }),
    )
    expect(select).toHaveBeenLastCalledWith({
      mode: choice.mode,
      variant: choice.variant,
    })
  }
  await fireEvent.press(
    screen.getByRole("button", { name: copy.setup.customizeProfile }),
  )
  await fireEvent.press(
    screen.getByRole("button", { name: copy.setup.shareProfile }),
  )
  expect(customize).toHaveBeenCalledTimes(1)
  expect(share).toHaveBeenCalledTimes(1)
})

it("preserves numeric source-frame selection within the native export SVG", async () => {
  const data = createInitialPlayerData()
  const input = {
    appearance: data.appearance,
    facts: cardFacts(data),
    content: { ...INITIAL_CARD_CONTENT, animal: false },
    format: "PNG" as const,
  }
  const loaded = jest.fn()
  await render(
    <NativeCardArtwork input={input} frame={8} onAssetLoaded={loaded} />,
  )
  const [source] = sources(data.appearance)
  if (source === undefined)
    throw new Error("The card must include human artwork.")
  const image = screen.getByTestId(source)
  expect(image.props.x).toBe(-90)
  await fireEvent(image, "load")
  expect(loaded).toHaveBeenCalledWith(source)
})
