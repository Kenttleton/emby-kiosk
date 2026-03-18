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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from "@expo/vector-icons";
import { Colors, Radius, Spacing, Typography } from "../src/theme";
import { EmbyServer } from "../src/types/emby";
import { discoverServers, probeManualServer } from "../src/services/discovery";
import { authenticateByName, getPublicUsers } from "../src/services/embyApi";
import { useStore } from "../src/store";

export default function ServerScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const {
    savedServers,
    server: storedServer,
    authToken,
    hydrated,
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
    if (storedServer && authToken) {
      router.replace("/kiosk");
    }
  }, [hydrated]);

  const startDiscovery = () => {
    abortRef.current = false;
    setDiscovered([]);
    setScanDone(false);
    setDiscovering(true);
    discoverServers(
      (s) => {
        if (!abortRef.current) {
          setDiscovered((prev) => {
            if (prev.find((x) => x.id === s.id)) return prev;
            return [...prev, s];
          });
        }
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

  const pickServer = async (s: EmbyServer) => {
    addSavedServer(s);
    const creds = switchToServer(s);

    // Already have credentials for this server — go straight to kiosk
    if (creds) {
      router.replace('/kiosk');
      return;
    }

    // No creds — try auto-login for password-less single-user servers
    try {
      const users = await getPublicUsers(s.address);
      if (users.length === 1 && !users[0].HasPassword) {
        const result = await authenticateByName(s.address, users[0].Name, '');
        setAuth(result.AccessToken, result.User);
        router.replace('/kiosk');
        return;
      }
    } catch { }

    router.push('/login');
  };

  const handleManualAdd = async () => {
    if (!manualUrl.trim()) return;
    if (!manualUrl.startsWith('http://') && !manualUrl.startsWith('https://')) {
      setManualError('Address must start with http:// or https://');
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
      if (msg.includes("Network request failed") || msg.includes("fetch")) {
        setManualError(
          "Could not reach that address. Check the IP, port, and that Emby is running.",
        );
      } else if (msg.includes("Not an Emby server")) {
        setManualError("A server responded but it does not appear to be Emby.");
      } else {
        setManualError(msg || "Connection failed.");
      }
    }
  };

  const allServers: EmbyServer[] = [
    ...savedServers,
    ...discovered.filter((d) => !savedServers.find((s) => s.id === d.id)),
  ];

  if (!hydrated) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.accent} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.scrollContainer} contentContainerStyle={[styles.container, { paddingTop: insets.top }]} keyboardShouldPersistTaps="handled">
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.logoBlock}>
          <Image
            source={require('../assets/emby-logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.kioskLabel}>KIOSK</Text>
        </View>
        <Text style={styles.subtitle}>Select or discover your server</Text>
      </View>

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

      {/* Scan button */}
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

      {/* Server list */}
      {allServers.length > 0 && (
        <View style={[styles.card, { flex: 1 }]}>
          <Text style={styles.sectionLabel}>SERVERS</Text>
          <FlatList
            data={allServers}
            keyExtractor={(s) => s.id}
            scrollEnabled={false}
            renderItem={({ item }) => (
              <Pressable
                style={styles.serverRow}
                onPress={() => pickServer(item)}
              >
                <View style={styles.serverIcon}>
                  <Ionicons name="server" size={18} color={Colors.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.serverName}>{item.name}</Text>
                  <Text style={styles.serverAddress}>{item.address}</Text>
                </View>
                <Ionicons
                  name={item.discovered ? "radio" : "bookmark"}
                  size={14}
                  color={Colors.textMuted}
                  style={{ marginRight: 4 }}
                />
                {savedServers.some((s) => s.id === item.id) && (
                  <Pressable
                    onPress={() => removeSavedServer(item.id)}
                    hitSlop={8}
                    style={styles.removeBtn}
                  >
                    <Ionicons name="trash-outline" size={16} color={Colors.red} />
                  </Pressable>
                )}
                <Ionicons
                  name="chevron-forward"
                  size={16}
                  color={Colors.textMuted}
                />
              </Pressable>
            )}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
          />
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: { flex: 1, backgroundColor: Colors.bg },
  container: { padding: Spacing.md, paddingBottom: Spacing.xl },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.bg },
  header: { alignItems: "center", paddingVertical: Spacing.xl },
  logo: { width: 180, height: 55 },
  logoBlock: { alignItems: 'center' },
  kioskLabel: {
    color: Colors.accent,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 6,
    marginTop: -4,
  },
  title: { ...Typography.displayLg, marginTop: Spacing.sm },
  subtitle: { ...Typography.caption, marginTop: 4 },
  card: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  sectionLabel: { ...Typography.label, marginBottom: Spacing.sm },
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
  inputError: { borderColor: Colors.red },
  errorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
  },
  errorText: { color: Colors.red, fontSize: 13, flex: 1 },
  removeBtn: { padding: 6, marginRight: 4 },
});
