"use client"

import { MOVE_CLASSIFICATION_THRESHOLDS } from "@mapachess/evaluation/move-classification"
import MapachessButton from "../presentation/MapachessButton"
import MapachessDialog from "../presentation/MapachessDialog"
import { useMapachessCopy } from "./MapachessLocaleProvider"
import SettingsView from "./SettingsView"

function ClassificationTable({
  headings,
  rows,
}: Readonly<{
  headings: readonly [string, string]
  rows: readonly (readonly [string, string])[]
}>) {
  return (
    <table
      className="w-full table-fixed border-collapse text-left text-base"
      role="table"
    >
      <thead className="sr-only xl:not-sr-only" role="rowgroup">
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
      <tbody role="rowgroup">
        {rows.map(([label, meaning]) => (
          <tr key={label} className="block xl:table-row" role="row">
            <th
              className="border-mapachito-charcoal/20 block px-2 pt-3 pb-1 align-top font-semibold xl:table-cell xl:border-b xl:p-2"
              scope="row"
              role="rowheader"
            >
              {label}
            </th>
            <td
              role="cell"
              className="border-mapachito-charcoal/20 block border-b px-2 pt-1 pb-3 align-top xl:table-cell xl:p-2"
            >
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
  const catalog = useMapachessCopy()
  const copy = catalog.classification
  const messages = catalog.interface.moveClassificationFaq

  return (
    <div className="text-mapachito-charcoal mt-7 text-base">
      <MapachessButton variant="secondary" onClick={onOpen}>
        {messages.howAreMovesClassified}
      </MapachessButton>
      {open ? (
        <MapachessDialog
          label={messages.howAreMovesClassified}
          onClose={onClose}
          fixedContent
        >
          <SettingsView
            title={messages.howAreMovesClassified}
            closeLabel={catalog.shared.settingsControls.back}
            closeAccessibleLabel={messages.closeMoveClassifications}
            onClose={onClose}
            focusHeading
          >
            <div className="grid gap-6 py-3">
              <ClassificationTable
                headings={copy.headings}
                rows={copy.table(MOVE_CLASSIFICATION_THRESHOLDS)}
              />
              <ClassificationTable
                headings={copy.mateHeadings}
                rows={copy.mateTable(MOVE_CLASSIFICATION_THRESHOLDS)}
              />
            </div>
          </SettingsView>
        </MapachessDialog>
      ) : null}
    </div>
  )
}
