import { useEffect, useRef, type ReactNode } from "react"
import MatchSetup from "@mapachess/application-ui/match-setup"
import type { SetupEditor, SetupSource } from "@mapachess/gameplay/match-setup"
import type { AutoHintMode } from "@mapachess/match/auto-hint-mode"
import type { MatchSetup as MatchSetupRequest } from "@mapachess/match/match-setup"
import type { StockfishOpponentId } from "@mapachess/match/stockfish-opponent"
import webSetupElements, {
  WebSetupInput,
} from "@/components/gameplay/WebSetupElements"
import { useMapachessCopy } from "@/components/profile/MapachessLocaleProvider"
import { generateWebChess960Position } from "@/lib/gameplay/webOpponent"

export type WebMatchSetupProps = SetupSource &
  Readonly<{
    header?: ReactNode
    disabled: boolean
    opening?: boolean
    onPlayerAnimalChanged?: (animal: StockfishOpponentId) => void
    onAutoHintModeChanged: (mode: AutoHintMode) => void
    onBack: () => void
    onStart: (setup: MatchSetupRequest) => void
    setup: MatchSetupRequest
    visible: boolean
    editing: SetupEditor | null
    editorVisible?: boolean
    onEditorOpened: (editor: SetupEditor) => void
    onEditorClosed: () => void
  }>
export default function WebMatchSetup({ setup, ...props }: WebMatchSetupProps) {
  const difficultyInput = useRef<HTMLInputElement>(null)
  const editorTrigger = useRef<HTMLElement | null>(null)
  useEffect(() => {
    if (!props.visible) {
      editorTrigger.current = null
      return
    }
    if (props.editing !== null || props.disabled || props.opening) return
    editorTrigger.current?.focus({ preventScroll: true })
    editorTrigger.current = null
  }, [props.disabled, props.editing, props.opening, props.visible])
  return (
    <WebSetupInput
      exactInput={difficultyInput}
      playerAnimal={
        setup.mode === "story"
          ? props.playerAppearance?.animal
          : "raccoon-stockfish"
      }
    >
      <MatchSetup
        {...props}
        initial={setup}
        copy={useMapachessCopy()}
        elements={webSetupElements}
        generatePosition={() => generateWebChess960Position(globalThis.crypto)}
        focusDifficulty={() => difficultyInput.current?.focus()}
        onEditorOpened={(editor) => {
          editorTrigger.current =
            document.activeElement instanceof HTMLElement
              ? document.activeElement
              : null
          props.onEditorOpened(editor)
        }}
      />
    </WebSetupInput>
  )
}
