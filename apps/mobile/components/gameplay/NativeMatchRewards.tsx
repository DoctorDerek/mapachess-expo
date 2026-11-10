import cx from "classix"
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { ScrollView, View } from "react-native"
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated"
import type { MapachessCatalog } from "@mapachess/localization/catalog"
import type { DurableMatchRecord } from "@mapachess/match/durable-match-record"
import type { MatchSetup } from "@mapachess/match/match-setup"
import { LEVEL_ACHIEVEMENTS } from "@mapachess/profile/global-xp"
import type { MatchMedal } from "@mapachess/profile/match-medal"
import matchResultPresentation, {
  matchResultRating,
  SAVE_CONFIRMATION_DURATION_MS,
} from "@mapachess/profile/match-result-presentation"
import type { AcceptedMatchReward } from "@mapachess/profile/player-data"
import type { StoryProgress } from "@mapachess/profile/story-progress"
import useNativePresentationActivity from "@/lib/presentation/useNativePresentationActivity"
import { NativeInputSurface } from "../input/NativeInputProvider"
import NativeButton from "../presentation/NativeButton"
import NativeMedal from "../presentation/NativeMedal"
import NativeText from "../presentation/NativeText"
import { useNativeLocale } from "../profile/NativeLocaleProvider"
import NativeLevelProgress from "./NativeLevelProgress"

type ResultActions = Readonly<{
  disabled: boolean
  onSetup: (setup: MatchSetup) => void
  onReplay: () => void
}>

type Celebration = ResultActions &
  Readonly<{
    match: DurableMatchRecord
    reward: AcceptedMatchReward
    storyProgress: StoryProgress
    showSaveConfirmation: boolean
    onDismiss: () => void
  }>

function NativeSavedConfirmation({ label }: Readonly<{ label: string }>) {
  const { active, reducedMotion } = useNativePresentationActivity()
  const remainingMs = useRef(SAVE_CONFIRMATION_DURATION_MS)
  const [visible, setVisible] = useState(true)
  const opacity = useSharedValue(1)
  const fade = useAnimatedStyle(() => ({ opacity: opacity.value }))
  useEffect(() => {
    if (!visible) {
      opacity.set(!active || reducedMotion ? 0 : withTiming(0))
      return () => cancelAnimation(opacity)
    }
    if (!active) return
    const started = performance.now()
    const timeout = setTimeout(() => setVisible(false), remainingMs.current)
    return () => {
      clearTimeout(timeout)
      remainingMs.current = Math.max(
        0,
        remainingMs.current - (performance.now() - started),
      )
    }
  }, [active, opacity, reducedMotion, visible])
  return (
    <Animated.View
      style={fade}
      accessibilityElementsHidden={!visible}
      importantForAccessibility={visible ? "auto" : "no-hide-descendants"}
    >
      <NativeText
        accessibilityLabel={label}
        accessibilityLiveRegion="polite"
        className="text-mapachito-green-ink text-sm"
      >
        ✓ {label}
      </NativeText>
    </Animated.View>
  )
}

type ResultAction = NonNullable<
  ReturnType<typeof matchResultPresentation>
>["action"]

function NativeResultAction({
  action,
  timeControl,
  copy,
  disabled,
  onSetup,
  onReplay,
}: ResultActions &
  Readonly<{
    action: ResultAction
    timeControl: DurableMatchRecord["timeControl"]
    copy: MapachessCatalog
  }>) {
  const target = action.kind === "ladder" ? null : action.target
  const opponent = target === null ? null : copy.animals.opponent(target.id)
  return (
    <NativeButton
      className="min-w-40 flex-1"
      disabled={disabled}
      onPress={() => {
        if (action.setup === null) onReplay()
        else onSetup({ ...action.setup, timeControl })
      }}
    >
      <NativeText className="font-native text-center">
        {copy.gameplay.resultActions[action.kind]}
      </NativeText>
      {opponent === null ? null : (
        <NativeText className="text-center text-sm">
          {target?.elo === undefined
            ? opponent
            : copy.gameplay.opponentAndElo(opponent, target.elo)}
        </NativeText>
      )}
    </NativeButton>
  )
}

function NativeResultMedal({
  medal,
  copy,
  centered = false,
}: Readonly<{
  medal: MatchMedal
  copy: MapachessCatalog
  centered?: boolean
}>) {
  return (
    <View
      className={cx(
        "flex-row flex-wrap items-center gap-2",
        centered && "justify-center",
      )}
    >
      <NativeMedal medal={medal} />
      <NativeText className="text-mapachito-charcoal shrink">
        <NativeText className="font-native text-mapachito-charcoal">
          {copy.shared.story.medals[medal]}
        </NativeText>{" "}
        · {copy.shared.medalHintUse[medal]}
      </NativeText>
    </View>
  )
}

function rewardContents(
  {
    match,
    reward,
    storyProgress,
    showSaveConfirmation,
    onDismiss,
    ...actions
  }: Celebration,
  copy: MapachessCatalog,
) {
  const result = matchResultPresentation(match, storyProgress, copy)
  if (result === null) return null
  const { medal, heading, reason, storyComplete, timeLabel, action } = result
  const rating = matchResultRating(match, reward)
  return {
    facts: (
      <View className="bg-mapachito-white gap-3 p-4">
        <NativeText
          accessibilityRole="header"
          className="font-native text-mapachito-charcoal text-center text-3xl"
        >
          {heading}
        </NativeText>
        {reason === null ? null : (
          <NativeText className="text-mapachito-charcoal text-center">
            {reason}
          </NativeText>
        )}
        <View className="flex-row flex-wrap items-baseline justify-between gap-x-2 gap-y-1">
          <NativeText className="text-mapachito-charcoal font-bold">
            {timeLabel}
          </NativeText>
          {showSaveConfirmation ? (
            <NativeSavedConfirmation
              label={copy.interface.matchSaveConfirmation.savedLocally}
            />
          ) : null}
        </View>
        {medal === null ? null : (
          <NativeResultMedal medal={medal} copy={copy} centered />
        )}
        <NativeText className="font-native text-mapachito-charcoal text-center text-3xl">
          {copy.gameplay.awardedXp(reward.awardedXp)}
        </NativeText>
        {rating === null ? null : (
          <View className="flex-row flex-wrap items-center justify-between gap-3">
            <View className="min-w-36 flex-1 gap-1">
              <NativeText className="font-native text-mapachito-charcoal">
                {copy.profile.ratingLabel[rating.variant]}
              </NativeText>
              <View className="flex-row flex-wrap items-center gap-1">
                <NativeMedal medal={rating.assistance} />
                <NativeText className="text-mapachito-charcoal shrink">
                  {copy.profile.cardRatingContext(
                    copy.gameplay.clock.category[rating.timeCategory],
                    copy.shared.story.medals[rating.assistance],
                  )}
                </NativeText>
              </View>
            </View>
            <NativeText className="font-native text-mapachito-charcoal text-right text-2xl">
              {copy.gameplay.integer(rating.before)} →{" "}
              {copy.gameplay.integer(rating.after)}
            </NativeText>
          </View>
        )}
        {storyComplete ? (
          <NativeText className="font-native text-mapachito-charcoal">
            {copy.interface.matchCelebration.storyComplete}
          </NativeText>
        ) : null}
        {showSaveConfirmation
          ? LEVEL_ACHIEVEMENTS.filter(({ id }) =>
              reward.unlockedAchievementIds.includes(id),
            ).map(({ id, level }) => (
              <NativeText key={id} className="text-mapachito-charcoal">
                {copy.gameplay.achievementUnlocked(
                  copy.gameplay.levelAchievement(level),
                )}
              </NativeText>
            ))
          : null}
      </View>
    ),
    actions: (
      <View className="shrink-0 gap-2 px-3 pt-3 pb-2">
        <View className="flex-row flex-wrap gap-2">
          <NativeButton
            variant="secondary"
            focusRequested
            className="min-w-28 flex-1"
            onPress={onDismiss}
          >
            {copy.interface.matchCelebration.reviewBoard}
          </NativeButton>
          <NativeResultAction
            {...actions}
            action={action}
            timeControl={match.timeControl}
            copy={copy}
          />
        </View>
        <NativeLevelProgress
          beforeXp={reward.totalXpBefore}
          afterXp={reward.totalXpBefore + reward.awardedXp}
        />
      </View>
    ),
  }
}

export function NativeCompletedMatchResult({
  match,
  storyProgress,
  reward,
  hidden,
  replaySequence,
  onViewRewards,
  ...actions
}: ResultActions &
  Readonly<{
    match: DurableMatchRecord
    storyProgress: StoryProgress
    reward: AcceptedMatchReward | null
    hidden: boolean
    replaySequence: number
    onViewRewards: () => void
  }>) {
  const { copy } = useNativeLocale()
  const openReplay = useRef(0)
  const [restoreFocus, setRestoreFocus] = useState(false)
  const hasReceipt = reward !== null
  const { disabled } = actions
  useEffect(() => {
    const dismissedReplay =
      replaySequence > 0 && openReplay.current === replaySequence && !hidden
    openReplay.current = hidden ? replaySequence : 0
    setRestoreFocus(dismissedReplay && hasReceipt && !disabled)
  }, [disabled, hasReceipt, hidden, replaySequence])

  const result = matchResultPresentation(match, storyProgress, copy)
  if (result === null) return null
  const rating = matchResultRating(match, reward)
  return (
    <View
      accessibilityElementsHidden={hidden}
      importantForAccessibility={hidden ? "no-hide-descendants" : "auto"}
      pointerEvents={hidden ? "none" : "auto"}
      className="bg-mapachito-charcoal max-h-1/3 min-h-0 shrink-0"
    >
      <ScrollView
        className="min-h-0 shrink grow-0"
        contentContainerClassName="bg-mapachito-white gap-2 px-3 py-2"
      >
        <NativeText
          accessibilityRole="header"
          className="font-native text-mapachito-charcoal text-lg"
        >
          {result.heading}
        </NativeText>
        {result.reason === null ? null : (
          <NativeText className="text-mapachito-charcoal">
            {result.reason}
          </NativeText>
        )}
        {result.medal === null ? null : (
          <NativeResultMedal medal={result.medal} copy={copy} />
        )}
        {result.storyComplete ? (
          <NativeText className="font-native text-mapachito-charcoal">
            {copy.interface.matchCelebration.storyComplete}
          </NativeText>
        ) : null}
        {reward === null ? null : (
          <NativeText className="text-mapachito-charcoal font-bold">
            {copy.gameplay.awardedXp(reward.awardedXp)}
          </NativeText>
        )}
        {rating === null ? null : (
          <NativeText className="text-mapachito-charcoal">
            {copy.profile.rating(
              copy.gameplay.clock.rating(
                copy.setup.variants[rating.variant],
                copy.gameplay.clock.category[rating.timeCategory],
                copy.shared.story.medals[rating.assistance],
              ),
              rating.after,
            )}
          </NativeText>
        )}
      </ScrollView>
      <View className="shrink-0 flex-row flex-wrap gap-2 px-2 pt-2 pb-2">
        {hasReceipt ? (
          <NativeButton
            className="min-w-28 flex-1"
            variant="secondary"
            disabled={disabled}
            focusRequested={restoreFocus}
            onPress={onViewRewards}
          >
            {copy.interface.webMatch.viewRewards}
          </NativeButton>
        ) : null}
        <NativeResultAction
          {...actions}
          action={result.action}
          timeControl={match.timeControl}
          copy={copy}
        />
      </View>
    </View>
  )
}

export default function NativeMatchRewards({
  celebration,
  stage,
  stageHeightClassName,
}: Readonly<{
  celebration: Celebration | null
  stage: ReactNode
  stageHeightClassName: string
}>) {
  const { copy } = useNativeLocale()
  const scroll = useRef<ScrollView>(null)
  const content =
    celebration === null ? null : rewardContents(celebration, copy)
  const open = content !== null
  useLayoutEffect(() => {
    if (!open) scroll.current?.scrollTo({ y: 0, animated: false })
  }, [open])

  return (
    <>
      {open ? (
        <View
          importantForAccessibility="no-hide-descendants"
          pointerEvents="none"
          className={cx("w-full shrink-0", stageHeightClassName)}
        />
      ) : null}
      <View
        accessibilityViewIsModal={open}
        className={cx(
          "bg-mapachito-charcoal",
          open ? "absolute inset-0 z-50 min-h-0" : "shrink-0",
          !open && stageHeightClassName,
        )}
      >
        <NativeInputSurface
          enabled={open}
          modal
          onAccessibilityEscape={celebration?.onDismiss}
          onAction={(action) => {
            if (
              celebration === null ||
              (action !== "cancel" && action !== "menu")
            )
              return false
            celebration.onDismiss()
            return true
          }}
        >
          <ScrollView
            ref={scroll}
            className="min-h-0 flex-1"
            scrollEnabled={open}
          >
            {stage}
            {content?.facts}
          </ScrollView>
          {content?.actions}
        </NativeInputSurface>
      </View>
    </>
  )
}
