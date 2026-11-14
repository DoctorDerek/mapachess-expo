import { useEffect } from "react"
import { BackHandler, Modal, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { withUniwind } from "uniwind"
import type {
  RecoveryElements,
  RecoverySurfaceProps,
} from "@mapachess/application-ui/recovery-elements"
import { NativeInputSurface } from "@/components/input/NativeInputProvider"
import NativeButton from "@/components/presentation/NativeButton"
import { NativeScrollActions } from "@/components/presentation/NativePanel"
import NativeText from "@/components/presentation/NativeText"

const SafeArea = withUniwind(SafeAreaView)

function Surface({
  kind,
  title,
  description,
  eyebrow,
  children,
  actions,
  onCancel,
}: RecoverySurfaceProps) {
  useEffect(() => {
    if (kind !== "verification" || onCancel === undefined) return
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        onCancel()
        return true
      },
    )
    return () => subscription.remove()
  }, [kind, onCancel])
  const content = (
    <NativeScrollActions actions={actions}>
      {eyebrow === undefined ? null : (
        <NativeText className="text-mapachito-violet text-xs font-black uppercase">
          {eyebrow}
        </NativeText>
      )}
      <NativeText
        accessibilityRole="header"
        className="text-mapachito-charcoal font-native text-2xl"
      >
        {title}
      </NativeText>
      {description === undefined ? null : (
        <NativeText className="text-mapachito-charcoal text-sm">
          {description}
        </NativeText>
      )}
      {children}
    </NativeScrollActions>
  )
  if (kind === "recovery" || kind === "load-failure" || kind === "verification")
    return (
      <NativeInputSurface
        className="bg-mapachito-white"
        onAction={(action) => {
          if (
            onCancel === undefined ||
            (action !== "cancel" && action !== "menu")
          )
            return false
          onCancel()
          return true
        }}
      >
        {content}
      </NativeInputSurface>
    )
  return (
    <Modal
      visible
      animationType="none"
      presentationStyle="fullScreen"
      onRequestClose={onCancel}
    >
      <SafeArea
        accessibilityViewIsModal
        className="bg-mapachito-white min-h-0 flex-1"
        edges={["top", "bottom", "left", "right"]}
      >
        <NativeInputSurface
          modal
          onAction={(action) => {
            if (
              onCancel === undefined ||
              (action !== "cancel" && action !== "menu")
            )
              return false
            onCancel()
            return true
          }}
        >
          {content}
        </NativeInputSurface>
      </SafeArea>
    </Modal>
  )
}

const nativeRecoveryElements = {
  Surface,
  Group: ({ children, className }) => (
    <View className={className}>{children}</View>
  ),
  Text: ({ children, className, kind }) => (
    <NativeText
      className={className}
      accessibilityRole={kind === "notice" ? "alert" : undefined}
    >
      {children}
    </NativeText>
  ),
  Action: ({
    children,
    onActivate,
    busy,
    busyLabel,
    focusRequested,
    ...props
  }) => (
    <NativeButton
      {...props}
      disabled={props.disabled || busy}
      accessibilityState={{ busy: Boolean(busy) }}
      focusRequested={focusRequested}
      onPress={onActivate}
    >
      {busy && busyLabel !== undefined ? busyLabel : children}
    </NativeButton>
  ),
  Import: ({ children, className, disabled, onActivate }) => (
    <NativeButton
      className={className}
      variant="secondary"
      disabled={disabled}
      onPress={onActivate}
    >
      {children}
    </NativeButton>
  ),
} satisfies RecoveryElements

export default nativeRecoveryElements
