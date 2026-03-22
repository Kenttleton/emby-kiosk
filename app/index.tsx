import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
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
import { EmbyServer } from "../src/types/emby";
import { discoverServers, probeManualServer } from "../src/services/discovery";
import { authenticateByName, getPublicUsers } from "../src/services/embyApi";
import { exchangeToken } from "../src/services/connectApi";
import { useStore } from "../src/store";
import { logger } from "../src/services/logger";

export default function ServerScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const {
    savedServers,
    server: storedServer,
    authToken,
    hydrated,
    connectAccount,
    addSavedServer,
    removeSavedServer,
    switchToServer,
    setAuth,
  } = useStore();

  const [discovering, setDiscovering] = useState(false);
  const [discovered, setDiscovered] = useState<EmbyServer[]>([]);
  const [scanDone, setScanDone] = useState(false);
  const [manualUrl, setManualUrl] = useState("");
  const [manualError, setManualError] = useState<string | null>(null);
  const [probing, setProbing] = useState(false);
  const abortRef = useRef(false);

  // Auto-navigate once hydrated if already authenticated
  useEffect(() => {
    if (!hydrated) return;
    if (storedServer && authToken) router.replace("/kiosk");
  }, [hydrated]);

  // ── Discovery ──────────────────────────────────────────────────────────────
  const startDiscovery = () => {
    abortRef.current = false;
    setDiscovered([]);
    setScanDone(false);
    setDiscovering(true);
    discoverServers(
      (s) => {
        if (!abortRef.current)
          setDiscovered((prev) =>
            prev.find((x) => x.id === s.id) ? prev : [...prev, s],
          );
      },
      () => {
        setDiscovering(false);
        setScanDone(true);
      },
    );
  };

  const stopDiscovery = () => {
    abortRef.current = true;
    setDiscovering(false);
    setScanDone(true);
  };

  // ── Server selection waterfall ─────────────────────────────────────────────
  const pickServer = async (s: EmbyServer) => {
    logger.info('[Auth] Server selected:', { name: s.name, address: s.address });
    addSavedServer(s);
    const record = switchToServer(s);

    // 1. Active token cached — go straight to kiosk
    if (record?.active?.token) {
      logger.info('[Auth] Active token found — navigating to kiosk');
      router.replace("/kiosk");
      return;
    }

    // 2. Connect account matches this server — attempt exchange
    const connectAccessKey =
      record?.connectAccessKey ?? (s as any).connectAccessKey;
    const serverConnectUserId =
      record?.connectUserId ?? (s as any).connectUserId;
    if (
      connectAccount &&
      connectAccessKey &&
      (!serverConnectUserId || serverConnectUserId === connectAccount.userId)
    ) {
      logger.info('[Auth] Attempting Connect token exchange for:', connectAccount.displayName);
      try {
        const { localUserId, accessToken } = await exchangeToken(
          s.address,
          connectAccount.userId,
          connectAccessKey,
        );
        logger.info('[Auth] Connect exchange successful for:', connectAccount.displayName);
        setAuth(
          accessToken,
          {
            Id: localUserId,
            Name: connectAccount.displayName,
            ServerId: s.id,
            HasPassword: false,
          },
          "connect",
        );
        router.replace("/kiosk");
        return;
      } catch (e) {
        logger.warn('[Auth] Connect exchange failed — falling through:', e);
      }
    }

    // 3. Try other known users' stored tokens
    const knownUsers = record?.knownUsers ?? [];
    for (const u of knownUsers
      .slice()
      .sort((a, b) => b.lastLoginAt.localeCompare(a.lastLoginAt))) {
      logger.info('[Auth] Trying stored token for:', u.username);
      try {
        const res = await globalThis.fetch(`${s.address}/emby/System/Info`, {
          headers: { "X-Emby-Token": u.token },
        });
        if (res.ok) {
          logger.info('[Auth] Stored token valid — signed in as:', u.username);
          setAuth(
            u.token,
            {
              Id: u.userId,
              Name: u.username,
              ServerId: s.id,
              HasPassword: true,
            },
            u.loginMethod,
          );
          router.replace("/kiosk");
          return;
        }
        logger.warn('[Auth] Stored token expired for:', u.username);
      } catch (e) {
        logger.warn('[Auth] Stored token check failed for:', u.username, e);
      }
    }

    // 4. Passwordless single public user
    try {
      const users = await getPublicUsers(s.address);
      if (users.length === 1 && !users[0].HasPassword) {
        logger.info('[Auth] Auto-signing in passwordless user:', users[0].Name);
        const result = await authenticateByName(s.address, users[0].Name, "");
        logger.info('[Auth] Passwordless sign-in successful for:', result.User.Name);
        setAuth(result.AccessToken, result.User, "local");
        router.replace("/kiosk");
        return;
      }
    } catch (e) {
      logger.warn('[Auth] Passwordless user check failed:', e);
    }

    // 5. Manual login required
    logger.info('[Auth] No automatic sign-in available — navigating to login screen');
    router.push("/login");
  };

  // ── Manual entry ───────────────────────────────────────────────────────────
  const handleManualAdd = async () => {
    if (!manualUrl.trim()) return;
    if (!manualUrl.startsWith("http://") && !manualUrl.startsWith("https://")) {
      setManualError("Address must start with http:// or https://");
      return;
    }
    setManualError(null);
    setProbing(true);
    try {
      const s = await probeManualServer(manualUrl);
      setProbing(false);
      pickServer(s);
    } catch (e: any) {
      setProbing(false);
      const msg = e?.message ?? "";
      if (msg.includes("Network request failed") || msg.includes("fetch"))
        setManualError(
          "Could not reach that address. Check the IP, port, and that Emby is running.",
        );
      else if (msg.includes("Not an Emby server"))
        setManualError("A server responded but it does not appear to be Emby.");
      else setManualError(msg || "Connection failed.");
    }
  };

  // ── Server list partitioning ───────────────────────────────────────────────
  const connectServers = savedServers.filter((s) => !!s.connectServerId);
  const localSaved = savedServers.filter((s) => !s.connectServerId);
  const unsaved = discovered.filter(
    (d) => !savedServers.find((s) => s.id === d.id),
  );

  const hasAnyServers =
    connectServers.length > 0 || localSaved.length > 0 || unsaved.length > 0;

  if (!hydrated) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.accent} />
      </View>
    );
  }

  const renderServer = (
    item: EmbyServer,
    opts: { removable: boolean; badge: "connect" | "saved" | "discovered" },
  ) => {
    const badgeIcon =
      opts.badge === "connect"
        ? "cloud-outline"
        : opts.badge === "saved"
          ? "bookmark"
          : "radio";
    const badgeColor =
      opts.badge === "connect"
        ? Colors.accent
        : opts.badge === "discovered"
          ? Colors.textMuted
          : Colors.textMuted;

    return (
      <Pressable style={styles.serverRow} onPress={() => pickServer(item)}>
        <View style={styles.serverIcon}>
          <Ionicons
            name={opts.badge === "connect" ? "cloud-outline" : "server"}
            size={18}
            color={Colors.accent}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.serverName}>{item.name}</Text>
          <Text style={styles.serverAddress}>{item.address}</Text>
        </View>
        <Ionicons
          name={badgeIcon}
          size={14}
          color={badgeColor}
          style={{ marginRight: 4 }}
        />
        {opts.removable && (
          <Pressable
            onPress={() => removeSavedServer(item.id)}
            hitSlop={8}
            style={styles.removeBtn}
          >
            <Ionicons name="trash-outline" size={16} color={Colors.red} />
          </Pressable>
        )}
        <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
      </Pressable>
    );
  };

  return (
    <ScrollView
      style={styles.scrollContainer}
      contentContainerStyle={[styles.container, { paddingTop: insets.top }]}
      keyboardShouldPersistTaps="handled"
    >
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.settingsBtn} onPress={() => router.push('/settings')}>
          <Ionicons name="settings-outline" size={22} color={Colors.textMuted} />
        </Pressable>
        <View style={styles.logoBlock}>
          <Image
            source={require("../assets/kiosk-logo.png")}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>
        <Text style={styles.subtitle}>Select or discover your server</Text>
      </View>

      {/* Emby Connect account banner */}
      <Pressable
        style={styles.connectBanner}
        onPress={() => router.push("/connect-login")}
      >
        <Ionicons
          name="cloud-outline"
          size={20}
          color={connectAccount ? Colors.accent : Colors.textMuted}
        />
        <View style={{ flex: 1 }}>
          {connectAccount ? (
            <>
              <Text style={styles.connectBannerTitle}>Emby Connect</Text>
              <Text style={styles.connectBannerSub}>
                {connectAccount.email}
              </Text>
            </>
          ) : (
            <Text style={styles.connectBannerTitle}>
              Sign in with Emby Connect
            </Text>
          )}
        </View>
        {connectAccount ? (
          <Ionicons name="checkmark-circle" size={18} color={Colors.green} />
        ) : (
          <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
        )}
      </Pressable>

      {/* Manual entry */}
      <View style={styles.card}>
        <Text style={styles.sectionLabel}>MANUAL SERVER ADDRESS</Text>
        <View style={styles.row}>
          <TextInput
            style={[styles.input, manualError ? styles.inputError : null]}
            value={manualUrl}
            onChangeText={(t) => {
              setManualUrl(t);
              setManualError(null);
            }}
            placeholder="http://192.168.1.100:8096"
            placeholderTextColor={Colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            returnKeyType="go"
            onSubmitEditing={handleManualAdd}
          />
          <Pressable
            style={[styles.btn, probing && styles.btnDisabled]}
            onPress={handleManualAdd}
            disabled={probing}
          >
            {probing ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Ionicons name="arrow-forward" size={20} color="#fff" />
            )}
          </Pressable>
        </View>
        {manualError && (
          <View style={styles.errorRow}>
            <Ionicons name="warning-outline" size={14} color={Colors.red} />
            <Text style={styles.errorText}>{manualError}</Text>
          </View>
        )}
      </View>

      {/* LAN scan */}
      <View style={styles.card}>
        <Text style={styles.sectionLabel}>AUTO-DISCOVER ON LAN</Text>
        <Text style={styles.scanNote}>
          Scans your local subnet for Emby servers on ports 8096 & 8920. This
          may take 15–30 seconds.
        </Text>
        <Pressable
          style={[styles.scanBtn, discovering && styles.scanBtnActive]}
          onPress={discovering ? stopDiscovery : startDiscovery}
        >
          {discovering ? (
            <ActivityIndicator
              color={Colors.accent}
              size="small"
              style={{ marginRight: 8 }}
            />
          ) : (
            <Ionicons
              name="wifi"
              size={18}
              color={Colors.accent}
              style={{ marginRight: 8 }}
            />
          )}
          <Text style={styles.scanBtnText}>
            {discovering ? "Scanning… (tap to stop)" : "Scan Network"}
          </Text>
        </Pressable>
        {scanDone && !discovering && discovered.length === 0 && (
          <View style={[styles.errorRow, { marginTop: 10 }]}>
            <Ionicons
              name="information-circle-outline"
              size={14}
              color={Colors.textMuted}
            />
            <Text style={[styles.errorText, { color: Colors.textMuted }]}>
              No Emby servers found. Check that your device is on the same
              network and Emby is running on port 8096 or 8920.
            </Text>
          </View>
        )}
      </View>

      {/* Server list — three sections */}
      {hasAnyServers && (
        <View
          style={[
            styles.card,
            { paddingHorizontal: 0, paddingVertical: 0, overflow: "hidden" },
          ]}
        >
          {/* Connect servers */}
          {connectServers.length > 0 && (
            <>
              <Text style={[styles.sectionLabel, styles.listSectionLabel]}>
                EMBY CONNECT
              </Text>
              <FlatList
                data={connectServers}
                keyExtractor={(s) => s.id}
                scrollEnabled={false}
                renderItem={({ item }) =>
                  renderServer(item, { removable: true, badge: "connect" })
                }
                ItemSeparatorComponent={() => <View style={styles.separator} />}
              />
            </>
          )}

          {/* Local saved servers */}
          {localSaved.length > 0 && (
            <>
              {connectServers.length > 0 && (
                <View style={styles.sectionDivider} />
              )}
              <Text style={[styles.sectionLabel, styles.listSectionLabel]}>
                SAVED
              </Text>
              <FlatList
                data={localSaved}
                keyExtractor={(s) => s.id}
                scrollEnabled={false}
                renderItem={({ item }) =>
                  renderServer(item, { removable: true, badge: "saved" })
                }
                ItemSeparatorComponent={() => <View style={styles.separator} />}
              />
            </>
          )}

          {/* Discovered but not saved */}
          {unsaved.length > 0 && (
            <>
              {(connectServers.length > 0 || localSaved.length > 0) && (
                <View style={styles.sectionDivider} />
              )}
              <Text style={[styles.sectionLabel, styles.listSectionLabel]}>
                DISCOVERED
              </Text>
              <FlatList
                data={unsaved}
                keyExtractor={(s) => s.id}
                scrollEnabled={false}
                renderItem={({ item }) =>
                  renderServer(item, { removable: false, badge: "discovered" })
                }
                ItemSeparatorComponent={() => <View style={styles.separator} />}
              />
            </>
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: { flex: 1, backgroundColor: Colors.bg },
  container: { padding: Spacing.md, paddingBottom: Spacing.xl },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.bg,
  },

  header: { alignItems: "center", paddingVertical: Spacing.xl },
  settingsBtn: { position: 'absolute', top: Spacing.xl, right: 0, padding: 6 },
  logoBlock: { alignItems: "center" },
  logo: { width: 180, height: 55 },
  kioskLabel: {
    color: Colors.accent,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 6,
    marginTop: -4,
  },
  subtitle: { ...Typography.caption, marginTop: 4 },

  connectBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  connectBannerTitle: { ...Typography.body, fontWeight: "600" },
  connectBannerSub: { ...Typography.caption, marginTop: 1 },

  card: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  sectionLabel: { ...Typography.label, marginBottom: Spacing.sm },
  listSectionLabel: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    marginBottom: 0,
  },
  sectionDivider: {
    height: 1,
    backgroundColor: Colors.divider,
    marginVertical: Spacing.xs,
  },

  row: { flexDirection: "row", gap: Spacing.sm },
  input: {
    flex: 1,
    backgroundColor: Colors.bg,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    color: Colors.textPrimary,
    fontSize: 15,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  inputError: { borderColor: Colors.red },
  btn: {
    backgroundColor: Colors.accent,
    borderRadius: Radius.md,
    width: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  btnDisabled: { opacity: 0.5 },

  scanNote: { ...Typography.caption, marginBottom: Spacing.sm },
  scanBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: Colors.accent,
    borderRadius: Radius.md,
    paddingVertical: 10,
  },
  scanBtnActive: { backgroundColor: Colors.accentDim },
  scanBtnText: { color: Colors.accent, fontWeight: "600", fontSize: 15 },

  serverRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  serverIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.accentDim,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.sm,
  },
  serverName: { ...Typography.body, fontWeight: "600" },
  serverAddress: { ...Typography.caption, fontSize: 12 },
  separator: { height: 1, backgroundColor: Colors.border },
  removeBtn: { padding: 6, marginRight: 4 },

  errorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
  },
  errorText: { color: Colors.red, fontSize: 13, flex: 1 },
});
