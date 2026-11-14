import { useRef } from "react"
import { TextInput } from "react-native"
import MatchSetup from "@mapachess/application-ui/match-setup"
import { selectSetupEditor } from "@mapachess/gameplay/match-setup"
import type { AutoHintMode } from "@mapachess/match/auto-hint-mode"
import type {
  MatchNavigationCommands,
  MatchNavigationOverlay,
} from "@mapachess/match/match-navigation"
import type { MatchSetup as MatchSetupRequest } from "@mapachess/match/match-setup"
import type { StockfishOpponentId } from "@mapachess/match/stockfish-opponent"
import type { MapachessPlayerData } from "@mapachess/profile/player-data"
import nativeSetupElements, {
  NativeSetupInput,
} from "@/components/gameplay/NativeSetupElements"
import { useNativeLocale } from "@/components/profile/NativeLocaleProvider"
import { generateNativeChess960Position } from "@/lib/gameplay/nativeCryptography"

export default function NativeMatchSetup({
  initial,
  data,
  disabled,
  navigation,
  overlay,
  overlays = overlay === undefined ? [] : [overlay],
  onStart,
  onAutoHintModeChanged,
  onPlayerAnimalChanged,
}: Readonly<{
  initial: MatchSetupRequest
  data: MapachessPlayerData
  disabled: boolean
  navigation: MatchNavigationCommands
  overlay: MatchNavigationOverlay | undefined
  overlays?: readonly MatchNavigationOverlay[]
  onStart: (setup: MatchSetupRequest) => void
  onAutoHintModeChanged: (mode: AutoHintMode) => void
  onPlayerAnimalChanged: (animal: StockfishOpponentId) => void
}>) {
  const input = useRef<TextInput>(null)
  const editor = selectSetupEditor(overlays)
  return (
    <NativeSetupInput
      exactInput={input}
      appearance={data.settings.chessAppearance}
    >
      <MatchSetup
        initial={initial}
        copy={useNativeLocale().copy}
        elements={nativeSetupElements}
        disabled={disabled}
        visible={overlay === undefined || editor.active}
        editing={editor.editor}
        editorVisible={editor.active}
        onEditorOpened={(kind) => navigation.open(`setup-${kind}`)}
        onEditorClosed={navigation.back}
        onBack={navigation.back}
        onStart={onStart}
        storyProgress={data.storyProgress}
        challengeHistory={data.challengeHistory}
        autoHintMode={data.settings.autoHintMode}
        playerAppearance={data.appearance}
        ratings={data.ratings}
        generatePosition={generateNativeChess960Position}
        focusDifficulty={() => input.current?.focus()}
        onAutoHintModeChanged={onAutoHintModeChanged}
        onPlayerAnimalChanged={onPlayerAnimalChanged}
      />
    </NativeSetupInput>
  )
}
