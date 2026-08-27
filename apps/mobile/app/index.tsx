import { Text, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"

export default function HomeScreen() {
  return (
    <SafeAreaView style={{ backgroundColor: "#020617", flex: 1 }}>
      <View className="flex-1 items-center justify-center bg-slate-950 p-6">
        <Text
          accessibilityRole="header"
          className="text-4xl font-bold text-slate-50"
        >
          Mapachess
        </Text>
        <Text className="mt-2 text-base text-slate-300">
          Native development build
        </Text>
      </View>
    </SafeAreaView>
  )
}
