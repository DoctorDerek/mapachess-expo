import type { ComponentProps } from "react"
import SetupChoices from "@mapachess/application-ui/setup-choices"
import webSetupElements from "@/components/gameplay/WebSetupElements"
import { useMapachessCopy } from "@/components/profile/MapachessLocaleProvider"

export type AutoHintModeChoicesProps = Omit<
  ComponentProps<typeof SetupChoices>,
  "copy" | "elements" | "onChange"
> &
  Readonly<{
    onAutoHintModeChanged: ComponentProps<typeof SetupChoices>["onChange"]
  }>
export default function AutoHintModeChoices({
  onAutoHintModeChanged,
  ...props
}: AutoHintModeChoicesProps) {
  return (
    <SetupChoices
      {...props}
      onChange={onAutoHintModeChanged}
      copy={useMapachessCopy()}
      elements={webSetupElements}
    />
  )
}
