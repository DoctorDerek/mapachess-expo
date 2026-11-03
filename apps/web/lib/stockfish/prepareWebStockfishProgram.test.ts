import {afterEach,expect,it,vi} from "vitest"
import {STOCKFISH_18_WEB_LOADER_ARTIFACT as loader,STOCKFISH_18_WEB_WASM_ARTIFACT as binary} from "@mapachess/stockfish/web-runtime-identity"
import prepareWebStockfishProgram from "./prepareWebStockfishProgram"

afterEach(()=>{vi.unstubAllGlobals();vi.restoreAllMocks()})
it("shares verified program bytes across match workers and releases both URLs",async()=>{
  const read=vi.fn(async (url:string)=>new Response(new Uint8Array(url.endsWith(".wasm")?binary.byteLength:loader.byteLength)))
  vi.stubGlobal("fetch",read)
  const create=vi.spyOn(URL,"createObjectURL").mockReturnValueOnce("blob:loader").mockReturnValueOnce("blob:binary")
  const revoke=vi.spyOn(URL,"revokeObjectURL").mockImplementation(()=>{})
  const signal=new AbortController().signal
  const program=await prepareWebStockfishProgram(signal)
  expect(read).toHaveBeenCalledTimes(2)
  expect(read).toHaveBeenCalledWith("/stockfish-runtime/"+binary.fileName,{signal})
  expect(create.mock.calls.map(([blob])=>blob.type)).toEqual(["text/javascript","application/wasm"])
  expect(program.url).toBe("blob:loader#blob%3Abinary")
  program.release()
  expect(revoke.mock.calls).toEqual([["blob:loader"],["blob:binary"]])
})
it.each([200,503])("rejects a missing or truncated program before allocating worker URLs (%i)",async status=>{
  vi.stubGlobal("fetch",vi.fn(async()=>new Response("short",{status})))
  const create=vi.spyOn(URL,"createObjectURL")
  await expect(prepareWebStockfishProgram()).rejects.toThrow(status===200?/Incomplete/:/Unable to load/)
  expect(create).not.toHaveBeenCalled()
})
