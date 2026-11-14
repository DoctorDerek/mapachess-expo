import type { ComponentProps } from "react"
import { SetupStoryChoices } from "@mapachess/application-ui/setup-animal-choices"
import webSetupElements from "@/components/gameplay/WebSetupElements"
import { useMapachessCopy } from "@/components/profile/MapachessLocaleProvider"

export type StoryLadderProgressProps = Omit<
  ComponentProps<typeof SetupStoryChoices>,
  "copy" | "elements"
>
export default function StoryLadderProgress(props: StoryLadderProgressProps) {
  return (
    <SetupStoryChoices
      {...props}
      copy={useMapachessCopy()}
      elements={webSetupElements}
    />
  )
}
