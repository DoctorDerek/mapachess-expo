import {
  STOCKFISH_18_WEB_LOADER_ARTIFACT,
  STOCKFISH_18_WEB_WASM_ARTIFACT,
  type StockfishWebRuntimeArtifact,
} from "@mapachess/stockfish/web-runtime-identity"

async function readProgram(artifact:StockfishWebRuntimeArtifact,signal?:AbortSignal) {
  const response=await fetch("/stockfish-runtime/"+artifact.fileName,{signal})
  if(!response.ok) throw Error("Unable to load "+artifact.fileName)
  const blob=await response.blob()
  if(blob.size!==artifact.byteLength) throw Error("Incomplete "+artifact.fileName)
  return blob
}

export default async function prepareWebStockfishProgram(signal?:AbortSignal){
  // Fetch from the controlled page. A dedicated worker can bypass the service
  // worker in WebKit, even when the exact WASM bytes are already installed.
  const [loader,binary]=await Promise.all([
    readProgram(STOCKFISH_18_WEB_LOADER_ARTIFACT,signal),
    readProgram(STOCKFISH_18_WEB_WASM_ARTIFACT,signal),
  ])
  signal?.throwIfAborted()
  const loaderUrl=URL.createObjectURL(new Blob([loader],{type:"text/javascript"}))
  let wasmUrl:string
  try{wasmUrl=URL.createObjectURL(new Blob([binary],{type:"application/wasm"}))}
  catch(error){URL.revokeObjectURL(loaderUrl);throw error}
  return {
    // Stockfish.js accepts an explicit WASM URL in its worker fragment.
    url:loaderUrl+"#"+encodeURIComponent(wasmUrl),
    release:()=>{URL.revokeObjectURL(loaderUrl);URL.revokeObjectURL(wasmUrl)},
  }
}
