import { useCallback, useRef, type ReactNode, type RefObject } from "react"
import { Modal, ScrollView, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { withUniwind } from "uniwind"
import { InputReveal, NativeInputSurface } from "../input/NativeInputProvider"
import NativeText from "./NativeText"

const SafeArea = withUniwind(SafeAreaView)

export function NativeScrollActions({
  children,
  actions,
}: Readonly<{ children: ReactNode; actions: ReactNode }>) {
  const scroll = useRef<ScrollView>(null)
  const viewport = useRef<View>(null)
  const offset = useRef(0)
  const reveal = useCallback((target: RefObject<View | null>) => {
    viewport.current?.measureInWindow((_x, top, _width, height) =>
      target.current?.measureInWindow((_left, y, _w, h) => {
        if (y < top || y + h > top + height)
          scroll.current?.scrollTo({
            y: Math.max(0, offset.current + y - top - height / 2 + h / 2),
            animated: false,
          })
      }),
    )
  }, [])
  return (
    <View className="min-h-0 flex-1">
      <InputReveal value={reveal}>
        <View ref={viewport} className="min-h-0 flex-1">
          <ScrollView
            ref={scroll}
            onScroll={(event) => {
              offset.current = event.nativeEvent.contentOffset.y
            }}
            scrollEventThrottle={16}
            className="min-h-0 flex-1"
            contentContainerClassName="gap-4 p-4"
            keyboardShouldPersistTaps="handled"
          >
            {children}
          </ScrollView>
        </View>
      </InputReveal>
      <View className="shrink-0 gap-2 px-4 pt-3 pb-4">{actions}</View>
    </View>
  )
}

export default function NativePanel({
  title,
  children,
  actions,
  onBack,
}: Readonly<{
  title: string
  children: ReactNode
  actions: ReactNode
  onBack: () => void
}>) {
  return (
    <Modal
      visible
      animationType="none"
      onRequestClose={onBack}
      presentationStyle="fullScreen"
    >
      <SafeArea
        accessibilityViewIsModal
        className="bg-mapachito-charcoal flex-1"
        edges={["top", "bottom", "left", "right"]}
      >
        <NativeInputSurface
          modal
          onAction={(action) => {
            if (action !== "cancel" && action !== "menu") return false
            onBack()
            return true
          }}
        >
          <NativeScrollActions actions={actions}>
            <NativeText
              accessibilityRole="header"
              className="font-native text-2xl"
            >
              {title}
            </NativeText>
            {children}
          </NativeScrollActions>
        </NativeInputSurface>
      </SafeArea>
    </Modal>
  )
}
