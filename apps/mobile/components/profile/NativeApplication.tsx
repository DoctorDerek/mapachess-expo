import {
  NunitoSans_600SemiBold,
  NunitoSans_800ExtraBold,
} from "@expo-google-fonts/nunito-sans"
import { useFonts } from "expo-font"
import { useEffect, useState } from "react"
import { ActivityIndicator, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { withUniwind } from "uniwind"
import ProfileRecovery from "@mapachess/application-ui/profile-recovery"
import captureError, {
  type ErrorDiagnostic,
} from "@mapachess/diagnostics/error-diagnostic"
import loadCatalog from "@mapachess/localization/catalog"
import { selectCurrentPlayerData } from "@mapachess/profile/profile-machine"
import selectProfileRecovery, {
  createRecoveryCommands,
} from "@mapachess/profile/profile-recovery"
import NativeGame from "@/components/gameplay/NativeGame"
import NativeInputProvider, {
  NativeInputSurface,
} from "@/components/input/NativeInputProvider"
import NativeButton from "@/components/presentation/NativeButton"
import NativeRecoveryBoundary from "@/components/presentation/NativeRecoveryBoundary"
import NativeText from "@/components/presentation/NativeText"
import NativeIntroduction from "@/components/profile/NativeIntroduction"
import NativeLocaleProvider, {
  useNativeLocale,
} from "@/components/profile/NativeLocaleProvider"
import nativeRecoveryElements from "@/components/profile/NativeRecoveryElements"
import openNativeApplicationRuntime, {
  type NativeApplicationRuntime,
} from "@/lib/gameplay/openNativeApplicationRuntime"
import useNativeFileActions from "@/lib/profile/useNativeFileActions"
import useActorSnapshot from "@/lib/useActorSnapshot"

const SafeArea = withUniwind(SafeAreaView)

function NativeProfileExperience({
  runtime,
}: Readonly<{ runtime: NativeApplicationRuntime }>) {
  const snapshot = useActorSnapshot(runtime.profile.actor)
  const data = selectCurrentPlayerData(snapshot)
  const files = useNativeFileActions(runtime.profile.actor)
  const { copy } = useNativeLocale()
  const recovery = selectProfileRecovery(snapshot)
  const commands = createRecoveryCommands(runtime.profile.actor, {
    exportData: () => void files.exportData(),
    exportUnreadable: () => void files.exportUnreadable(),
    importData: () => void files.importData(),
  })
  return (
    <SafeArea
      className="bg-mapachito-charcoal min-h-0 flex-1"
      edges={["top", "left", "right", "bottom"]}
    >
      <NativeInputProvider actor={runtime.profile.actor}>
        <NativeInputSurface>
          <NativeRecoveryBoundary
            onRecovery={runtime.pause}
            title={
              copy.interface.profilePlayExperience.thisScreenCouldNotBeDisplayed
            }
            description={
              copy.interface.profilePlayExperience.yourPlayerDataIsStillHeldIn
            }
            retryLabel={copy.interface.recoverableView.tryAgain}
            recovery={
              <NativeButton
                variant="secondary"
                disabled={files.status === "busy"}
                onPress={() => {
                  void files.exportData()
                }}
              >
                {copy.interface.profileSettingsPanel.exportPlayerData}
              </NativeButton>
            }
          >
            {data === null ? (
              recovery.kind === "none" ? (
                <View className="flex-1 items-center justify-center">
                  <ActivityIndicator size="large" />
                </View>
              ) : null
            ) : !data.introductionCompleted ? (
              <NativeIntroduction
                actor={runtime.profile.actor}
                pending={!snapshot.matches("ready")}
              />
            ) : (
              <NativeGame runtime={runtime} files={files} />
            )}
          </NativeRecoveryBoundary>
          <ProfileRecovery
            state={recovery}
            commands={commands}
            files={files}
            copy={copy}
            elements={nativeRecoveryElements}
            delivery="share"
          />
        </NativeInputSurface>
      </NativeInputProvider>
    </SafeArea>
  )
}

export default function NativeApplication() {
  const [runtime, setRuntime] = useState<NativeApplicationRuntime | null>(null)
  const [failure, setFailure] = useState<ErrorDiagnostic | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [fonts, fontError] = useFonts({
    NunitoSans_600SemiBold,
    NunitoSans_800ExtraBold,
  })
  const copy = loadCatalog("en")
  useEffect(() => {
    let disposed = false
    let opened: NativeApplicationRuntime | undefined
    setFailure(null)
    void openNativeApplicationRuntime().then(
      (application) => {
        opened = application
        if (disposed) void application.close().catch(() => undefined)
        else setRuntime(application)
      },
      (error: unknown) => {
        if (!disposed) setFailure(captureError(error))
      },
    )
    return () => {
      disposed = true
      if (opened !== undefined) void opened.close().catch(() => undefined)
    }
  }, [attempt])
  if (runtime !== null && (fonts || fontError !== null))
    return (
      <NativeLocaleProvider actor={runtime.profile.actor}>
        <NativeProfileExperience runtime={runtime} />
      </NativeLocaleProvider>
    )
  return (
    <SafeArea className="bg-mapachito-charcoal flex-1 items-center justify-center gap-4 p-4">
      <NativeText accessibilityRole="header" className="font-native text-4xl">
        {copy.introduction.title}
      </NativeText>
      {failure !== null ? (
        <>
          <NativeText accessibilityRole="alert">
            {
              copy.interface.webMapachessApplication
                .mapachessCouldNotReadLocalData
            }
          </NativeText>
          <NativeButton onPress={() => setAttempt((value) => value + 1)}>
            {copy.interface.webMapachessApplication.tryAgain}
          </NativeButton>
        </>
      ) : (
        <ActivityIndicator size="large" />
      )}
    </SafeArea>
  )
}
