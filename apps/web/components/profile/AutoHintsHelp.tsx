import { AUTO_HINT_MODES } from "@mapachess/match/auto-hint-mode"
import { useMapachessCopy } from "./MapachessLocaleProvider"
import SettingsView from "./SettingsView"

export default function AutoHintsHelp({
  onClose,
  closeLabel,
}: Readonly<{ onClose: () => void; closeLabel?: string }>) {
  const copy = useMapachessCopy()
  return (
    <SettingsView
      title={copy.shared.settingsControls.autoHints}
      closeLabel={closeLabel ?? copy.shared.settingsControls.back}
      onClose={onClose}
      focusHeading
    >
      <dl className="mt-5 grid gap-6 text-base leading-relaxed">
        {AUTO_HINT_MODES.map((mode) => (
          <div key={mode}>
            <dt className="font-black">{copy.setup.autoHints[mode].label}</dt>
            <dd className="mt-1">{copy.setup.autoHints[mode].description}</dd>
            <dd className="text-mapachito-violet mt-2 font-bold">
              {copy.setup.autoHints[mode].medal}
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-6 text-base leading-relaxed">
        {copy.setup.hintMedalExplanation}
      </p>
      <p className="mt-3 text-base leading-relaxed">
        {copy.gameplay.hints.xpUnchanged}
      </p>
    </SettingsView>
  )
}
