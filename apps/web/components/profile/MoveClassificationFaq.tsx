"use client"

import {
  MOVE_CLASSIFICATION_TABLE,
  MOVE_MATE_CLASSIFICATION_TABLE,
} from "@mapachess/evaluation/move-classification-copy"
import MapachessButton from "../presentation/MapachessButton"

function ClassificationTable({
  headings,
  rows,
}: Readonly<{
  headings: readonly [string, string]
  rows: readonly (readonly [string, string])[]
}>) {
  return (
    <table className="w-full table-fixed border-collapse text-left text-base">
      <thead>
        <tr>
          {headings.map((heading) => (
            <th
              className="border-mapachito-charcoal border-b-2 p-2 align-top"
              scope="col"
              key={heading}
            >
              {heading}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map(([label, meaning]) => (
          <tr key={label}>
            <th
              className="border-mapachito-charcoal/20 border-b p-2 align-top font-semibold"
              scope="row"
            >
              {label}
            </th>
            <td className="border-mapachito-charcoal/20 border-b p-2 align-top">
              {meaning}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export default function MoveClassificationFaq({
  open,
  onOpen,
  onClose,
}: Readonly<{ open: boolean; onOpen: () => void; onClose: () => void }>) {
  return (
    <details open={open} className="text-mapachito-charcoal mt-7 text-base">
      <summary
        onClick={(event) => {
          event.preventDefault()
          if (open) onClose()
          else onOpen()
        }}
        className="min-h-12 cursor-pointer content-center rounded-lg font-bold focus-visible:outline-2"
      >
        How are moves classified?
      </summary>
      <div className="grid gap-6 py-3">
        <MapachessButton variant="secondary" onClick={onClose}>
          Close move classifications
        </MapachessButton>
        <ClassificationTable
          headings={["Classification", "Meaning"]}
          rows={MOVE_CLASSIFICATION_TABLE}
        />
        <ClassificationTable
          headings={["Mate result after the move", "Classification"]}
          rows={MOVE_MATE_CLASSIFICATION_TABLE}
        />
      </div>
    </details>
  )
}
