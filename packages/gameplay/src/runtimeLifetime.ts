import type { StockfishEngineSession } from "@mapachess/stockfish/engine-session"

export async function closeOwnedEngineSessions(
  sessions: readonly StockfishEngineSession[],
  failureMessage: string,
): Promise<void> {
  const results = await Promise.allSettled(
    sessions.map((session) => session.close()),
  )
  const errors: unknown[] = []
  for (const result of results) {
    if (result.status === "rejected") {
      const reason: unknown = result.reason
      errors.push(reason)
    }
  }
  if (errors.length === 1) throw errors[0]
  if (errors.length > 1) throw new AggregateError(errors, failureMessage)
}

export default async function closeAfterFailedRuntimeOpen(
  sessions: readonly StockfishEngineSession[],
  openingFailure: unknown,
  messages: Readonly<{ close: string; openAndClose: string }>,
): Promise<never> {
  try {
    await closeOwnedEngineSessions(sessions, messages.close)
  } catch (closeFailure) {
    const failures: readonly unknown[] =
      closeFailure instanceof AggregateError
        ? closeFailure.errors
        : [closeFailure]
    throw new AggregateError(
      [openingFailure, ...failures],
      messages.openAndClose,
    )
  }
  throw openingFailure
}
