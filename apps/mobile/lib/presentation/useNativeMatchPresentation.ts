import { useEffect, useState } from "react"
import type { MatchSession } from "@mapachess/gameplay/match-session"
import bindAcceptedMatchPresentation, {
  type AcceptedMatchPresentationBinding,
} from "@mapachess/match-presentation/accepted-match-presentation"

export default function useNativeMatchPresentation(
  session: MatchSession,
  replaySequence: number,
): AcceptedMatchPresentationBinding | null {
  const [binding, setBinding] =
    useState<AcceptedMatchPresentationBinding | null>(null)
  useEffect(() => {
    const opened = bindAcceptedMatchPresentation(
      session.actor,
      session.match.playerColor,
    )
    setBinding(opened)
    return opened.close
  }, [session])
  useEffect(() => {
    if (replaySequence > 0) binding?.replay()
  }, [binding, replaySequence])
  return binding
}
