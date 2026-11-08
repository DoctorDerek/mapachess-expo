import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Image, View } from "react-native"
import captureError, {
  type ErrorDiagnostic,
} from "@mapachess/diagnostics/error-diagnostic"
import {
  CARD_IDLE_FRAME_MILLISECONDS,
  PROFILE_CARD_HEIGHT,
  PROFILE_CARD_WIDTH,
} from "@mapachess/match-presentation/profile-card-format"
import type { PlayerAppearance } from "@mapachess/profile/player-appearance"
import type { MapachessPlayerData } from "@mapachess/profile/player-data"
import {
  cardFacts,
  INITIAL_CARD_CONTENT,
  type CardContent,
  type CardInput,
} from "@mapachess/profile/profile-card-model"
import type { CardRatingContext } from "@mapachess/profile/rating-context"
import assets from "@/lib/presentation/nativeAssetManifest"
import nativeCardAssetIds, {
  nativeCardFrameCount,
} from "@/lib/presentation/nativeCardAssets"
import useNativePresentationActivity from "@/lib/presentation/useNativePresentationActivity"
import NativeButton from "../presentation/NativeButton"
import NativePanel from "../presentation/NativePanel"
import NativeText from "../presentation/NativeText"
import NativeCardArtwork from "./NativeCardArtwork"
import { useNativeLocale } from "./NativeLocaleProvider"

export default function NativeCardShare({
  data,
  appearance,
  ratingContext,
  onBack,
}: Readonly<{
  data: MapachessPlayerData
  appearance: PlayerAppearance
  ratingContext: CardRatingContext
  onBack: () => void
}>) {
  const { copy, locale } = useNativeLocale()
  const [format, setFormat] = useState<"PNG" | "GIF">("GIF")
  const [content, setContent] = useState<CardContent>(INITIAL_CARD_CONTENT)
  const [state, setState] = useState<
    | Readonly<{ status: "idle" | "busy" }>
    | Readonly<{ status: "failed"; failure: ErrorDiagnostic }>
  >({ status: "idle" })
  const [request, setRequest] = useState<Readonly<{
    frame: number
    signal: AbortSignal
    resolve: (uri: string) => void
    reject: (error: unknown) => void
  }> | null>(null)
  const loaded = useRef(new Set<string>())
  const [, updateAssets] = useState(0)
  const [assetFailed, setAssetFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [previewFrame, setPreviewFrame] = useState(0)
  const activity = useNativePresentationActivity()
  const capture = useRef<View>(null)
  const operation = useRef<AbortController | null>(null)
  const input = useMemo<CardInput>(
    () => ({
      appearance,
      facts: cardFacts(data, ratingContext),
      content,
      format,
      locale,
    }),
    [appearance, data, ratingContext, content, format, locale],
  )
  const required = nativeCardAssetIds(input)
  const sourceKey = required.join("|")
  const available = required.every((id) => assets.images[id] !== undefined)
  const ready =
    available && !assetFailed && required.every((id) => loaded.current.has(id))
  useEffect(() => {
    let disposed = false
    for (const id of sourceKey.split("|")) {
      const source = assets.images[id]
      if (source === undefined) continue
      const uri = Image.resolveAssetSource(source)?.uri
      if (uri === undefined) {
        setAssetFailed(true)
        continue
      }
      Image.getSize(
        uri,
        () => undefined,
        () => {
          if (!disposed) setAssetFailed(true)
        },
      )
    }
    return () => {
      disposed = true
    }
  }, [sourceKey, attempt])
  useEffect(() => {
    if (
      format !== "GIF" ||
      state.status === "busy" ||
      !activity.active ||
      activity.reducedMotion
    )
      return
    const interval = setInterval(
      () =>
        setPreviewFrame((frame) => (frame + 1) % nativeCardFrameCount(input)),
      CARD_IDLE_FRAME_MILLISECONDS,
    )
    return () => clearInterval(interval)
  }, [format, state.status, activity.active, activity.reducedMotion, input])
  const assetLoaded = useCallback((id: string) => {
    if (!loaded.current.has(id)) {
      loaded.current.add(id)
      updateAssets((revision) => revision + 1)
    }
  }, [])
  useEffect(() => () => operation.current?.abort(), [])
  useEffect(() => {
    if (request === null) return
    let cancelled = false
    const paint = requestAnimationFrame(() => {
      void import("react-native-view-shot")
        .then(async ({ captureRef, releaseCapture }) => {
          if (cancelled || request.signal.aborted) return
          const uri = await captureRef(capture, {
            format: "png",
            result: "tmpfile",
            width: PROFILE_CARD_WIDTH,
            height: PROFILE_CARD_HEIGHT,
            quality: 1,
          })
          if (cancelled || request.signal.aborted) releaseCapture(uri)
          else request.resolve(uri)
        })
        .catch((error: unknown) => {
          if (!cancelled && !request.signal.aborted) request.reject(error)
        })
    })
    return () => {
      cancelled = true
      cancelAnimationFrame(paint)
    }
  }, [request])
  const back = (): void => {
    operation.current?.abort()
    onBack()
  }
  const share = async (): Promise<void> => {
    if (operation.current !== null || !ready) return
    const current = new AbortController()
    operation.current = current
    setState({ status: "busy" })
    try {
      const { default: shareNativeCard } =
        await import("@/lib/presentation/nativeCardExport")
      current.signal.throwIfAborted()
      await shareNativeCard(
        input,
        (frame, signal) =>
          new Promise<string>((resolve, reject) => {
            signal.throwIfAborted()
            const abort = (): void => reject(signal.reason)
            signal.addEventListener("abort", abort, { once: true })
            setRequest({
              frame,
              signal,
              resolve: (uri) => {
                signal.removeEventListener("abort", abort)
                resolve(uri)
              },
              reject: (error) => {
                signal.removeEventListener("abort", abort)
                reject(error)
              },
            })
          }),
        current.signal,
      )
      if (!current.signal.aborted) setState({ status: "idle" })
    } catch (error: unknown) {
      if (!current.signal.aborted)
        setState({ status: "failed", failure: captureError(error) })
    } finally {
      operation.current = null
      if (!current.signal.aborted) setRequest(null)
    }
  }
  return (
    <NativePanel
      title={copy.setup.shareProfile}
      onBack={back}
      actions={
        <>
          <View className="flex-row gap-2">
            {(["GIF", "PNG"] as const).map((choice) => (
              <NativeButton
                key={choice}
                className="flex-1"
                variant="secondary"
                accessibilityLabel={copy.profile.cardFormats[choice]}
                accessibilityState={{ selected: choice === format }}
                disabled={state.status === "busy"}
                onPress={() => {
                  setFormat(choice)
                  setState({ status: "idle" })
                }}
              >
                {choice}
              </NativeButton>
            ))}
          </View>
          <View className="flex-row gap-2">
            <NativeButton className="flex-1" variant="secondary" onPress={back}>
              {copy.interface.profileCardJourney.back}
            </NativeButton>
            <NativeButton
              className="flex-1"
              disabled={state.status === "busy" || !ready}
              onPress={() => {
                void share()
              }}
            >
              {copy.profile.shareFormat(format)}
            </NativeButton>
          </View>
        </>
      }
    >
      <View
        ref={capture}
        collapsable={false}
        className="aspect-video w-full overflow-hidden"
      >
        <NativeCardArtwork
          key={attempt}
          input={input}
          frame={
            request?.frame ??
            (format === "GIF" && !activity.reducedMotion ? previewFrame : 0)
          }
          onAssetLoaded={assetLoaded}
        />
      </View>
      {!available || assetFailed ? (
        <>
          <NativeText accessibilityRole="alert">
            {
              copy.interface.profileCardPreview
                .imagePreparationFailedYourAppearancePreviewChoices
            }
          </NativeText>
          <NativeButton
            variant="secondary"
            onPress={() => {
              setAssetFailed(false)
              loaded.current.clear()
              setAttempt((value) => value + 1)
            }}
          >
            {copy.profile.retryFormat(format)}
          </NativeButton>
        </>
      ) : null}
      <NativeText>{copy.profile.cardFormats[format]}</NativeText>
      {(
        [
          ["level", copy.profile.level],
          ["standard", copy.profile.ratingLabel.standard],
          ["chess960", copy.profile.ratingLabel.chess960],
          ["animal", copy.profile.animalCompanion],
        ] as const
      ).map(([key, label]) => (
        <NativeButton
          key={key}
          variant="secondary"
          disabled={state.status === "busy"}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: content[key] }}
          onPress={() => {
            setContent({ ...content, [key]: !content[key] })
            setState({ status: "idle" })
          }}
        >
          {label}
        </NativeButton>
      ))}
      {state.status === "failed" ? (
        <NativeText accessibilityRole="alert">
          {copy.profile.retryFormat(format)}
        </NativeText>
      ) : null}
    </NativePanel>
  )
}
