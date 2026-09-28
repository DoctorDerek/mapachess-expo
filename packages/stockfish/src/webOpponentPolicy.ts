import type { StockfishEngineConfiguration } from "./engineSession.js"

export const WEB_OPPONENT_NODE_LIMIT = 10_000 as const

export const WEB_OPPONENT_ENGINE_CONFIGURATION = Object.freeze({
  hashMegabytes: 16,
  multiPv: 1,
  ponder: false,
  strength: Object.freeze({ kind: "full-strength" }),
  threads: 1,
}) satisfies Omit<StockfishEngineConfiguration, "variant">

const CALIBRATED_WEB_LADDER_ROWS = {
  standard: [
    [
      8_425,
      "sha256:f90492e10af9baeeedffc7d9ed0e9056ad5154063d6fa6350f84670aa684c422",
    ],
    [
      7_800,
      "sha256:ee284f9f9e7a87cd601ad0f80b49792f42ff181d43a7e3065748bf9fb11412b5",
    ],
    [
      7_225,
      "sha256:69b2d0397074b1d818b82c3ddd62815b2a23017267c969836967ed9d6f0ddc72",
    ],
    [
      6_750,
      "sha256:24dd6b59a1401f90fdb1b3fcece314bd954ac7c381b17cc597197c10f207ce29",
    ],
    [
      6_225,
      "sha256:e6fde4ca20aab99cddc2c013c28b42eea340a0b315fcd2bcb8f80237aa5526a1",
    ],
    [
      5_650,
      "sha256:759600329b07c3c56e3cddd4c937d773a70469bf42a6ccfbd2f50934baa8ff69",
    ],
    [
      5_200,
      "sha256:bccc7a0c7dbc5f273a182f4fcb4f4b0f9bc49b5619bc94f8340e3e7062373477",
    ],
    [
      4_650,
      "sha256:ca33b107dd89492b0e6a61aace76e87a7b781cc575d2a2074a66b450ca0b0e1a",
    ],
    [
      4_140,
      "sha256:ab110b610e5c3935d241b63513ae8068d99a92c5c968e6c9785ec7ff6aff7a00",
    ],
    [
      3_700,
      "sha256:4f5ad58dca584cee832459f124d0ed037d55bb82e8803e73cc0eefd455eb121e",
    ],
    [
      3_216,
      "sha256:ab1c901b6528df5a51dc1c1c369d5bd8d02b55765175561c62249c3f47e0f81c",
    ],
    [
      2_850,
      "sha256:1ef157e9a8054bcc56894b52c7626a073725c3cd4059ac52a466cdaf1e633030",
    ],
    [
      2_550,
      "sha256:8133463985a3bed67a1ea501f8d64c1d9355e20590d4ecbe46c0acf2609a0aab",
    ],
    [
      2_225,
      "sha256:325daa30d49d62faf945506f7b27d300be3f73b68b92191e05570d8e1dba2d26",
    ],
    [
      1_825,
      "sha256:9039782fa8238b86c61e4e1e1d498f2b4fa6b65c3563e05462e867083f0125f1",
    ],
    [
      1_600,
      "sha256:30e7e7570acf91263f5a5942b0c3c114f1c39507500de1efc54f9800380f51e1",
    ],
    [
      1_225,
      "sha256:1efb27bf32c10533d65782b5f1579cd08a7d42be2a5456caad6bd4905706b0d0",
    ],
    [
      975,
      "sha256:edbe0a62b8d3e57779d7bc5f69d51464da12ec1e7bca5712052bfcff5d739e1c",
    ],
    [
      750,
      "sha256:8aa167cf5951d9f59706afc6e8706035a3fef93635d83a527c49071db757ed0b",
    ],
    [
      500,
      "sha256:85cc29b6d19e44f853d6710d1b1f9118600fb83d037720b64ebea9feb6decace",
    ],
    [
      325,
      "sha256:b67b0d4fc0acd373cda5cc28950a6a7f2da338287385e72dcab2097c0b4d7349",
    ],
    [
      200,
      "sha256:7a5e206aee2f8acdd606eb60c594f1948e3ff32a880949271130b0977312f6e9",
    ],
    [
      80,
      "sha256:1a6513a5d427e63b148d2477214e9f8910be471855931a67ba072f6ec435935c",
    ],
  ],
  chess960: [
    [
      8_550,
      "sha256:6fbcf91cdf6f46d666c7ca5c7b3dde3abfffafb3ba5d9668ebb076abadab27c3",
    ],
    [
      8_100,
      "sha256:7cd6693b07f4087b84599f69a8a0467e3970066ddf7543a2e5efbeecb2e7cc32",
    ],
    [
      7_350,
      "sha256:c9a62763741df398ae4aa0af2fe36ad460fed37b52641aa30c3958dc9d25eba2",
    ],
    [
      6_875,
      "sha256:3ab58f6a410d04f71db27aa09bc5f281e8390b084c23c063567779110468d9ff",
    ],
    [
      6_340,
      "sha256:b862434d1835b856f231036c9b7fbf54132e36695a9e59ebf26bbc9d72e8ff12",
    ],
    [
      5_625,
      "sha256:a74b297bdfc51f2827c3d8bdfef99c97e46547709fb475ec56364419a1f685d3",
    ],
    [
      5_375,
      "sha256:e416f778727f3eacb484dafd0c05f4daa12b7a119407daccc7dc2a18c93704eb",
    ],
    [
      4_850,
      "sha256:2ae5b489eb0a261f61e366acf1bcb917b3c4e8142331a90c2d648d37bb966e49",
    ],
    [
      4_450,
      "sha256:9b14cd1b9667c19491c779bad338ae727d75e5f55d3247809317fc736396144c",
    ],
    [
      3_945,
      "sha256:b03330d02241a070f5ae9e5881f18ee8934d162a0fc3fceaf9cc19d5ed8ab7dc",
    ],
    [
      3_500,
      "sha256:ac48ff430e6a105f4acc49d01a9d832fcfa726add650d95221bb9ec78743bb2f",
    ],
    [
      3_000,
      "sha256:a351125946e1260aa126c5e6941e8287f5a0b4a66d1cb1d328f88bd750d3c295",
    ],
    [
      2_625,
      "sha256:a770dad9e3c187d6a6d8ecfe3575a19fa2bc6ca85d98f322e87752f7c7412d52",
    ],
    [
      2_340,
      "sha256:5d03b67340899854142b3c816a6a0c275e68edc8ace839d97d7d63bef37eab31",
    ],
    [
      1_975,
      "sha256:c0297dfbb3731b986f217640094ada3c754b81e779a2c288f33176ad9614e581",
    ],
    [
      1_690,
      "sha256:e544c40cf2f1d452f636763b87b4891f7096cef7100042562ca1c3f222e74e72",
    ],
    [
      1_350,
      "sha256:89fbf12cc4d20994c5e52dec907f183e7aa800a43d7188c691b64075e6986ddc",
    ],
    [
      1_100,
      "sha256:1d3539a30890994fb6ecf383bef91d1fe56ab7b3eee2b5271a1a1700c32ce6f0",
    ],
    [
      810,
      "sha256:f6bc653d62be6901033bc44df8a67ef233b95b77237af60e3afb547e6cb016ae",
    ],
    [
      550,
      "sha256:56460c7588c0ba4e7e8ef51deed1f7179381cd73f98da90cd7ae058be2fe772d",
    ],
    [
      388,
      "sha256:2622c1bf1d52ae5fe6898e8fc54e3af3132675a1e00b1ca51ccb9a1cdc9dd9d8",
    ],
    [
      217,
      "sha256:17e3f2f0779a161f9079b3447040203debb609897d4b7154a3c5ad4aff29ea60",
    ],
    [
      80,
      "sha256:65603eee4ff7bedcd430e451c81b3ca9aef1329e3152035476f2b2a2a8b6d075",
    ],
  ],
} as const

const freezeMeasuredRows = (
  rows: readonly (readonly [number, `sha256:${string}`])[],
) =>
  Object.freeze(
    rows.map(([randomMoveProbabilityBasisPoints, calibrationFingerprint]) =>
      Object.freeze({
        randomMoveProbabilityBasisPoints,
        calibrationFingerprint,
      }),
    ),
  )

export const WEB_CALIBRATED_LADDER = Object.freeze({
  standard: freezeMeasuredRows(CALIBRATED_WEB_LADDER_ROWS.standard),
  chess960: freezeMeasuredRows(CALIBRATED_WEB_LADDER_ROWS.chess960),
})

export const WEB_LADDER_RANDOM_BASIS_POINTS = Object.freeze({
  standard: Object.freeze(
    WEB_CALIBRATED_LADDER.standard.map(
      ({ randomMoveProbabilityBasisPoints }) =>
        randomMoveProbabilityBasisPoints,
    ),
  ),
  chess960: Object.freeze(
    WEB_CALIBRATED_LADDER.chess960.map(
      ({ randomMoveProbabilityBasisPoints }) =>
        randomMoveProbabilityBasisPoints,
    ),
  ),
})
