import MapachessShell from "./MapachessShell"
import MapachessWordmark from "./MapachessWordmark"

export default function MapachessLoadingSurface() {
  return (
    <MapachessShell>
      <div aria-busy="true" className="mx-auto grid w-full max-w-384 gap-8">
        <MapachessWordmark />
        <div role="status">
          <span className="sr-only">Loading Mapachess.</span>
          <div aria-hidden="true" className="flex gap-2">
            <span className="bg-mapachito-raspberry size-3" />
            <span className="bg-mapachito-orange size-3" />
            <span className="bg-mapachito-violet size-3" />
          </div>
        </div>
      </div>
    </MapachessShell>
  )
}
