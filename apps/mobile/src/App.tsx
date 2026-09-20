import { StatusBar } from "expo-status-bar";
import { SafeAreaView, StyleSheet } from "react-native";

import { AppNavigator } from "./navigation";

export function App(): React.JSX.Element {
  return (
    <SafeAreaView style={styles.root}>
      <StatusBar style="auto" />
      <AppNavigator />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
