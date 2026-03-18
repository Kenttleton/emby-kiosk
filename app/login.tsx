import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  Pressable,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors, Radius, Spacing, Typography } from "../src/theme";
import { useStore } from "../src/store";
import { authenticateByName } from "../src/services/embyApi";

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { server, setAuth } = useStore();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!server) return;
    if (!username.trim()) {
      Alert.alert("Username required", "Please enter a username.");
      return;
    }
    setLoading(true);
    try {
      const result = await authenticateByName(
        server.address,
        username.trim(),
        password,
      );
      setAuth(result.AccessToken, result.User);
      router.replace("/kiosk");
    } catch (e: any) {
      Alert.alert(
        "Login failed",
        e?.message ?? "Invalid username or password.",
      );
    } finally {
      setLoading(false);
    }
  };

  if (!server) {
    return (
      <View style={styles.centered}>
        <Text style={Typography.body}>No server selected.</Text>
        <Pressable onPress={() => router.replace("/")}>
          <Text style={styles.link}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        style={[styles.container, { paddingTop: insets.top }]}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.serverRow}>
          <Text style={styles.serverName}>{server.name}</Text>
          <Pressable onPress={() => router.replace('/')}>
            <Text style={styles.switchServer}>Switch server</Text>
          </Pressable>
        </View>
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>CREDENTIALS</Text>
          <TextInput
            style={styles.input}
            value={username}
            onChangeText={setUsername}
            placeholder="Username"
            placeholderTextColor={Colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="next"
          />
          <TextInput
            style={[styles.input, { marginTop: Spacing.sm }]}
            value={password}
            onChangeText={setPassword}
            placeholder="Password"
            placeholderTextColor={Colors.textMuted}
            secureTextEntry
            returnKeyType="go"
            onSubmitEditing={handleLogin}
          />
          <Pressable
            style={[styles.loginBtn, loading && styles.loginBtnDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.loginBtnText}>Sign In</Text>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  content: { padding: Spacing.md, paddingBottom: Spacing.xl },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  serverRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.lg,
  },
  serverName: {
    color: Colors.accent,
    fontSize: 18,
    fontWeight: "700",
  },
  switchServer: { color: Colors.textMuted, fontSize: 13 },
  card: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  sectionLabel: { ...Typography.label, marginBottom: Spacing.sm },
  input: {
    backgroundColor: Colors.bg,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    color: Colors.textPrimary,
    fontSize: 15,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  loginBtn: {
    backgroundColor: Colors.accent,
    borderRadius: Radius.md,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: Spacing.md,
  },
  loginBtnDisabled: { opacity: 0.6 },
  loginBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  link: { color: Colors.accent, marginTop: 8, fontSize: 15 },
});
