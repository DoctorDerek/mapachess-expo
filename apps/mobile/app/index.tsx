import { StyleSheet, Text, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"

export default function HomeScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.content}>
        <Text accessibilityRole="header" style={styles.title}>
          Mapachess
        </Text>
        <Text style={styles.status}>Native development build</Text>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  content: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    padding: 24,
  },
  safeArea: {
    backgroundColor: "#111827",
    flex: 1,
  },
  status: {
    color: "#d1d5db",
    fontSize: 16,
    marginTop: 8,
  },
  title: {
    color: "#f9fafb",
    fontSize: 36,
    fontWeight: "700",
  },
})
