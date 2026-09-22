import { notFound } from "next/navigation"
import ReactionPlaytest from "../../../components/gameplay/ReactionPlaytest"
import WebMapachessApplication from "../../../components/profile/WebMapachessApplication"

export const metadata = { robots: { index: false, follow: false } }

export default function ReactionPlaytestPage() {
  if (
    process.env.NODE_ENV !== "development" &&
    process.env.VERCEL_ENV !== "preview"
  )
    notFound()
  return (
    <ReactionPlaytest>
      <WebMapachessApplication />
    </ReactionPlaytest>
  )
}
