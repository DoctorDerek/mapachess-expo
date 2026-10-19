"use client"

import localizeArtCredits from "@mapachess/match-presentation/art-credits"
import { useMapachessCopy } from "./MapachessLocaleProvider"
import SettingsView from "./SettingsView"

export default function ArtCredits({
  onClose,
}: Readonly<{ onClose: () => void }>) {
  const copy = useMapachessCopy()
  return (
    <SettingsView
      title={copy.shared.creditControls.title}
      closeLabel={copy.shared.settingsControls.back}
      onClose={onClose}
      focusHeading
    >
      <ul className="mt-5 grid gap-6 text-base leading-relaxed">
        {localizeArtCredits(copy).map((credit) => (
          <li key={credit.id}>
            <h3 className="font-bold">
              {credit.title} · {credit.creator}
            </h3>
            <p>{credit.contribution}</p>
            {credit.modifications === null ? null : (
              <p className="mt-1">{credit.modifications}</p>
            )}
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
              {credit.sources.map(({ url, label }) => (
                <a
                  key={url}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-mapachito-violet inline-block min-h-12 max-w-full min-w-0 content-center rounded wrap-anywhere underline underline-offset-4 focus-visible:outline-2"
                >
                  {label}
                  {url === credit.licenseUrl ? ` · ${credit.license}` : ""}
                  <span className="sr-only">
                    {" "}
                    · {credit.title} · {copy.shared.creditControls.externalLink}
                  </span>
                </a>
              ))}
              {credit.sources.some(
                ({ url }) => url === credit.licenseUrl,
              ) ? null : (
                <a
                  href={credit.licenseUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-mapachito-violet inline-block min-h-12 max-w-full min-w-0 content-center rounded wrap-anywhere underline underline-offset-4 focus-visible:outline-2"
                >
                  {credit.license}
                  <span className="sr-only">
                    {" "}
                    · {copy.shared.creditControls.externalLink}
                  </span>
                </a>
              )}
            </div>
          </li>
        ))}
      </ul>
    </SettingsView>
  )
}
