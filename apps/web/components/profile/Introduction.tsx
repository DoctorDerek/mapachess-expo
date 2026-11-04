"use client"

import loadCatalog from "@mapachess/localization/catalog"
import type { ShippedLocale } from "@mapachess/localization/locale"
import useFirstArrivalMotion from "../../lib/presentation/useFirstArrivalMotion"
import FirstArrivalRaccoon from "../presentation/FirstArrivalRaccoon"
import MapachessButton from "../presentation/MapachessButton"
import ScrollActions from "../presentation/ScrollActions"
import LanguageChoice from "./LanguageChoice"
import { useMapachessLocale } from "./MapachessLocaleProvider"

export function RestoringIntroduction() {
  const locale = useMapachessLocale()
  return <Introduction locale={locale} pending={false} blocked={false} />
}

export default function Introduction({
  locale,
  pending,
  blocked,
  onLocaleChanged,
  onStart,
}: Readonly<{
  locale: ShippedLocale
  pending: boolean
  blocked: boolean
  onLocaleChanged?: (locale: ShippedLocale) => void
  onStart?: () => void
}>) {
  const copy = loadCatalog(locale).introduction
  const motion = useFirstArrivalMotion(Boolean(onStart) && !pending && !blocked)
  return (
    <div
      inert={blocked}
      className="bg-mapachito-white relative isolate h-dvh overflow-hidden pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]"
    >
      <ScrollActions
        actions={
          <div
            inert={!onStart}
            aria-hidden={!onStart || undefined}
            className="relative z-30 mx-auto grid w-full max-w-xl shrink-0 gap-3 px-6 pt-4 pb-5"
          >
            <LanguageChoice
              locale={locale}
              disabled={pending || !onStart}
              onChange={(selected) => {
                motion.cancel()
                onLocaleChanged?.(selected)
              }}
            />
            <MapachessButton
              aria-busy={pending}
              disabled={!onStart}
              busyLabel={copy.starting}
              className="focus-visible:outline-mapachito-deep-cyan min-h-14 w-full text-2xl"
              onClick={() => {
                motion.cancel()
                onStart?.()
              }}
            >
              {copy.start}
            </MapachessButton>
          </div>
        }
      >
        <header className="@container relative flex min-h-24 shrink-0 items-center justify-center px-4 py-5 xl:min-h-32">
          {motion.runRaccoon ? <FirstArrivalRaccoon /> : null}
          <h1 className="font-display text-mapachito-deep-cyan relative z-30 text-center text-[min(clamp(2.875rem,10vw,4.75rem),21cqi)] leading-none font-black tracking-tight">
            {copy.title}
          </h1>
        </header>
        <div className="bg-mapachito-deep-cyan relative z-30 h-1.5 shrink-0" />
        <section
          aria-label={copy.region}
          tabIndex={0}
          className="text-mapachito-charcoal focus-visible:outline-mapachito-deep-cyan relative z-30 mx-auto w-full max-w-4xl px-5 py-5 focus-visible:-outline-offset-4 xl:px-10 xl:py-7"
        >
          <h2 className="mb-4 text-2xl leading-snug font-black">
            {copy.heading}
          </h2>
          <div className="space-y-4 text-lg leading-relaxed">
            {copy.paragraphs.map(({ lead, body }, index) => (
              <p key={index}>
                {lead ? <strong>{lead} </strong> : null}
                {body}
              </p>
            ))}
          </div>
        </section>
        <div className="bg-mapachito-deep-cyan relative z-30 h-1.5 shrink-0" />
        <footer className="relative mt-auto flex min-h-37 shrink-0 items-center justify-center bg-black px-4 py-4">
          <img
            src="/generated/first-arrival/ice-cream.png"
            width={3840}
            height={2160}
            alt=""
            className="pointer-events-none absolute inset-0 mx-auto h-full w-full max-w-80 object-cover"
          />
          <div className="text-mapachito-white relative z-30 grid min-w-0 grid-cols-1 justify-items-center text-center text-xl leading-7 font-black wrap-anywhere">
            <p>{copy.credit}</p>
            <p>{copy.author}</p>
            <a
              className="hover:text-mapachito-orange active:text-mapachito-orange inline-flex min-h-11 max-w-full items-center no-underline transition-colors motion-reduce:transition-none"
              href="https://DoctorDerek.com"
              rel="noopener noreferrer"
              target="_blank"
            >
              {copy.website}
              <span className="sr-only">{copy.websiteNewTab}</span>
            </a>
          </div>
        </footer>
      </ScrollActions>
      {motion.visible ? (
        <canvas
          ref={motion.canvasRef}
          data-testid="first-arrival-animation"
          aria-hidden="true"
          width={1920}
          height={1080}
          className="pointer-events-none fixed inset-0 z-10 h-full w-full object-cover"
        />
      ) : null}
    </div>
  )
}
