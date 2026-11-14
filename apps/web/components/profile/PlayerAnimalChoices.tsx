import type { ComponentProps } from "react"
import SetupAnimalChoices from "@mapachess/application-ui/setup-animal-choices"
import webSetupElements from "@/components/gameplay/WebSetupElements"
import { useMapachessCopy } from "@/components/profile/MapachessLocaleProvider"

export default function PlayerAnimalChoices(
  props: Omit<ComponentProps<typeof SetupAnimalChoices>, "copy" | "elements">,
) {
  return (
    <SetupAnimalChoices
      {...props}
      copy={useMapachessCopy()}
      elements={webSetupElements}
    />
  )
}
