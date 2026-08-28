import type { Metadata } from "next"
import { notFound } from "next/navigation"
import StandardChickenPlaytest from "../../components/gameplay/StandardChickenPlaytest"

export const metadata: Metadata = {
  title: "Private Chicken Playtest — Mapachess",
  description: "A private local Mapachess engine playtest.",
}

const privatePlaytestIsEnabled = (): boolean =>
  process.env.NODE_ENV === "development" ||
  process.env.MAPACHESS_ENABLE_PRIVATE_PLAYTEST === "true"

export default function PlaytestPage() {
  if (!privatePlaytestIsEnabled()) notFound()

  return <StandardChickenPlaytest />
}
