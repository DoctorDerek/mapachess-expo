import Chessboard, {
  type ChessboardProps,
} from "@mapachess/application-ui/chessboard"
import type { ChessAppearanceSettings } from "@mapachess/profile/chess-appearance-settings"
import nativeBoardElements, {
  NativeBoardAppearance,
} from "@/components/gameplay/NativeBoardElements"
import { useNativeLocale } from "@/components/profile/NativeLocaleProvider"

export default function NativeChessboard({
  appearance,
  ...props
}: Omit<ChessboardProps, "copy" | "elements" | "palette"> &
  Readonly<{ appearance: ChessAppearanceSettings }>) {
  const { copy } = useNativeLocale()
  return (
    <NativeBoardAppearance appearance={appearance}>
      {(palette) => (
        <Chessboard
          {...props}
          palette={palette}
          copy={copy.board}
          elements={nativeBoardElements}
        />
      )}
    </NativeBoardAppearance>
  )
}
