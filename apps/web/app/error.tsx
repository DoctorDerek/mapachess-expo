"use client"

import MapachessButton from "../components/presentation/MapachessButton"
import { useMapachessCopy } from "../components/profile/MapachessLocaleProvider"
import FullPageProfilePanel from "../components/profile/ProfileFoundation"

export default function ApplicationError({
  retry,
}: Readonly<{ retry: () => void }>) {
  const messages = useMapachessCopy().interface.error

  return (
    <FullPageProfilePanel
      title={messages.mapachessCouldNotDisplayThisPage}
      description={messages.yourSavedPlayerDataHasNotBeen}
      eyebrow={messages.pageRecovery}
      live="assertive"
    >
      <MapachessButton className="mt-7" onClick={retry}>
        {messages.tryAgain}
      </MapachessButton>
    </FullPageProfilePanel>
  )
}
