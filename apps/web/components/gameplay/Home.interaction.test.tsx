// @vitest-environment happy-dom
import { act, fireEvent, render, screen, within } from "@testing-library/react"
import { createRef } from "react"
import { describe, expect, it, vi } from "vitest"
import { createActor } from "xstate"
import Home from "@mapachess/application-ui/home"
import loadCatalog from "@mapachess/localization/catalog"
import { MATCH_MODE_CHOICES } from "@mapachess/match/match-setup"
import {
  TIME_CONTROL_PRESETS,
  timeControlLabel,
} from "@mapachess/match/time-control"
import createInitialPlayerData from "@mapachess/profile/player-data"
import { cardFacts } from "@mapachess/profile/profile-card-model"
import { playerRatingId } from "@mapachess/profile/rating-context"
import WebGame from "@/components/gameplay/WebGame"
import webHomeElements from "@/components/gameplay/WebHomeElements"
import webMatchSessionMachine from "@/lib/gameplay/webMatchSessionMachine"
import { installDomHarness, readyProfile } from "@/test/domHarness"

installDomHarness()
const copy = loadCatalog("en")

describe("shared Home through the web host", () => {
  it.for(MATCH_MODE_CHOICES)(
    "opens $variant $mode from the production Home without starting an engine",
    async (choice, test) => {
      const profile = await readyProfile(test.onTestFinished)
      const open = vi.fn(async () => {
        throw new Error("Home must not start an engine.")
      })
      const actor = createActor(webMatchSessionMachine, {
        input: {
          activeMatchExists: false,
          operations: {
            canNavigate: () => true,
            openCurrentMatch: open,
            openFreshMatch: open,
            returnToMenu: async () => undefined,
          },
        },
      }).start()
      test.onTestFinished(() => {
        actor.stop()
      })
      const settingsRef = createRef<HTMLButtonElement>()
      const settings = vi.fn()
      render(
        <WebGame
          actor={actor}
          profileActor={profile.actor}
          navigation={{ open: vi.fn(), close: vi.fn(), back: vi.fn() }}
          settingsOpen={false}
          settingsButtonRef={settingsRef}
          onSettingsRequested={settings}
        />,
      )
      expect(document.activeElement).toBe(
        screen.getByRole("heading", { name: copy.introduction.title }),
      )
      for (const mode of MATCH_MODE_CHOICES)
        expect(
          screen
            .getByRole("button", {
              name: copy.setup.presentations[mode.variant][mode.mode].title,
            })
            .hasAttribute("disabled"),
        ).toBe(false)
      fireEvent.click(
        screen.getByRole("button", {
          name: copy.setup.presentations[choice.variant][choice.mode].title,
        }),
      )
      expect(actor.getSnapshot().matches({ menu: "setup" })).toBe(true)
      const setup = actor.getSnapshot().context.requestedSetup
      expect(
        setup.mode === "story" ? setup.variant : setup.challengeSetup.variant,
      ).toBe(choice.variant)
      expect(open).not.toHaveBeenCalled()
      await act(async () =>
        actor.send({ type: "MATCH_SESSION.BACK_REQUESTED" }),
      )
      expect(document.activeElement).toBe(
        screen.getByRole("heading", { name: copy.introduction.title }),
      )
      fireEvent.click(
        screen.getByRole("button", { name: copy.interface.webGame.settings }),
      )
      expect(settings).toHaveBeenCalledOnce()
    },
  )

  it("renders the same contextual card, explicit timed Resume and management commands without truncating labels", () => {
    const initial = createInitialPlayerData()
    const context = { category: "bullet", assistance: "gold" } as const
    const data = {
      ...initial,
      totalXp: 180,
      settings: { ...initial.settings, cardRatingContext: context },
      ratings: {
        ...initial.ratings,
        [playerRatingId("standard", "bullet", "gold")]: 445.2123,
      },
    }
    const facts = cardFacts(data)
    const contextLabel = copy.profile.cardRatingContext(
      copy.gameplay.clock.category.bullet,
      copy.shared.story.medals.gold,
    )
    const commands = {
      selectMode: vi.fn(),
      resume: vi.fn(),
      customize: vi.fn(),
      share: vi.fn(),
      settings: vi.fn(),
    }
    const state = {
      playerData: data,
      disabled: false,
      settingsDisabled: false,
      settingsOpen: false,
      resumeMatch: {
        timeControl: TIME_CONTROL_PRESETS[1].control,
        disabled: false,
      },
    }
    const view = render(
      <Home
        state={state}
        commands={commands}
        copy={copy}
        locale="en"
        elements={webHomeElements}
        settingsFocusTarget={null}
      />,
    )
    const card = screen.getByRole("region", {
      name: copy.profile.cardDescription(
        facts.level,
        facts.standard,
        facts.chess960,
        contextLabel,
      ),
    })
    expect(within(card).getByText("445")).toBeDefined()
    expect(within(card).getAllByText(contextLabel)).toHaveLength(2)
    const resume = screen.getByRole("button", {
      name: `${copy.interface.webGame.resumeMatch} ${timeControlLabel(TIME_CONTROL_PRESETS[1].control, copy.gameplay.clock)}`,
    })
    fireEvent.click(resume)
    fireEvent.click(
      screen.getByRole("button", { name: copy.setup.customizeProfile }),
    )
    fireEvent.click(
      screen.getByRole("button", { name: copy.setup.shareProfile }),
    )
    expect(commands.resume).toHaveBeenCalledOnce()
    expect(commands.customize).toHaveBeenCalledOnce()
    expect(commands.share).toHaveBeenCalledOnce()
    view.rerender(
      <Home
        state={{
          ...state,
          disabled: true,
          settingsOpen: true,
          resumeMatch: { ...state.resumeMatch, disabled: true },
        }}
        commands={commands}
        copy={copy}
        locale="en"
        elements={webHomeElements}
        settingsFocusTarget={null}
      />,
    )
    expect(
      screen
        .getByRole("button", { name: copy.setup.customizeProfile })
        .hasAttribute("disabled"),
    ).toBe(true)
    expect(
      screen
        .getByRole("button", { name: copy.setup.shareProfile })
        .hasAttribute("disabled"),
    ).toBe(true)
    expect(
      screen
        .getByRole("button", { name: copy.interface.webGame.settings })
        .getAttribute("aria-expanded"),
    ).toBe("true")
    expect(resume.hasAttribute("disabled")).toBe(true)
  })

  it("keeps the shipped Mexican Spanish Home copy in the shared composition", () => {
    const catalog = loadCatalog("es-419")
    const commands = {
      selectMode: vi.fn(),
      resume: vi.fn(),
      customize: vi.fn(),
      share: vi.fn(),
      settings: vi.fn(),
    }
    render(
      <Home
        state={{
          playerData: createInitialPlayerData(),
          disabled: false,
          settingsDisabled: true,
          settingsOpen: false,
          resumeMatch: null,
        }}
        commands={commands}
        copy={catalog}
        locale="es-419"
        elements={webHomeElements}
        settingsFocusTarget={null}
      />,
    )
    for (const mode of MATCH_MODE_CHOICES)
      expect(
        screen.getByRole("button", {
          name: catalog.setup.presentations[mode.variant][mode.mode].title,
        }),
      ).toBeDefined()
    expect(
      screen
        .getByRole("button", { name: catalog.interface.webGame.settings })
        .hasAttribute("disabled"),
    ).toBe(true)
    expect(
      screen.queryByRole("button", {
        name: new RegExp(catalog.interface.webGame.resumeMatch),
      }),
    ).toBeNull()
  })
})
