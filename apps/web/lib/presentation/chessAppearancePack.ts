import {
  CHESS_APPEARANCE_PACK_ROOT,
  chessMemberMediaType,
} from "@/assets/chessAppearancePaths"
import createArtPackAcquisition, {
  readArtDescriptor,
} from "@/lib/presentation/createArtPackAcquisition"
import readIndexedArtPack from "@/lib/presentation/readIndexedArtPack"
import retainedChessAppearance from "@/lib/presentation/retainedChessAppearance"

const json = process.env.MAPACHESS_CHESS_APPEARANCE
const chessAppearancePack = createArtPackAcquisition(
  json
    ? readArtDescriptor(JSON.parse(json), CHESS_APPEARANCE_PACK_ROOT)
    : undefined,
  (bytes, count) =>
    readIndexedArtPack(bytes, count, (path) => path, chessMemberMediaType),
  retainedChessAppearance,
)
export default chessAppearancePack

export async function resolveChessArtwork(path: string) {
  await chessAppearancePack.prepare()
  const source = chessAppearancePack.member(path)
  if (!source)
    throw new Error("The requested chess artwork is unavailable in this build.")
  return source
}
