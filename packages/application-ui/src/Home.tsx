import cx from "classix"
import type { HomeCommands, HomeState } from "@mapachess/gameplay/home"
import type { MapachessCatalog } from "@mapachess/localization/catalog"
import type { ShippedLocale } from "@mapachess/localization/locale"
import { MATCH_MODE_CHOICES } from "@mapachess/match/match-setup"
import { timeControlLabel } from "@mapachess/match/time-control"
import type { MapachessPlayerData } from "@mapachess/profile/player-data"
import type { HomeElements } from "./homeElements.js"
import ProfileCard from "./ProfileCard.js"

export default function Home<FocusTarget>({
  state,
  commands,
  copy,
  locale,
  elements,
  settingsFocusTarget,
}: Readonly<{
  state: HomeState & Readonly<{ playerData: MapachessPlayerData }>
  commands: HomeCommands
  copy: MapachessCatalog
  locale: ShippedLocale
  elements: HomeElements<FocusTarget>
  settingsFocusTarget: FocusTarget
}>) {
  const { Surface, Group, Title, Text, Action, Settings } = elements
  return (
    <Surface className="font-home max-w-mapachess mx-auto w-full">
      <Group
        region="header"
        className="mb-4 flex w-full flex-row flex-wrap items-center justify-between gap-3"
      >
        <Title label={copy.introduction.title} />
        <Settings
          disabled={state.settingsDisabled}
          expanded={state.settingsOpen}
          focusTarget={settingsFocusTarget}
          onActivate={commands.settings}
        >
          {copy.interface.webGame.settings}
        </Settings>
      </Group>
      <Group
        region="columns"
        className="flex flex-col gap-6 xl:flex-row xl:items-center"
      >
        <Group
          region="profile"
          className="min-w-0 xl:shrink xl:grow-[1.7] xl:basis-0"
        >
          <ProfileCard
            data={state.playerData}
            copy={copy}
            locale={locale}
            elements={elements.card}
          />
          <Group
            region="profile-actions"
            className="mt-4 mr-1.5 flex flex-row flex-wrap gap-3"
          >
            <Action
              kind="customize"
              disabled={state.disabled}
              onActivate={commands.customize}
              className="bg-mapachito-violet shadow-mapachess-raised shadow-mapachito-raspberry min-w-28 flex-1 basis-28 wrap-break-word"
            >
              {copy.setup.customizeProfile}
            </Action>
            <Action
              kind="share"
              disabled={state.disabled}
              onActivate={commands.share}
              className="bg-mapachito-blue shadow-mapachess-raised shadow-mapachito-deep-cyan min-w-28 flex-1 basis-28 wrap-break-word"
            >
              {copy.setup.shareProfile}
            </Action>
          </Group>
        </Group>
        <Group
          region="play"
          className="flex min-w-0 flex-row flex-wrap gap-3 pr-1.5 pb-1.5 xl:flex-1"
        >
          {state.resumeMatch === null ? null : (
            <Action
              kind="resume"
              disabled={state.resumeMatch.disabled}
              onActivate={commands.resume}
              className="flex min-w-0 basis-full flex-row flex-wrap items-baseline justify-center gap-x-2 gap-y-1 wrap-break-word"
            >
              <Text className="font-home text-mapachito-white">
                {copy.interface.webGame.resumeMatch}
              </Text>
              <Text className="font-home text-mapachito-white text-base font-semibold">
                {timeControlLabel(
                  state.resumeMatch.timeControl,
                  copy.gameplay.clock,
                )}
              </Text>
            </Action>
          )}
          {MATCH_MODE_CHOICES.map(({ mode, variant }) => (
            <Action
              key={`${variant}:${mode}`}
              kind="mode"
              disabled={state.disabled}
              onActivate={() => commands.selectMode({ mode, variant })}
              label={copy.setup.presentations[variant][mode].title}
              className={cx(
                "shadow-mapachess-raised flex min-h-25 min-w-32 shrink grow basis-[45%] flex-col items-stretch justify-center gap-3 text-left wrap-break-word xl:min-h-32",
                variant === "standard" &&
                  mode === "story" &&
                  "bg-mapachito-violet shadow-mapachito-blue",
                variant === "standard" &&
                  mode === "challenge" &&
                  "bg-mapachito-orange shadow-mapachito-deep-gold",
                variant === "chess960" &&
                  mode === "story" &&
                  "bg-mapachito-deep-cyan shadow-mapachito-green-shadow",
                variant === "chess960" &&
                  mode === "challenge" &&
                  "bg-mapachito-raspberry shadow-mapachito-red",
              )}
            >
              <Text
                emphasis
                className="font-home text-mapachito-white text-xl leading-tight font-black xl:text-2xl"
              >
                {copy.setup.variants[variant]}
              </Text>
              <Group
                region="mode-label"
                className="flex flex-row flex-wrap items-center justify-between gap-1 text-lg"
              >
                <Text className="font-home text-mapachito-white text-lg">
                  {copy.setup.modes[mode]}
                </Text>
                <Text
                  decorative
                  className="text-mapachito-white font-mono text-lg"
                >
                  →
                </Text>
              </Group>
            </Action>
          ))}
        </Group>
      </Group>
    </Surface>
  )
}
