import { coachPortraitFrame } from "@mapachess/match-presentation/coach-portrait"
import type useDecodedCoachPortrait from "../../lib/presentation/useDecodedCoachPortrait"

export default function CoachPortraitImage({
  portrait,
}: Readonly<{
  portrait: ReturnType<typeof useDecodedCoachPortrait>
}>) {
  const frame = coachPortraitFrame(portrait.collection, portrait.label)
  return (
    <span
      aria-hidden="true"
      className="relative grid size-full place-items-center overflow-hidden"
    >
      {portrait.source === null ? (
        <span className="font-display text-mapachito-white text-2xl font-black">
          M
        </span>
      ) : (
        <img
          alt=""
          className="absolute block max-w-none [image-rendering:pixelated]"
          height={frame.sourceSize}
          width={frame.sourceSize}
          src={portrait.source}
          onError={portrait.onImageError}
          style={{
            width: `${(100 * frame.sourceSize) / frame.size}%`,
            height: `${(100 * frame.sourceSize) / frame.size}%`,
            left: `${(-100 * frame.x) / frame.size}%`,
            top: `${(-100 * frame.y) / frame.size}%`,
          }}
        />
      )}
    </span>
  )
}
