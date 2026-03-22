import React, { useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Colors, Radius, Spacing, Typography } from "../src/theme";
import { useStore } from "../src/store";
import { connectLogin, getConnectServers } from "../src/services/connectApi";
import { logger } from "../src/services/logger";
import { InfoModal } from "../src/components/InfoModal";

export default function ConnectLoginScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { connectAccount, setConnectAccount, addSavedServer } = useStore();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [confirmMsg, setConfirmMsg] = useState<string | null>(null);

  const handleSignIn = async () => {
    if (!email.trim()) {
      setErrorMsg("Please enter your Emby Connect email.");
      return;
    }
    if (!password) {
      setErrorMsg("Please enter your password.");
      return;
    }
    setLoading(true);
    try {
      const account = await connectLogin(email.trim(), password);
      const servers = await getConnectServers(
        account.userId,
        account.accessToken,
      );
      logger.info('[ConnectLogin] Signed in as:', account.displayName, '— servers found:', servers.length);
      servers.forEach((s) => addSavedServer(s));
      setConnectAccount(account);
      router.back();
    } catch (e: any) {
      const msg = e?.message ?? "Sign in failed. Check your credentials.";
      logger.error(
        "[ConnectLogin] Sign in failed:",
        msg,
        (e as Error)?.stack ?? "",
      );
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = () => {
    setConfirmMsg(`Sign out of Emby Connect?\n\n${connectAccount?.email}`);
  };

  // ── Already signed in ──────────────────────────────────────────────────────
  if (connectAccount) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <InfoModal
          variant="warning"
          title="Sign out of Emby Connect"
          message={confirmMsg}
          onDismiss={() => setConfirmMsg(null)}
          confirmLabel="Sign out"
          onConfirm={() => {
            setConfirmMsg(null);
            setConnectAccount(null);
          }}
        />

        <View style={styles.header}>
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons
              name="chevron-back"
              size={22}
              color={Colors.textPrimary}
            />
          </Pressable>
        </View>

        <View style={styles.centeredBody}>
          <View style={styles.logoBlock}>
            <Image
              source={require("../assets/connect-logo.png")}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>

          <View style={styles.accountCard}>
            <View style={styles.accountAvatar}>
              <Ionicons name="person" size={28} color={Colors.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.accountName}>
                {connectAccount.displayName}
              </Text>
              <Text style={styles.accountEmail}>{connectAccount.email}</Text>
            </View>
            <View style={[styles.signedInBadge]}>
              <Ionicons
                name="checkmark-circle"
                size={16}
                color={Colors.green}
              />
              <Text style={styles.signedInText}>Signed in</Text>
            </View>
          </View>

          <Pressable style={styles.signOutBtn} onPress={handleSignOut}>
            <Ionicons name="log-out-outline" size={18} color={Colors.red} />
            <Text style={styles.signOutText}>Sign out of Emby Connect</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // ── Sign in form ───────────────────────────────────────────────────────────
  return (
    <>
      <InfoModal
        variant="error"
        message={errorMsg}
        onDismiss={() => setErrorMsg(null)}
      />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          style={[styles.root, { paddingTop: insets.top }]}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <Pressable style={styles.backBtn} onPress={() => router.back()}>
              <Ionicons
                name="chevron-back"
                size={22}
                color={Colors.textPrimary}
              />
            </Pressable>
          </View>

          <View style={styles.logoBlock}>
            <Image
              source={require("../assets/connect-logo.png")}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>

          <Text style={styles.tagline}>
            Sign in with your Emby Connect account to access your servers from
            anywhere.
          </Text>

          <View style={styles.card}>
            <Text style={styles.sectionLabel}>EMBY CONNECT CREDENTIALS</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="Email or username"
              placeholderTextColor={Colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
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
              onSubmitEditing={handleSignIn}
            />
            <Pressable
              style={[styles.signInBtn, loading && styles.btnDisabled]}
              onPress={handleSignIn}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.signInBtnText}>
                  Sign in with Emby Connect
                </Text>
              )}
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  scrollContent: { padding: Spacing.md, paddingBottom: Spacing.xl },

  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },

  logoBlock: { alignItems: "center", marginBottom: Spacing.lg },
  logo: { width: 180, height: 55 },
  connectLabel: {
    color: Colors.accent,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 6,
    marginTop: -4,
  },

  tagline: {
    ...Typography.caption,
    textAlign: "center",
    marginBottom: Spacing.lg,
    paddingHorizontal: Spacing.md,
  },

  card: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    padding: Spacing.md,
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
  signInBtn: {
    backgroundColor: Colors.accent,
    borderRadius: Radius.md,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: Spacing.md,
  },
  btnDisabled: { opacity: 0.6 },
  signInBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },

  // Signed-in view
  centeredBody: {
    flex: 1,
    alignItems: "center",
    paddingTop: Spacing.xl,
    gap: Spacing.lg,
  },
  accountCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    width: "100%",
    gap: Spacing.sm,
  },
  accountAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.accentDim,
    alignItems: "center",
    justifyContent: "center",
  },
  accountName: { ...Typography.body, fontWeight: "700" },
  accountEmail: { ...Typography.caption },
  signedInBadge: { flexDirection: "row", alignItems: "center", gap: 4 },
  signedInText: { color: Colors.green, fontSize: 12, fontWeight: "600" },
  signOutBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
  },
  signOutText: { color: Colors.red, fontSize: 15, fontWeight: "500" },
});
