"use client"

import {
  ART_CREDITS,
  ART_CREDITS_COPY,
} from "@mapachess/match-presentation/art-credits"
import MapachessButton from "../presentation/MapachessButton"

export default function ArtCredits({
  open,
  onOpen,
  onClose,
}: Readonly<{ open: boolean; onOpen: () => void; onClose: () => void }>) {
  return (
    <details open={open} className="text-mapachito-charcoal mt-7 text-base">
      <summary
        className="min-h-12 cursor-pointer content-center rounded-lg font-bold focus-visible:outline-2"
        onClick={(event) => {
          event.preventDefault()
          if (open) onClose()
          else onOpen()
        }}
      >
        {ART_CREDITS_COPY.title}
      </summary>
      <ul className="mt-4 grid gap-6">
        {Object.entries(ART_CREDITS).map(([id, credit]) => (
          <li key={id}>
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
                  className="text-mapachito-violet inline-flex min-h-12 items-center rounded underline underline-offset-4 focus-visible:outline-2"
                >
                  {label}
                  {url === credit.licenseUrl ? ` · ${credit.license}` : ""}
                  <span className="sr-only">
                    {" "}
                    · {credit.title} · {ART_CREDITS_COPY.externalLink}
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
                  className="text-mapachito-violet inline-flex min-h-12 items-center rounded underline underline-offset-4 focus-visible:outline-2"
                >
                  {credit.license}
                  <span className="sr-only">
                    {" "}
                    · {ART_CREDITS_COPY.externalLink}
                  </span>
                </a>
              )}
            </div>
          </li>
        ))}
      </ul>
      <MapachessButton
        variant="secondary"
        type="button"
        onClick={onClose}
        className="mt-6"
      >
        {ART_CREDITS_COPY.close}
      </MapachessButton>
    </details>
  )
}
