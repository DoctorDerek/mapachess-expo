export default function MapachessWordmark() {
  return (
    <div
      aria-label="Mapachess"
      className="text-mapachito-white inline-flex items-center gap-3"
      role="img"
    >
      <span
        aria-hidden="true"
        className="border-mapachito-charcoal bg-mapachito-orange font-display text-mapachito-charcoal shadow-mapachito-raspberry grid size-11 -rotate-4 place-items-center rounded-[0.625rem_0.125rem_0.625rem_0.125rem] border-3 text-[2rem] leading-none shadow-[0.25rem_0.25rem_0] forced-colors:border-[CanvasText] forced-colors:shadow-none"
      >
        M
      </span>
      <span
        aria-hidden="true"
        className="font-display grid text-xl leading-[0.78] font-black tracking-[0.055em] uppercase"
      >
        <span>Mapa</span>
        <strong className="text-mapachito-deep-gold [font:inherit]">
          Chess
        </strong>
      </span>
    </div>
  )
}
