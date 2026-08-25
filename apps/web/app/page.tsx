export default function HomePage() {
  return (
    <main className="relative isolate grid min-h-dvh place-items-center overflow-hidden px-[clamp(1.25rem,4vw,4rem)] py-[clamp(2rem,7vw,6rem)]">
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-20 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.16),transparent_38%),radial-gradient(circle_at_bottom_right,rgba(167,139,250,0.18),transparent_42%),linear-gradient(145deg,#07121e_0%,#0d1726_48%,#171128_100%)]"
      />
      <div
        aria-hidden="true"
        className="absolute inset-x-[8%] top-[12%] -z-10 h-px bg-gradient-to-r from-transparent via-cyan-200/40 to-transparent"
      />

      <section
        aria-labelledby="mapachess-title"
        className="w-full max-w-3xl min-w-0 rounded-[clamp(1.5rem,4vw,2.5rem)] border border-white/12 bg-slate-950/72 p-[clamp(2rem,6vw,4.5rem)] shadow-[0_2rem_7rem_rgba(2,6,23,0.55)] backdrop-blur-xl"
      >
        <p className="mb-6 font-mono text-[clamp(0.7rem,1.6vw,0.82rem)] font-semibold tracking-[0.28em] text-cyan-200 uppercase">
          Pre-production
        </p>
        <h1
          id="mapachess-title"
          className="text-[clamp(2.5rem,13vw,8.5rem)] leading-[0.82] font-black tracking-[-0.075em] text-balance text-white"
        >
          Mapa<span className="text-cyan-300">chess</span>
        </h1>
        <p className="mt-9 max-w-2xl text-[clamp(1.1rem,2.5vw,1.5rem)] leading-relaxed text-slate-200">
          A permanently free, accountless chess game built around Better Hints,
          Standard and Chess960 play, and a reactive animal battle stage.
        </p>

        <div className="mt-10 flex items-center gap-4 border-t border-white/10 pt-7 text-[clamp(0.82rem,1.7vw,0.95rem)] text-slate-400">
          <span
            aria-hidden="true"
            className="size-2 rounded-full bg-cyan-300"
          />
          <p>No playable public build yet. Mapachess is in development.</p>
        </div>
      </section>
    </main>
  )
}
