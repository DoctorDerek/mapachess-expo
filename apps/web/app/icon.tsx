import { ImageResponse } from "next/og"

export const size = {
  width: 64,
  height: 64,
}

export const contentType = "image/png"

const iconAppearance = {
  tw: "flex h-full w-full items-center justify-center border-[6px] border-[#1e1e1e] bg-[#a77e18] text-[40px] font-black text-[#1e1e1e]",
}

export default function Icon() {
  return new ImageResponse(<div {...iconAppearance}>M</div>, size)
}
