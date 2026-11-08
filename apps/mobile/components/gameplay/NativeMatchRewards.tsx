import { ScrollView, View } from "react-native"
import type { DurableMatchRecord } from "@mapachess/match/durable-match-record"
import { matchConclusionText } from "@mapachess/match/match-conclusion"
import type { MatchSetup } from "@mapachess/match/match-setup"
import stockfishOpponent from "@mapachess/match/stockfish-opponent"
import { timeCategory } from "@mapachess/match/time-control"
import { LEVEL_ACHIEVEMENTS } from "@mapachess/profile/global-xp"
import matchVictoryMedal, {
  matchMedalEligibility,
} from "@mapachess/profile/match-medal"
import type {
  AcceptedMatchReward,
  MapachessPlayerData,
} from "@mapachess/profile/player-data"
import { selectStoryLadder } from "@mapachess/profile/story-progress"
import { NativeInputSurface } from "../input/NativeInputProvider"
import NativeButton from "../presentation/NativeButton"
import NativeMedal from "../presentation/NativeMedal"
import NativeText from "../presentation/NativeText"
import { useNativeLocale } from "../profile/NativeLocaleProvider"
import NativeLevelProgress from "./NativeLevelProgress"

export default function NativeMatchRewards({
  match,
  reward,
  data,
  onDismiss,
  onSetup,
  onReplay,
}: Readonly<{
  match: DurableMatchRecord
  reward: AcceptedMatchReward | null
  data: MapachessPlayerData
  onDismiss: () => void
  onSetup: (setup: MatchSetup) => void
  onReplay: () => void
}>) {
  const { copy } = useNativeLocale()
  if (match.conclusion === null) return null
  const medal = matchVictoryMedal(match)
  const assistance = matchMedalEligibility(match)
  const won =
    "winner" in match.conclusion &&
    match.conclusion.winner === match.playerColor
  const opponent = stockfishOpponent(match.opponentId)
  const next =
    match.mode === "story" && medal !== null
      ? selectStoryLadder(
          data.storyProgress,
          match.startingPosition.variant,
        ).find((entry) => entry.status === "unlocked")
      : undefined
  const action =
    match.mode === "challenge" || medal === null
      ? "replay"
      : next === undefined
        ? "ladder"
        : "next"
  const target =
    action === "next" && next !== undefined ? next.opponent : opponent
  return (
    <NativeInputSurface
      modal
      className="bg-mapachito-charcoal"
      onAction={(action) => {
        if (action !== "cancel" && action !== "menu") return false
        onDismiss()
        return true
      }}
    >
      <ScrollView
        className="min-h-0 flex-1"
        contentContainerClassName="gap-3 p-4"
      >
        <NativeText
          accessibilityRole="header"
          className="font-native text-center text-3xl"
        >
          {won
            ? copy.gameplay.defeatedOpponent(
                copy.animals.opponent(match.opponentId),
              )
            : matchConclusionText(
                match.conclusion,
                match.playerColor,
                copy.animals.opponent(match.opponentId),
                copy.gameplay.conclusion,
              )}
        </NativeText>
        {medal === null ? (
          <NativeText className="text-center">
            {copy.gameplay.noNewMedal}
          </NativeText>
        ) : (
          <View className="flex-row flex-wrap items-center justify-center gap-2">
            <NativeMedal medal={medal} />
            <NativeText>
              {copy.shared.story.medals[medal]} ·{" "}
              {copy.shared.medalHintUse[medal]}
            </NativeText>
          </View>
        )}
        {reward === null ? null : (
          <NativeText className="font-native text-center text-3xl">
            {copy.gameplay.awardedXp(reward.awardedXp)}
          </NativeText>
        )}
        {reward?.ratedElo === null || reward?.ratedElo === undefined ? null : (
          <View className="flex-row flex-wrap items-center justify-between gap-3">
            <View className="min-w-36 flex-1 gap-1">
              <NativeText className="font-native">
                {copy.profile.ratingLabel[reward.ratedElo.variant]}
              </NativeText>
              <View className="flex-row flex-wrap items-center gap-1">
                <NativeMedal medal={reward.ratedElo.assistance ?? assistance} />
                <NativeText>
                  {copy.profile.cardRatingContext(
                    copy.gameplay.clock.category[
                      reward.ratedElo.timeCategory ??
                        timeCategory(match.timeControl)
                    ],
                    copy.shared.story.medals[
                      reward.ratedElo.assistance ?? assistance
                    ],
                  )}
                </NativeText>
              </View>
            </View>
            <NativeText className="font-native text-right text-2xl">
              {copy.gameplay.elo(reward.ratedElo.before)} →{" "}
              {copy.gameplay.elo(reward.ratedElo.after)}
            </NativeText>
          </View>
        )}
        {LEVEL_ACHIEVEMENTS.filter(({ id }) =>
          reward?.unlockedAchievementIds.includes(id),
        ).map(({ id, level }) => (
          <NativeText key={id}>
            {copy.gameplay.achievementUnlocked(
              copy.gameplay.levelAchievement(level),
            )}
          </NativeText>
        ))}
      </ScrollView>
      <View className="shrink-0 gap-2 px-3 pt-3 pb-2">
        <View className="flex-row flex-wrap gap-2">
          <NativeButton
            variant="secondary"
            className="min-w-28 flex-1"
            onPress={onDismiss}
          >
            {copy.interface.matchCelebration.reviewBoard}
          </NativeButton>
          <NativeButton
            className="min-w-40 flex-1"
            onPress={() => {
              if (match.mode === "challenge") onReplay()
              else
                onSetup({
                  mode: "story",
                  variant: match.startingPosition.variant,
                  ...(action === "ladder" ? {} : { opponentId: target.id }),
                  timeControl: match.timeControl,
                })
            }}
          >
            <NativeText className="font-native text-center">
              {copy.gameplay.resultActions[action]}
            </NativeText>
            {action === "ladder" ? null : (
              <NativeText className="text-center text-sm">
                {copy.gameplay.opponentAndElo(
                  copy.animals.opponent(target.id),
                  action === "next" || match.mode === "story"
                    ? target.storyTargetElo
                    : (match.opponentTargetElo ?? target.storyTargetElo),
                )}
              </NativeText>
            )}
          </NativeButton>
        </View>
        {reward === null ? null : (
          <NativeLevelProgress
            beforeXp={reward.totalXpBefore}
            afterXp={reward.totalXpBefore + reward.awardedXp}
          />
        )}
      </View>
    </NativeInputSurface>
  )
}
