import { expect, it } from "vitest"
import Icon, { contentType, size } from "./icon"

it("renders the declared 64-pixel PNG through the production icon renderer", async () => {
  const response = Icon()
  expect(response.headers.get("content-type")).toBe(contentType)
  const data = await response.arrayBuffer()
  expect([...new Uint8Array(data, 0, 8)]).toEqual([
    137, 80, 78, 71, 13, 10, 26, 10,
  ])
  const info = new DataView(data)
  expect([info.getUint32(16), info.getUint32(20)]).toEqual([
    size.width,
    size.height,
  ])
})
