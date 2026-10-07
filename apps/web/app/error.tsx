"use client"

import MapachessButton from "../components/presentation/MapachessButton"
import FullPageProfilePanel from "../components/profile/ProfileFoundation"

export default function ApplicationError({
  retry,
}: Readonly<{ retry: () => void }>) {
  return (
    <FullPageProfilePanel
      title="Mapachess could not display this page."
      description="Your saved player data has not been reset. Try opening the page again."
      eyebrow="Page recovery"
      live="assertive"
    >
      <MapachessButton className="mt-7" onClick={retry}>
        Try again
      </MapachessButton>
    </FullPageProfilePanel>
  )
}
