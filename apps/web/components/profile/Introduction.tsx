"use client"

import loadCatalog from "@mapachess/localization/catalog"
import type { ShippedLocale } from "@mapachess/localization/locale"
import useFirstArrivalMotion from "../../lib/presentation/useFirstArrivalMotion"
import FirstArrivalRaccoon from "../presentation/FirstArrivalRaccoon"
import MapachessButton from "../presentation/MapachessButton"
import LanguageChoice from "./LanguageChoice"

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
  onLocaleChanged: (locale: ShippedLocale) => void
  onStart: () => void
}>) {
  const copy = loadCatalog(locale).introduction
  const motion = useFirstArrivalMotion(!pending && !blocked)
  return (
    <div
      inert={blocked}
      className="bg-mapachito-white relative isolate flex min-h-dvh flex-col overflow-x-clip pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]"
    >
      <header className="relative flex min-h-24 shrink-0 items-center justify-center px-4 py-5 xl:min-h-32">
        {motion.runRaccoon ? <FirstArrivalRaccoon /> : null}
        <h1 className="font-display text-mapachito-deep-cyan relative z-30 text-center text-[clamp(2.875rem,10vw,4.75rem)] leading-none font-black tracking-tight">
          {copy.title}
        </h1>
      </header>
      <div className="bg-mapachito-deep-cyan relative z-30 h-1.5 shrink-0" />
      <section
        aria-label={copy.region}
        tabIndex={0}
        className="text-mapachito-charcoal focus-visible:outline-mapachito-deep-cyan relative z-30 mx-auto max-h-[calc(100dvh-26rem)] min-h-48 w-full max-w-4xl flex-1 [scrollbar-gutter:stable] overflow-y-auto overscroll-contain px-5 py-5 focus-visible:-outline-offset-4 xl:max-h-[calc(100dvh-28rem)] xl:px-10 xl:py-7"
      >
        <h2 className="mb-4 text-2xl leading-snug font-black">
          {copy.heading}
        </h2>
        <div className="space-y-4 text-lg leading-relaxed">
          {copy.paragraphs.map(({ lead, body }) => (
            <p key={body}>
              {lead ? <strong>{lead} </strong> : null}
              {body}
            </p>
          ))}
        </div>
      </section>
      <div className="bg-mapachito-deep-cyan relative z-30 h-1.5 shrink-0" />
      <div className="relative z-30 mx-auto grid w-full max-w-xl shrink-0 gap-3 px-6 pt-4 pb-5">
        <LanguageChoice
          locale={locale}
          disabled={pending}
          onChange={(selected) => {
            motion.cancel()
            onLocaleChanged(selected)
          }}
        />
        <MapachessButton
          aria-busy={pending}
          busyLabel={copy.starting}
          className="focus-visible:outline-mapachito-deep-cyan min-h-14 w-full text-2xl"
          onClick={() => {
            motion.cancel()
            onStart()
          }}
        >
          {copy.start}
        </MapachessButton>
      </div>
      <div className="bg-mapachito-deep-cyan relative z-30 h-1.5 shrink-0" />
      <footer className="relative mt-auto flex min-h-37 shrink-0 items-center justify-center bg-black px-4 py-4">
        {/* eslint-disable-next-line @next/next/no-img-element -- Preserve the approved original artwork without an image-service dependency. */}
        <img
          src="/generated/first-arrival/ice-cream.png"
          width={3840}
          height={2160}
          alt=""
          className="pointer-events-none absolute inset-0 mx-auto h-full w-full max-w-80 object-cover"
        />
        <div className="text-mapachito-white relative z-30 grid justify-items-center text-center text-xl leading-7 font-black">
          <p>{copy.credit}</p>
          <p>{copy.author}</p>
          <a
            className="hover:text-mapachito-orange active:text-mapachito-orange inline-flex min-h-11 items-center no-underline transition-colors motion-reduce:transition-none"
            href="https://DoctorDerek.com"
            rel="noopener noreferrer"
            target="_blank"
          >
            {copy.website}
            <span className="sr-only">{copy.websiteNewTab}</span>
          </a>
        </div>
      </footer>
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
