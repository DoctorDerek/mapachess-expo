import { COACH_PORTRAITS } from "@mapachess/match-presentation/coach-portrait"
import type { CoachPortraitLabel } from "@mapachess/match-presentation/coach-portrait"
import type {
  SpriteAnimationDefinition,
  SpriteAssetManifest,
  SpriteFrameGeometry,
} from "@mapachess/match-presentation/presentation-asset-manifest"

const PRESENTATION_ASSET_ROOT = "/generated/presentation-assets"
const PIXEL_SPRITE_FRAME_DURATION_MILLISECONDS = 100

export const LICENSED_PRESENTATION_ASSETS_ENABLED =
  process.env.NEXT_PUBLIC_MAPACHESS_PRESENTATION_ASSETS === "licensed"

const presentationAssetSource = <RelativePath extends string>(
  relativePath: RelativePath,
): `${typeof PRESENTATION_ASSET_ROOT}/${RelativePath}` =>
  `${PRESENTATION_ASSET_ROOT}/${relativePath}`

const frameGeometry = (
  frameSize: number,
  visibleX: number,
  visibleY: number,
  visibleWidth: number,
  visibleHeight: number,
): SpriteFrameGeometry =>
  Object.freeze({
    bottomCenterX: frameSize / 2,
    bottomY: frameSize,
    frameHeight: frameSize,
    frameWidth: frameSize,
    visibleHeight,
    visibleWidth,
    visibleX,
    visibleY,
  })

const spriteAnimation = <SourceId extends string>(
  sourceId: SourceId,
  frameCount: number,
  reducedMotionFrameIndex: number,
  geometry: SpriteFrameGeometry,
): SpriteAnimationDefinition<SourceId> =>
  Object.freeze({
    frameCount,
    frameDurationMilliseconds: PIXEL_SPRITE_FRAME_DURATION_MILLISECONDS,
    geometry,
    reducedMotionFrameIndex,
    sourceId,
  })

export const CHICKEN_SPRITE_SOURCES = {
  attackAir: presentationAssetSource(
    "battle/chicken/chicken_attack_air_strip6.png",
  ),
  attackGround: presentationAssetSource(
    "battle/chicken/chicken_attack_ground_strip6.png",
  ),
  die: presentationAssetSource("battle/chicken/chicken_die_strip10.png"),
  fall: presentationAssetSource("battle/chicken/chicken_fall_strip2.png"),
  fly: presentationAssetSource("battle/chicken/chicken_fly_strip4.png"),
  fright: presentationAssetSource("battle/chicken/chicken_fright_strip5.png"),
  hurt: presentationAssetSource("battle/chicken/chicken_hurt_strip5.png"),
  idle: presentationAssetSource("battle/chicken/chicken_idle_strip4.png"),
  idleBlink: presentationAssetSource(
    "battle/chicken/chicken_idle_blink_strip4.png",
  ),
  land: presentationAssetSource("battle/chicken/chicken_land_strip4.png"),
  peck: presentationAssetSource("battle/chicken/chicken_peck_strip9.png"),
  run: presentationAssetSource("battle/chicken/chicken_run_strip4.png"),
  sit: presentationAssetSource("battle/chicken/chicken_sit_strip4.png"),
  takeoff: presentationAssetSource("battle/chicken/chicken_takeoff_strip7.png"),
  walk: presentationAssetSource("battle/chicken/chicken_walk_strip8.png"),
} as const

const chickenAnimations = {
  "attack-air": spriteAnimation(
    CHICKEN_SPRITE_SOURCES.attackAir,
    6,
    3,
    frameGeometry(40, 7, 13, 30, 19),
  ),
  "attack-ground": spriteAnimation(
    CHICKEN_SPRITE_SOURCES.attackGround,
    6,
    3,
    frameGeometry(40, 9, 14, 28, 19),
  ),
  die: spriteAnimation(
    CHICKEN_SPRITE_SOURCES.die,
    10,
    9,
    frameGeometry(40, 8, 13, 24, 20),
  ),
  fall: spriteAnimation(
    CHICKEN_SPRITE_SOURCES.fall,
    2,
    1,
    frameGeometry(40, 9, 16, 22, 17),
  ),
  fly: spriteAnimation(
    CHICKEN_SPRITE_SOURCES.fly,
    4,
    1,
    frameGeometry(40, 9, 15, 23, 16),
  ),
  fright: spriteAnimation(
    CHICKEN_SPRITE_SOURCES.fright,
    5,
    2,
    frameGeometry(40, 8, 13, 22, 20),
  ),
  hurt: spriteAnimation(
    CHICKEN_SPRITE_SOURCES.hurt,
    5,
    3,
    frameGeometry(40, 8, 13, 22, 20),
  ),
  idle: spriteAnimation(
    CHICKEN_SPRITE_SOURCES.idle,
    4,
    0,
    frameGeometry(40, 10, 13, 17, 20),
  ),
  "idle-blink": spriteAnimation(
    CHICKEN_SPRITE_SOURCES.idleBlink,
    4,
    0,
    frameGeometry(40, 10, 13, 17, 20),
  ),
  land: spriteAnimation(
    CHICKEN_SPRITE_SOURCES.land,
    4,
    3,
    frameGeometry(40, 9, 15, 24, 18),
  ),
  peck: spriteAnimation(
    CHICKEN_SPRITE_SOURCES.peck,
    9,
    5,
    frameGeometry(40, 10, 13, 23, 20),
  ),
  run: spriteAnimation(
    CHICKEN_SPRITE_SOURCES.run,
    4,
    2,
    frameGeometry(40, 10, 12, 21, 21),
  ),
  sit: spriteAnimation(
    CHICKEN_SPRITE_SOURCES.sit,
    4,
    0,
    frameGeometry(40, 10, 16, 17, 17),
  ),
  takeoff: spriteAnimation(
    CHICKEN_SPRITE_SOURCES.takeoff,
    7,
    5,
    frameGeometry(40, 9, 15, 23, 18),
  ),
  walk: spriteAnimation(
    CHICKEN_SPRITE_SOURCES.walk,
    8,
    4,
    frameGeometry(40, 10, 12, 19, 21),
  ),
} as const

export type ChickenSpriteAnimationId = keyof typeof chickenAnimations
export type ChickenSpriteSourceId =
  (typeof CHICKEN_SPRITE_SOURCES)[keyof typeof CHICKEN_SPRITE_SOURCES]

export const CHICKEN_SPRITE_MANIFEST = {
  animations: chickenAnimations,
  reactionPlans: {
    "capture-attacker": [
      { animationIds: ["run", "walk"], playback: "once" },
      {
        animationIds: ["attack-ground", "attack-air", "peck"],
        playback: "once",
      },
    ],
    "capture-victim": [{ animationIds: ["hurt", "fright"], playback: "once" }],
    "check-attacker": [
      { animationIds: ["peck", "attack-ground"], playback: "once" },
    ],
    "check-victim": [{ animationIds: ["fright", "hurt"], playback: "once" }],
    defeat: [
      { animationIds: ["fall", "hurt"], playback: "once" },
      { animationIds: ["die", "sit"], playback: "once-hold-final-frame" },
    ],
    idle: [{ animationIds: ["idle-blink", "idle", "sit"], playback: "loop" }],
    victory: [
      { animationIds: ["takeoff", "peck"], playback: "once" },
      { animationIds: ["fly", "peck"], playback: "loop" },
    ],
  },
} as const satisfies SpriteAssetManifest<
  ChickenSpriteAnimationId,
  ChickenSpriteSourceId
>

export const MAPACHITO_SPRITE_SOURCES = {
  attack: presentationAssetSource("battle/mapachito/raccoon_attack_strip7.png"),
  bark: presentationAssetSource("battle/mapachito/raccoon_bark_strip6.png"),
  crouch: presentationAssetSource("battle/mapachito/raccoon_crouch_strip8.png"),
  dash: presentationAssetSource("battle/mapachito/raccoon_dash_strip9.png"),
  die: presentationAssetSource("battle/mapachito/raccoon_die_strip8.png"),
  fall: presentationAssetSource("battle/mapachito/raccoon_fall_strip5.png"),
  fright: presentationAssetSource("battle/mapachito/raccoon_fright_strip4.png"),
  hurt: presentationAssetSource("battle/mapachito/raccoon_hurt_strip7.png"),
  idle: presentationAssetSource("battle/mapachito/raccoon_idle_strip8.png"),
  idleBlink: presentationAssetSource(
    "battle/mapachito/raccoon_idle_blink_strip8.png",
  ),
  jump: presentationAssetSource("battle/mapachito/raccoon_jump_strip14.png"),
  land: presentationAssetSource("battle/mapachito/raccoon_land_strip3.png"),
  run: presentationAssetSource("battle/mapachito/raccoon_run_strip8.png"),
  sitOne: presentationAssetSource("battle/mapachito/raccoon_sit01_strip8.png"),
  sitTwo: presentationAssetSource("battle/mapachito/raccoon_sit02_strip24.png"),
  wallGrab: presentationAssetSource(
    "battle/mapachito/raccoon_wallgrab_strip8.png",
  ),
} as const

const mapachitoAnimations = {
  attack: spriteAnimation(
    MAPACHITO_SPRITE_SOURCES.attack,
    7,
    4,
    frameGeometry(60, 11, 34, 38, 19),
  ),
  bark: spriteAnimation(
    MAPACHITO_SPRITE_SOURCES.bark,
    6,
    4,
    frameGeometry(60, 11, 33, 34, 20),
  ),
  crouch: spriteAnimation(
    MAPACHITO_SPRITE_SOURCES.crouch,
    8,
    4,
    frameGeometry(60, 12, 36, 30, 17),
  ),
  dash: spriteAnimation(
    MAPACHITO_SPRITE_SOURCES.dash,
    9,
    5,
    frameGeometry(60, 11, 36, 34, 17),
  ),
  die: spriteAnimation(
    MAPACHITO_SPRITE_SOURCES.die,
    8,
    7,
    frameGeometry(60, 12, 34, 32, 19),
  ),
  fall: spriteAnimation(
    MAPACHITO_SPRITE_SOURCES.fall,
    5,
    3,
    frameGeometry(60, 11, 36, 33, 14),
  ),
  fright: spriteAnimation(
    MAPACHITO_SPRITE_SOURCES.fright,
    4,
    2,
    frameGeometry(60, 10, 38, 30, 15),
  ),
  hurt: spriteAnimation(
    MAPACHITO_SPRITE_SOURCES.hurt,
    7,
    4,
    frameGeometry(60, 13, 34, 30, 19),
  ),
  idle: spriteAnimation(
    MAPACHITO_SPRITE_SOURCES.idle,
    8,
    0,
    frameGeometry(60, 13, 35, 29, 18),
  ),
  "idle-blink": spriteAnimation(
    MAPACHITO_SPRITE_SOURCES.idleBlink,
    8,
    0,
    frameGeometry(60, 13, 35, 29, 18),
  ),
  jump: spriteAnimation(
    MAPACHITO_SPRITE_SOURCES.jump,
    14,
    8,
    frameGeometry(60, 13, 34, 31, 19),
  ),
  land: spriteAnimation(
    MAPACHITO_SPRITE_SOURCES.land,
    3,
    2,
    frameGeometry(60, 13, 37, 29, 16),
  ),
  run: spriteAnimation(
    MAPACHITO_SPRITE_SOURCES.run,
    8,
    4,
    frameGeometry(60, 11, 34, 33, 19),
  ),
  "sit-one": spriteAnimation(
    MAPACHITO_SPRITE_SOURCES.sitOne,
    8,
    0,
    frameGeometry(60, 15, 36, 26, 17),
  ),
  "sit-two": spriteAnimation(
    MAPACHITO_SPRITE_SOURCES.sitTwo,
    24,
    0,
    frameGeometry(60, 15, 36, 26, 17),
  ),
  "wall-grab": spriteAnimation(
    MAPACHITO_SPRITE_SOURCES.wallGrab,
    8,
    5,
    frameGeometry(60, 24, 27, 16, 29),
  ),
} as const

export type MapachitoSpriteAnimationId = keyof typeof mapachitoAnimations
export type MapachitoSpriteSourceId =
  (typeof MAPACHITO_SPRITE_SOURCES)[keyof typeof MAPACHITO_SPRITE_SOURCES]

export const MAPACHITO_SPRITE_MANIFEST = {
  animations: mapachitoAnimations,
  reactionPlans: {
    "capture-attacker": [
      { animationIds: ["dash", "run"], playback: "once" },
      { animationIds: ["attack", "bark"], playback: "once" },
    ],
    "capture-victim": [{ animationIds: ["hurt", "fright"], playback: "once" }],
    "check-attacker": [{ animationIds: ["bark", "attack"], playback: "once" }],
    "check-victim": [{ animationIds: ["fright", "hurt"], playback: "once" }],
    defeat: [
      { animationIds: ["fall", "hurt"], playback: "once" },
      {
        animationIds: ["die", "sit-one"],
        playback: "once-hold-final-frame",
      },
    ],
    idle: [
      {
        animationIds: ["idle-blink", "idle", "sit-two", "sit-one", "crouch"],
        playback: "loop",
      },
    ],
    victory: [
      { animationIds: ["jump", "dash"], playback: "once" },
      { animationIds: ["land", "attack"], playback: "once" },
      { animationIds: ["bark", "sit-two"], playback: "loop" },
    ],
  },
} as const satisfies SpriteAssetManifest<
  MapachitoSpriteAnimationId,
  MapachitoSpriteSourceId
>

export const AVAILABLE_CHICKEN_SPRITE_SOURCES: readonly ChickenSpriteSourceId[] =
  LICENSED_PRESENTATION_ASSETS_ENABLED
    ? Object.freeze([
        CHICKEN_SPRITE_SOURCES.attackAir,
        CHICKEN_SPRITE_SOURCES.attackGround,
        CHICKEN_SPRITE_SOURCES.die,
        CHICKEN_SPRITE_SOURCES.fall,
        CHICKEN_SPRITE_SOURCES.fly,
        CHICKEN_SPRITE_SOURCES.fright,
        CHICKEN_SPRITE_SOURCES.hurt,
        CHICKEN_SPRITE_SOURCES.idle,
        CHICKEN_SPRITE_SOURCES.idleBlink,
        CHICKEN_SPRITE_SOURCES.land,
        CHICKEN_SPRITE_SOURCES.peck,
        CHICKEN_SPRITE_SOURCES.run,
        CHICKEN_SPRITE_SOURCES.sit,
        CHICKEN_SPRITE_SOURCES.takeoff,
        CHICKEN_SPRITE_SOURCES.walk,
      ])
    : Object.freeze([])

export const AVAILABLE_MAPACHITO_SPRITE_SOURCES: readonly MapachitoSpriteSourceId[] =
  LICENSED_PRESENTATION_ASSETS_ENABLED
    ? Object.freeze([
        MAPACHITO_SPRITE_SOURCES.attack,
        MAPACHITO_SPRITE_SOURCES.bark,
        MAPACHITO_SPRITE_SOURCES.crouch,
        MAPACHITO_SPRITE_SOURCES.dash,
        MAPACHITO_SPRITE_SOURCES.die,
        MAPACHITO_SPRITE_SOURCES.fall,
        MAPACHITO_SPRITE_SOURCES.fright,
        MAPACHITO_SPRITE_SOURCES.hurt,
        MAPACHITO_SPRITE_SOURCES.idle,
        MAPACHITO_SPRITE_SOURCES.idleBlink,
        MAPACHITO_SPRITE_SOURCES.jump,
        MAPACHITO_SPRITE_SOURCES.land,
        MAPACHITO_SPRITE_SOURCES.run,
        MAPACHITO_SPRITE_SOURCES.sitOne,
        MAPACHITO_SPRITE_SOURCES.sitTwo,
        MAPACHITO_SPRITE_SOURCES.wallGrab,
      ])
    : Object.freeze([])

export const AVAILABLE_COACH_PORTRAITS: readonly CoachPortraitLabel[] =
  LICENSED_PRESENTATION_ASSETS_ENABLED
    ? Object.freeze(COACH_PORTRAITS.map(({ label }) => label))
    : Object.freeze([])

export const coachPortraitSource = (
  label: CoachPortraitLabel,
): string | null =>
  LICENSED_PRESENTATION_ASSETS_ENABLED
    ? presentationAssetSource(`coach/${label}.png`)
    : null
