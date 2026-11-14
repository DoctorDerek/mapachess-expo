import cx from "classix"
import type { MatchMedal } from "@mapachess/profile/match-medal"
import NativeImage from "./NativeImage"

export default function NativeMedal({
  medal,
  className,
}: Readonly<{ medal: MatchMedal; className?: string }>) {
  return (
    <NativeImage
      sourceId={`/medals/${medal}.png`}
      className={cx("size-7 shrink-0", className)}
      accessible={false}
    />
  )
}
