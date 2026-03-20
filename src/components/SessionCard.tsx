import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import Slider from "@react-native-community/slider";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { Colors, Radius, Spacing, Typography } from "../theme";
import { useStore } from "../store";
import { getItem, setPlaybackRate } from "../services/embyApi";
import { EmbySession, MediaStream } from "../types/emby";
import { normalizeMediaItem } from "../normalizeMedia";
import {
  formatDurationTicks,
  formatTime,
  progressPercent,
  ticksToSeconds,
} from "../utils";
import { SkipButton } from "./SkipButton";
import { SnapPicker } from "./SnapPicker";
import { TrackChip } from "./TrackChip";

import { logger } from "../services/logger";

// ─── Constants ────────────────────────────────────────────────────────────────

const SKIP_TICKS = 10 * 10_000_000;

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function formatClock(): string {
  return new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function resolutionLabel(streams: MediaStream[]): string | null {
  const v = streams.find((s) => s.Type === "Video");
  if (!v?.Height) return null;
  if (v.Height >= 2160) return "4K";
  if (v.Height >= 1080) return "1080p";
  if (v.Height >= 720) return "HD";
  return "SD";
}

export function hdrLabel(streams: MediaStream[]): string | null {
  const v = streams.find((s) => s.Type === "Video");
  if (!v?.VideoRange || v.VideoRange === "SDR") return null;
  return v.VideoRangeType ?? v.VideoRange;
}

// ─── StreamInfoPanel ──────────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={infoStyles.row}>
      <Text style={infoStyles.label}>{label}</Text>
      <Text style={infoStyles.value}>{value}</Text>
    </View>
  );
}

function InfoSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={infoStyles.section}>
      <Text style={infoStyles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function StreamInfoPanel({ session, streams }: { session: EmbySession; streams: MediaStream[] }) {
  const item = session.NowPlayingItem!;
  const ti = session.TranscodingInfo;
  const video = streams.find((s) => s.Type === "Video");
  const audio = streams.find((s) => s.IsDefault && s.Type === "Audio") ?? streams.find((s) => s.Type === "Audio");

  const fps = video?.RealFrameRate ?? video?.AverageFrameRate;
  const videoMethod = ti ? (ti.IsVideoDirect ? "Direct Stream" : "Transcode") : "Direct Play";
  const audioMethod = ti ? (ti.IsAudioDirect ? "Direct Stream" : "Transcode") : "Direct Play";

  return (
    <View style={infoStyles.panel}>
      <InfoSection title="STREAM">
        {item.Container && <InfoRow label="Container" value={item.Container.toUpperCase()} />}
        {item.Bitrate != null && <InfoRow label="Bitrate" value={`${Math.round(item.Bitrate / 1000)} kbps`} />}
      </InfoSection>

      {video && (
        <InfoSection title="VIDEO">
          {video.Codec && <InfoRow label="Codec" value={video.Codec.toUpperCase()} />}
          {video.Profile && <InfoRow label="Profile" value={video.Profile} />}
          {video.Level != null && <InfoRow label="Level" value={String(video.Level / 10)} />}
          {video.Width != null && video.Height != null && (
            <InfoRow label="Resolution" value={`W: ${video.Width}p  H: ${video.Height}p`} />
          )}
          {fps != null && <InfoRow label="Frame Rate" value={`${fps.toFixed(2)} fps`} />}
          {video.BitRate != null && <InfoRow label="Bitrate" value={`${Math.round(video.BitRate / 1000)} kbps`} />}
          {video.BitDepth != null && <InfoRow label="Bit Depth" value={`${video.BitDepth}-bit`} />}
          <InfoRow label="Method" value={videoMethod} />
          {ti?.DroppedFrameCount != null && ti.DroppedFrameCount > 0 && (
            <InfoRow label="Dropped Frames" value={String(ti.DroppedFrameCount)} />
          )}
          {ti?.TranscodeReasons && ti.TranscodeReasons.length > 0 && (
            <InfoRow label="Reason" value={ti.TranscodeReasons.join(", ")} />
          )}
        </InfoSection>
      )}

      {audio && (
        <InfoSection title="AUDIO">
          {audio.Codec && <InfoRow label="Codec" value={audio.Codec.toUpperCase()} />}
          {audio.Channels != null && <InfoRow label="Channels" value={audio.Channels === 2 ? "Stereo" : audio.Channels === 1 ? "Mono" : `${audio.Channels}ch`} />}
          {audio.SampleRate != null && <InfoRow label="Sample Rate" value={`${(audio.SampleRate / 1000).toFixed(1)} kHz`} />}
          {audio.BitRate != null && <InfoRow label="Bitrate" value={`${Math.round(audio.BitRate / 1000)} kbps`} />}
          <InfoRow label="Method" value={audioMethod} />
        </InfoSection>
      )}
    </View>
  );
}

const infoStyles = StyleSheet.create({
  panel: {
    position: "absolute",
    top: 36,
    left: 10,
    backgroundColor: "rgba(15,17,23,0.92)",
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.sm,
    zIndex: 30,
    minWidth: 220,
  },
  section: { marginBottom: Spacing.sm },
  sectionTitle: {
    ...Typography.label,
    color: Colors.accent,
    marginBottom: 4,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: Spacing.md,
    paddingVertical: 1,
    paddingLeft: Spacing.sm,
  },
  label: { color: Colors.textMuted, fontSize: 11 },
  value: { color: Colors.textPrimary, fontSize: 11, fontWeight: "600", textAlign: "right", flexShrink: 1 },
});

// ─── SessionCard ──────────────────────────────────────────────────────────────

export function SessionCard({
  session,
  serverAddress,
  controlsLocked,
  onCommand,
  onSeek,
  onVolume,
  onAudio,
  onSubtitle,
  onScrubStart,
  onScrubEnd,
  onStall,
  showDeviceId,
}: {
  session: EmbySession;
  serverAddress: string;
  controlsLocked: boolean;
  onCommand: (cmd: "PlayPause" | "Stop") => void;
  onSeek: (fraction: number) => void;
  onVolume: (vol: number) => void;
  onAudio: (index: number) => void;
  onSubtitle: (index: number) => void;
  onScrubStart?: () => void;
  onScrubEnd?: () => void;
  onStall?: () => void;
  showDeviceId?: boolean;
}) {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const { NowPlayingItem: item, PlayState: ps } = session;
  if (!item || !ps) return null;

  const isPortrait = screenHeight > screenWidth;
  const HERO_H = Math.min(screenWidth * 0.6, 420);

  const [seeking, setSeeking] = useState(false);
  const [seekValue, setSeekValue] = useState(0);

  // Smooth scrubber using Animated.Value:
  // On each server update — lerp from current display to server position (corrects drift),
  // then project forward one poll interval (keeps the bar moving between updates).
  const POLL_MS = 1500; // matches socket SessionsStart interval
  const LERP_MS = 400; // drift correction duration
  const DRIFT_THRESHOLD = 10_000_000; // 1 second in ticks — lerp if drift exceeds this
  const scrubAnim = useRef(new Animated.Value(ps.PositionTicks ?? 0)).current;
  const scrubAnimRef = useRef<Animated.CompositeAnimation | null>(null);
  const currentDisplayRef = useRef(ps.PositionTicks ?? 0);
  const [localPositionTicks, setLocalPositionTicks] = useState(
    ps.PositionTicks ?? 0,
  );

  // Listener keeps currentDisplayRef always in sync with the animation (no setState = no batching)
  useEffect(() => {
    const listenerId = scrubAnim.addListener(({ value }) => {
      currentDisplayRef.current = value;
    });
    return () => scrubAnim.removeListener(listenerId);
  }, []);

  // Drive the slider value from the animation at animation speed
  useEffect(() => {
    const listenerId = scrubAnim.addListener(({ value }) => {
      setLocalPositionTicks(Math.min(value, item.RunTimeTicks ?? Infinity));
    });
    return () => scrubAnim.removeListener(listenerId);
  }, []);

  // Drive the time text at 500ms — reads from the ref so it always gets the
  // current animated value rather than whatever React last rendered.
  const [displayTimeTicks, setDisplayTimeTicks] = useState(
    ps.PositionTicks ?? 0,
  );
  useEffect(() => {
    const id = setInterval(() => {
      setDisplayTimeTicks(
        Math.min(currentDisplayRef.current, item.RunTimeTicks ?? Infinity),
      );
    }, 500);
    return () => clearInterval(id);
  }, []);

  // Stall detection — fire onStall if position hasn't advanced for ~8 seconds while playing
  const STALL_MS = 8000;
  const lastPositionRef    = useRef(ps.PositionTicks ?? 0);
  const lastAdvancedAtRef  = useRef(Date.now());
  const stalledFiredRef    = useRef(false);
  const stalledRef         = useRef(false);

  useEffect(() => {
    const ticks = ps.PositionTicks ?? 0;
    if (ticks !== lastPositionRef.current) {
      lastPositionRef.current             = ticks;
      lastAdvancedAtRef.current           = Date.now();
      stalledFiredRef.current             = false;
      stalledRef.current                  = false;  // position advancing — unstall the scrubber
      // consecutiveAdvancingRef resets/increments in the animation effect
    }
  }, [ps.PositionTicks]);

  useEffect(() => {
    const id = setInterval(() => {
      if (ps.IsPaused || stalledFiredRef.current) return;
      if (Date.now() - lastAdvancedAtRef.current >= STALL_MS) {
        stalledFiredRef.current             = true;
        stalledRef.current                  = true;
        consecutiveAdvancingRef.current     = 0;
        scrubAnimRef.current?.stop();
        scrubAnim.setValue(lastPositionRef.current);  // snap back to real server position
        logger.warn('[SessionCard] playback stall detected', { sessionId: session.Id, positionTicks: ps.PositionTicks });
        onStall?.();
      }
    }, 1500);
    return () => clearInterval(id);
  }, [ps.IsPaused, onStall]);

  // Track seeking in a ref so the server-update effect doesn't depend on it
  const seekingRef = useRef(seeking);
  useEffect(() => {
    seekingRef.current = seeking;
  }, [seeking]);

  // When seeking starts, just stop the animation — don't touch the position
  // When seeking ends, snap to the chosen position (handled in onSlidingComplete)
  useEffect(() => {
    if (seeking) {
      scrubAnimRef.current?.stop();
    }
  }, [seeking]);

  const prevPositionTicksRef      = useRef(ps.PositionTicks ?? 0);
  const consecutiveAdvancingRef   = useRef(0);

  // On each server update, restart the lerp+project animation (unless seeking or stalled)
  useEffect(() => {
    if (seekingRef.current) return;
    if (stalledRef.current) return;

    const serverTicks = ps.PositionTicks ?? 0;
    const runtime = item.RunTimeTicks ?? 0;
    scrubAnimRef.current?.stop();

    if (ps.IsPaused) {
      scrubAnim.setValue(serverTicks);
      prevPositionTicksRef.current    = serverTicks;
      consecutiveAdvancingRef.current = 0;
      return;
    }

    if (serverTicks === prevPositionTicksRef.current) {
      // Position unchanged — hold, don't project, reset run counter
      scrubAnim.setValue(serverTicks);
      consecutiveAdvancingRef.current = 0;
      return;
    }

    prevPositionTicksRef.current = serverTicks;
    consecutiveAdvancingRef.current += 1;

    // Require two consecutive advancing polls before projecting forward —
    // prevents a single hiccup-advance from kicking off a projection that snaps back
    if (consecutiveAdvancingRef.current < 2) {
      scrubAnim.setValue(serverTicks);
      return;
    }

    const current = currentDisplayRef.current;
    const drift = serverTicks - current;
    const steps: Animated.CompositeAnimation[] = [];

    if (Math.abs(drift) > DRIFT_THRESHOLD) {
      steps.push(
        Animated.timing(scrubAnim, {
          toValue: serverTicks,
          duration: LERP_MS,
          useNativeDriver: false,
        }),
      );
    } else {
      scrubAnim.setValue(serverTicks);
    }

    steps.push(
      Animated.timing(scrubAnim, {
        toValue: Math.min(serverTicks + POLL_MS * 10_000, runtime),
        duration: POLL_MS,
        useNativeDriver: false,
      }),
    );

    scrubAnimRef.current = Animated.sequence(steps);
    scrubAnimRef.current.start();
  }, [ps.PositionTicks, ps.IsPaused]);
  const [scrubberWidth, setScrubberWidth] = useState(0);
  const [volumeValue, setVolumeValue] = useState<number | null>(null);
  const [tracksOpen, setTracksOpen] = useState(false);
  const [backdropFailed, setBackdropFailed] = useState(false);
  const [posterFailed, setPosterFailed] = useState(false);
  const [seriesOverview, setSeriesOverview] = useState<string | null>(null);

  useEffect(() => { setBackdropFailed(false); setPosterFailed(false); }, [item.Id]);

  useEffect(() => {
    if (item.Type === "Episode" && !item.Overview && item.SeriesId) {
      const { server, authToken } = useStore.getState();
      if (server && authToken) {
        getItem(server.address, authToken, item.SeriesId)
          .then((s) => setSeriesOverview(s.Overview ?? null))
          .catch(() => {});
      }
    } else {
      setSeriesOverview(null);
    }
  }, [item.Id]);

  const [selectedAudio, setSelectedAudio] = useState<number | null>(null);
  // null = no explicit selection (use IsDefault), -1 = Off explicitly chosen, n = track index chosen
  const [selectedSubtitle, setSelectedSubtitle] = useState<number | null>(null);
  const [speedOpen, setSpeedOpen] = useState(false);
  const [sleepOpen, setSleepOpen] = useState(false);
  const [volOpen, setVolOpen] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [sleepEndsAt, setSleepEndsAt] = useState<number | null>(null);
  const [sleepRemaining, setSleepRemaining] = useState<string | null>(null);
  const [sleepAfterCurrent, setSleepAfterCurrent] = useState(false);

  // Card entrance animation
  const entranceAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(entranceAnim, {
      toValue: 1,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, []);

  // Play badge pulse
  const badgePulse = useRef(new Animated.Value(1)).current;
  const isPlaying = !ps.IsPaused;
  useEffect(() => {
    if (isPlaying) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(badgePulse, {
            toValue: 0.55,
            duration: 1100,
            useNativeDriver: true,
          }),
          Animated.timing(badgePulse, {
            toValue: 1,
            duration: 1100,
            useNativeDriver: true,
          }),
        ]),
      );
      loop.start();
      return () => loop.stop();
    } else {
      badgePulse.setValue(1);
    }
  }, [isPlaying]);

  // Play button scale
  const playScale = useRef(new Animated.Value(1)).current;
  const onPlayPressIn = () =>
    Animated.spring(playScale, {
      toValue: 0.9,
      useNativeDriver: true,
      speed: 50,
      bounciness: 0,
    }).start();
  const onPlayPressOut = () =>
    Animated.spring(playScale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 20,
      bounciness: 5,
    }).start();

  // Sync volume from server unless the modal is open (user is actively adjusting)
  useEffect(() => {
    if (ps.VolumeLevel !== undefined && !volOpen)
      setVolumeValue(ps.VolumeLevel);
  }, [ps.VolumeLevel]);

  // Sync playback speed from server
  useEffect(() => {
    if (ps.PlaybackRate !== undefined && !speedOpen)
      setPlaybackSpeed(ps.PlaybackRate);
  }, [ps.PlaybackRate]);

  useEffect(() => {
    if (sleepEndsAt === null) {
      setSleepRemaining(null);
      return;
    }
    const tick = () => {
      const ms = sleepEndsAt - Date.now();
      if (ms <= 0) {
        onCommand("Stop");
        setSleepEndsAt(null);
        setSleepRemaining(null);
        return;
      }
      const totalMin = Math.ceil(ms / 60000);
      setSleepRemaining(
        totalMin >= 60
          ? `${Math.floor(totalMin / 60)}h${totalMin % 60 > 0 ? `${totalMin % 60}m` : ""}`
          : `${totalMin}m`,
      );
    };
    tick();
    const interval = setInterval(tick, 30000);
    return () => clearInterval(interval);
  }, [sleepEndsAt]);

  // "After this" — stop when current content finishes
  const runtimeTicks_ = item.RunTimeTicks ?? 0;
  const positionTicks_ = ps.PositionTicks ?? 0;
  useEffect(() => {
    if (!sleepAfterCurrent) return;
    if (runtimeTicks_ > 0 && positionTicks_ >= runtimeTicks_) {
      onCommand("Stop");
      setSleepAfterCurrent(false);
    }
  }, [sleepAfterCurrent, positionTicks_]);

  const SPEED_OPTIONS = [
    { label: "0.25×", value: 0.25 },
    { label: "0.5×", value: 0.5 },
    { label: "Normal", value: 1 },
    { label: "1.25×", value: 1.25 },
    { label: "1.5×", value: 1.5 },
    { label: "1.75×", value: 1.75 },
    { label: "2×", value: 2 },
  ];
  const SLEEP_OPTIONS = [
    { label: "15m", ms: 15 * 60 * 1000 },
    { label: "30m", ms: 30 * 60 * 1000 },
    { label: "1h", ms: 60 * 60 * 1000 },
    { label: "2h", ms: 2 * 60 * 60 * 1000 },
    { label: "4h", ms: 4 * 60 * 60 * 1000 },
    { label: "8h", ms: 8 * 60 * 60 * 1000 },
  ];
  const PICKER_ITEM_H = 44;
  const autoCloseRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startAutoClose = (closeFn: () => void) => {
    if (autoCloseRef.current) clearTimeout(autoCloseRef.current);
    autoCloseRef.current = setTimeout(closeFn, 2000);
  };
  const resetAutoClose = (closeFn: () => void) => startAutoClose(closeFn);

  const runtimeTicks = item.RunTimeTicks ?? 0;
  const positionTicks = seeking
    ? seekValue * runtimeTicks
    : Math.min(localPositionTicks, runtimeTicks);

  // Time text uses the 500ms-interval value so it updates independently of React render batching
  const displayElapsedTicks = seeking
    ? positionTicks
    : Math.min(displayTimeTicks, runtimeTicks);
  const displayRemainingTicks = Math.max(0, runtimeTicks - displayElapsedTicks);
  const sliderValue =
    !seeking && runtimeTicks > 0 ? positionTicks / runtimeTicks : seekValue;
  const progress = progressPercent(positionTicks, runtimeTicks);
  const vol = volumeValue ?? ps.VolumeLevel ?? 100;
  const volIcon =
    ps.IsMuted || vol === 0
      ? "volume-mute"
      : vol < 50
        ? "volume-low"
        : "volume-high";

  const streams = item.MediaStreams ?? [];
  const audioStreams = streams.filter((s) => s.Type === "Audio");
  const subtitleStreams = streams.filter((s) => s.Type === "Subtitle");
  const resolution = resolutionLabel(streams);
  const hdr = hdrLabel(streams);
  const [infoOpen, setInfoOpen] = useState(false);
  const isTranscoding = !!session.TranscodingInfo;
  const isDirectPlay = !isTranscoding;

  const media = normalizeMediaItem(
    item,
    serverAddress,
    Math.ceil(screenWidth),
    seriesOverview,
  );

  const skipTo = (deltaTicks: number) => {
    const next = Math.max(
      0,
      Math.min(runtimeTicks, positionTicks + deltaTicks),
    );
    onSeek(runtimeTicks > 0 ? next / runtimeTicks : 0);
  };

  return (
    <Animated.View
      style={[
        styles.card,
        {
          opacity: entranceAnim,
          transform: [
            {
              translateY: entranceAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [10, 0],
              }),
            },
          ],
        },
      ]}
    >
      {/* ── Hero ── */}
      <View style={[styles.heroWrapper, { height: HERO_H }]}>
        {media.backdropUrl && !backdropFailed ? (
          <Image
            source={{ uri: media.backdropUrl }}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
            onError={() => { setBackdropFailed(true); logger.warn('[SessionCard] Backdrop image failed to load:', media.backdropUrl); }}
          />
        ) : media.posterUrl && !posterFailed ? (
          <Image
            source={{ uri: media.posterUrl }}
            style={StyleSheet.absoluteFill}
            resizeMode="contain"
            onError={() => setPosterFailed(true)}
          />
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.heroPlaceholder]}>
            <Ionicons name="film-outline" size={64} color={Colors.textMuted} />
          </View>
        )}

        {/* Bottom gradient — starts higher and hits opacity sooner in portrait for title legibility */}
        <LinearGradient
          pointerEvents="none"
          colors={[
            "transparent",
            isPortrait ? "rgba(24,24,24,0.75)" : "rgba(24,24,24,0.6)",
            Colors.bgCard,
          ]}
          locations={[0, isPortrait ? 0.45 : 0.55, 1]}
          style={[StyleSheet.absoluteFill, { top: isPortrait ? "15%" : "30%" }]}
        />

        {/* Quality badges */}
        <View style={styles.heroBadgesTop}>
          <Pressable style={styles.infoBadge} onPress={() => setInfoOpen((v) => !v)}>
            <Ionicons name="information-circle" size={22} color={infoOpen ? Colors.accent : Colors.textSecondary} />
          </Pressable>
          {resolution && (
            <View style={styles.qualityBadge}>
              <Text style={styles.qualityBadgeText}>{resolution}</Text>
            </View>
          )}
          {hdr && (
            <View style={[styles.qualityBadge, styles.hdrBadge]}>
              <Text style={[styles.qualityBadgeText, styles.hdrBadgeText]}>
                {hdr}
              </Text>
            </View>
          )}
          {(
            <View
              style={[
                styles.qualityBadge,
                isDirectPlay ? styles.directBadge : styles.transBadge,
              ]}
            >
              <Text
                style={[
                  styles.qualityBadgeText,
                  isDirectPlay ? styles.directBadgeText : styles.transBadgeText,
                ]}
              >
                {isDirectPlay ? "DIRECT" : "TRANSCODE"}
              </Text>
            </View>
          )}
        </View>

        {/* Stream info panel */}
        {infoOpen && <StreamInfoPanel session={session} streams={streams} />}

        {/* Play state badge */}
        <Animated.View
          style={[
            styles.stateBadge,
            {
              backgroundColor: isPlaying ? Colors.accent : Colors.yellow,
              opacity: badgePulse,
            },
          ]}
        >
          <Ionicons
            name={isPlaying ? "play" : "pause"}
            size={10}
            color="#000"
          />
          <Text style={styles.stateBadgeText}>
            {isPlaying ? "PLAYING" : "PAUSED"}
          </Text>
        </Animated.View>

        {/* Title block */}
        <View style={styles.heroMeta}>
          {(media.subtitle || media.detail) && (
            <View style={styles.heroTopRow}>
              {media.subtitle && (
                <Text style={styles.heroSeries} numberOfLines={1}>
                  {media.subtitle}
                </Text>
              )}
              {media.detail && (
                <View style={styles.epBadge}>
                  <Text style={styles.epBadgeText}>{media.detail}</Text>
                </View>
              )}
            </View>
          )}
          <Text style={styles.heroTitle} numberOfLines={2}>
            {media.title}
          </Text>
          <View style={styles.metaChipsRow}>
            {media.year ? (
              <View style={styles.metaChip}>
                <Text style={styles.metaChipText}>{media.year}</Text>
              </View>
            ) : null}
            {media.rating ? (
              <View style={styles.metaChip}>
                <Text style={styles.metaChipText}>{media.rating}</Text>
              </View>
            ) : null}
            {media.communityRating ? (
              <View style={styles.metaChip}>
                <Ionicons
                  name="star"
                  size={10}
                  color={Colors.yellow}
                  style={{ marginRight: 3 }}
                />
                <Text style={styles.metaChipText}>
                  {media.communityRating.toFixed(1)}
                </Text>
              </View>
            ) : null}
            {runtimeTicks > 0 ? (
              <View style={styles.metaChip}>
                <Text style={styles.metaChipText}>
                  {formatDurationTicks(runtimeTicks)}
                </Text>
              </View>
            ) : null}
          </View>
          <View style={styles.watcherBlock}>
            <View style={styles.watcherRow}>
              <Ionicons
                name="person-circle-outline"
                size={13}
                color={Colors.accent}
              />
              <Text style={styles.watcherName}>{session.UserName}</Text>
            </View>
            <View style={styles.watcherRow}>
              <Ionicons name="tv-outline" size={13} color={Colors.textMuted} />
              <Text style={styles.watcherDevice}>{session.Client}</Text>
              <Text style={styles.watcherDot}>·</Text>
              <Text style={styles.watcherDevice}>{session.DeviceName}</Text>
              {showDeviceId && (
                <>
                  <Text style={styles.watcherDot}>·</Text>
                  <Text style={styles.watcherDevice}>
                    {session.DeviceId.slice(-8)}
                  </Text>
                </>
              )}
            </View>
          </View>
        </View>
      </View>

      {/* ── Controls zone ── */}
      <View style={styles.controlsZone}>
        {controlsLocked ? (
          <View style={styles.lockedControls}>
            <View style={styles.lockedProgressRow}>
              <Text style={styles.lockedTimeElapsed}>
                {formatTime(ticksToSeconds(displayElapsedTicks))}
              </Text>
              <View style={styles.lockedProgressTrack}>
                <View
                  style={[
                    styles.lockedProgressFill,
                    { width: `${progress}%` as any },
                  ]}
                />
              </View>
              <Text style={styles.lockedTimeRemaining}>
                -{formatTime(ticksToSeconds(displayRemainingTicks))}
              </Text>
            </View>
            <View style={styles.lockedIndicator}>
              <Ionicons name="lock-closed" size={13} color={Colors.yellow} />
              <Text style={styles.lockedIndicatorText}>Controls locked</Text>
            </View>
          </View>
        ) : (
          <>
            {/* Scrubber */}
            <View
              style={styles.scrubberRow}
              onLayout={(e) =>
                setScrubberWidth(e.nativeEvent.layout.width - 96)
              }
            >
              <Text style={styles.timeElapsed}>
                {formatTime(ticksToSeconds(displayElapsedTicks))}
              </Text>
              <View style={styles.scrubberContainer}>
                {seeking && scrubberWidth > 0 && (
                  <View
                    style={[
                      styles.seekTooltip,
                      {
                        left: Math.max(
                          0,
                          Math.min(
                            scrubberWidth - 36,
                            seekValue * scrubberWidth - 18,
                          ),
                        ),
                      },
                    ]}
                  >
                    <Text style={styles.seekTooltipText}>
                      {formatTime(ticksToSeconds(seekValue * runtimeTicks))}
                    </Text>
                  </View>
                )}
                <View
                  onTouchStart={() => onScrubStart?.()}
                  onTouchEnd={() => onScrubEnd?.()}
                  onTouchCancel={() => onScrubEnd?.()}
                >
                  <Slider
                    style={styles.scrubber}
                    minimumValue={0}
                    maximumValue={1}
                    value={sliderValue}
                    minimumTrackTintColor={Colors.accent}
                    maximumTrackTintColor={Colors.bgElevated}
                    thumbTintColor={Colors.accent}
                    onSlidingStart={() => {
                      setSeeking(true);
                      setSeekValue(sliderValue);
                    }}
                    onValueChange={(v) => setSeekValue(v)}
                    onSlidingComplete={(v) => {
                      setSeeking(false);
                      scrubAnim.setValue(v * (item.RunTimeTicks ?? 0));
                      onSeek(v);
                    }}
                  />
                </View>
              </View>
              <Text style={styles.timeRemaining}>
                -{formatTime(ticksToSeconds(displayRemainingTicks))}
              </Text>
            </View>

            {/* Transport — Row 1 */}
            <View style={styles.transportRow}>
              <Pressable
                style={styles.secondaryBtn}
                onPress={() => onCommand("Stop")}
              >
                <Ionicons name="stop" size={20} color={Colors.textSecondary} />
              </Pressable>
              <SkipButton
                direction="back"
                onPress={() => skipTo(-SKIP_TICKS)}
              />
              <Animated.View style={{ transform: [{ scale: playScale }] }}>
                <Pressable
                  style={styles.playBtn}
                  onPress={() => onCommand("PlayPause")}
                  onPressIn={onPlayPressIn}
                  onPressOut={onPlayPressOut}
                >
                  <Ionicons
                    name={isPlaying ? "pause" : "play"}
                    size={32}
                    color="#000"
                  />
                </Pressable>
              </Animated.View>
              <SkipButton
                direction="forward"
                onPress={() => skipTo(SKIP_TICKS)}
              />
              <Pressable
                style={[
                  styles.secondaryBtn,
                  tracksOpen && styles.secondaryBtnActive,
                ]}
                onPress={() => setTracksOpen((v) => !v)}
              >
                <Ionicons
                  name="options-outline"
                  size={20}
                  color={tracksOpen ? Colors.accent : Colors.textSecondary}
                />
              </Pressable>
            </View>

            {/* Volume + speed + sleep — Row 2 */}
            <View style={styles.row2}>
              <Pressable
                style={[styles.row2Btn, volOpen && styles.secondaryBtnActive]}
                onPress={() => {
                  setVolOpen((v) => {
                    if (!v) startAutoClose(() => setVolOpen(false));
                    return !v;
                  });
                  setSpeedOpen(false);
                  setSleepOpen(false);
                }}
              >
                <Ionicons
                  name={volIcon as any}
                  size={16}
                  color={volOpen ? Colors.accent : Colors.textMuted}
                />
                <Text
                  style={[
                    styles.row2BtnLabel,
                    volOpen && { color: Colors.accent },
                  ]}
                >
                  {vol}%
                </Text>
              </Pressable>
              <Pressable
                style={[styles.row2Btn, speedOpen && styles.secondaryBtnActive]}
                onPress={() => {
                  setSpeedOpen((v) => {
                    if (!v) startAutoClose(() => setSpeedOpen(false));
                    return !v;
                  });
                  setSleepOpen(false);
                  setVolOpen(false);
                }}
              >
                <Ionicons
                  name="speedometer-outline"
                  size={16}
                  color={speedOpen ? Colors.accent : Colors.textMuted}
                />
                <Text
                  style={[
                    styles.row2BtnLabel,
                    speedOpen && { color: Colors.accent },
                  ]}
                >
                  {playbackSpeed === 1 ? "Normal" : `${playbackSpeed}×`}
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.row2Btn,
                  (sleepOpen || sleepEndsAt !== null || sleepAfterCurrent) &&
                    styles.secondaryBtnActive,
                ]}
                onPress={() => {
                  setSleepOpen((v) => {
                    if (!v) startAutoClose(() => setSleepOpen(false));
                    return !v;
                  });
                  setSpeedOpen(false);
                  setVolOpen(false);
                }}
              >
                <Ionicons
                  name="moon-outline"
                  size={16}
                  color={
                    sleepEndsAt !== null || sleepAfterCurrent
                      ? Colors.yellow
                      : sleepOpen
                        ? Colors.accent
                        : Colors.textMuted
                  }
                />
                <Text
                  style={[
                    styles.row2BtnLabel,
                    (sleepEndsAt !== null || sleepAfterCurrent) && {
                      color: Colors.yellow,
                    },
                  ]}
                >
                  {sleepRemaining ??
                    (sleepAfterCurrent ? "After this" : "Sleep")}
                </Text>
              </Pressable>
            </View>

            {/* Track pickers */}
            {tracksOpen && (
              <View style={styles.tracksPanel}>
                {audioStreams.length > 0 && (
                  <View style={styles.trackSection}>
                    <Text style={styles.trackLabel}>AUDIO</Text>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                    >
                      {audioStreams.map((s) => {
                        const isActive =
                          selectedAudio !== null
                            ? s.Index === selectedAudio
                            : s.IsDefault;
                        return (
                          <TrackChip
                            key={s.Index}
                            stream={s}
                            active={isActive}
                            onPress={() => {
                              if (isActive) return;
                              setSelectedAudio(s.Index);
                              onAudio(s.Index);
                            }}
                          />
                        );
                      })}
                    </ScrollView>
                  </View>
                )}
                <View style={styles.trackSection}>
                  <Text style={styles.trackLabel}>SUBTITLES</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                  >
                    <TrackChip
                      stream={{
                        Index: -1,
                        Type: "Subtitle",
                        DisplayTitle: "Off",
                        IsDefault: false,
                        IsExternal: false,
                        IsForced: false,
                      }}
                      active={selectedSubtitle === -1 || (selectedSubtitle === null && subtitleStreams.every((s) => !s.IsDefault))}
                      isOff
                      onPress={() => {
                        if (selectedSubtitle === -1) return;
                        setSelectedSubtitle(-1);
                        onSubtitle(-1);
                      }}
                    />
                    {subtitleStreams.map((s) => {
                      const isActive =
                        selectedSubtitle === null
                          ? s.IsDefault
                          : s.Index === selectedSubtitle;
                      return (
                        <TrackChip
                          key={s.Index}
                          stream={s}
                          active={isActive}
                          onPress={() => {
                            if (isActive) return;
                            setSelectedSubtitle(s.Index);
                            onSubtitle(s.Index);
                          }}
                        />
                      );
                    })}
                  </ScrollView>
                </View>
              </View>
            )}
          </>
        )}

        {/* Details panel */}
        <View style={styles.detailsPanel}>
            <View style={styles.detailsInner}>
              {media.posterUrl && (
                <View style={styles.detailsPosterWrapper}>
                  <Image
                    source={{ uri: media.posterUrl }}
                    style={StyleSheet.absoluteFill}
                    resizeMode="cover"
                  />
                </View>
              )}
              <View style={styles.detailsMeta}>
                {media.subtitle ? (
                  <Text style={styles.detailsSeriesTitle} numberOfLines={2}>
                    {media.subtitle}
                  </Text>
                ) : (
                  <Text style={styles.detailsSeriesTitle} numberOfLines={2}>
                    {media.title}
                  </Text>
                )}
                {media.subtitle && media.detail ? (
                  <Text style={styles.detailsEpBadge}>
                    {media.detail} · {media.title}
                  </Text>
                ) : media.subtitle ? (
                  <Text style={styles.detailsEpBadge}>{media.title}</Text>
                ) : null}
                {media.overview ? (
                  <Text style={styles.detailsOverview}>{media.overview}</Text>
                ) : null}
                {media.genres.length > 0 && (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.genreRow}
                    contentContainerStyle={{ alignItems: "center" }}
                  >
                    {media.genres.map((g) => (
                      <View key={g} style={styles.genreChip}>
                        <Text style={styles.genreChipText} numberOfLines={1}>
                          {g}
                        </Text>
                      </View>
                    ))}
                  </ScrollView>
                )}
              </View>
            </View>
          </View>
      </View>

      {/* Volume modal */}
      <Modal
        visible={volOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setVolOpen(false)}
      >
        <Pressable
          style={styles.snapPickerBackdrop}
          onPress={() => setVolOpen(false)}
        >
          <Pressable style={styles.volumeModal} onPress={() => {}}>
            <Text style={styles.volumeModalLabel}>{vol}%</Text>
            {/* Rotate a fixed-width slider to make it vertical */}
            <View style={styles.volumeSliderTrack}>
              <Slider
                style={styles.volumeModalSlider}
                minimumValue={0}
                maximumValue={100}
                step={1}
                value={vol}
                minimumTrackTintColor={Colors.accent}
                maximumTrackTintColor={Colors.bgElevated}
                thumbTintColor={Colors.textPrimary}
                onValueChange={(v) => {
                  setVolumeValue(v);
                  onVolume(v);
                  resetAutoClose(() => setVolOpen(false));
                }}
              />
            </View>
            <Ionicons
              name={volIcon as any}
              size={20}
              color={Colors.textPrimary}
            />
          </Pressable>
        </Pressable>
      </Modal>

      {/* Speed picker modal */}
      <SnapPicker
        visible={speedOpen}
        options={SPEED_OPTIONS.map((o) => o.label)}
        selectedIndex={SPEED_OPTIONS.findIndex(
          (o) => o.value === playbackSpeed,
        )}
        itemHeight={PICKER_ITEM_H}
        onDismiss={() => setSpeedOpen(false)}
        onActivity={() => resetAutoClose(() => setSpeedOpen(false))}
        onSelect={(idx) => {
          const opt = SPEED_OPTIONS[idx];
          setPlaybackSpeed(opt.value);
          const { server, authToken } = useStore.getState();
          if (server && authToken)
            setPlaybackRate(
              server.address,
              authToken,
              session.Id,
              opt.value,
            ).catch(() => {});
          setSpeedOpen(false);
        }}
      />

      {/* Sleep picker modal */}
      <SnapPicker
        visible={sleepOpen}
        options={["Cancel", "After this", ...SLEEP_OPTIONS.map((o) => o.label)]}
        selectedIndex={sleepAfterCurrent ? 1 : sleepEndsAt !== null ? 0 : 0}
        itemHeight={PICKER_ITEM_H}
        onDismiss={() => setSleepOpen(false)}
        onActivity={() => resetAutoClose(() => setSleepOpen(false))}
        onSelect={(idx) => {
          if (idx === 0) {
            setSleepEndsAt(null);
            setSleepAfterCurrent(false);
          } else if (idx === 1) {
            setSleepAfterCurrent(true);
            setSleepEndsAt(null);
          } else {
            setSleepEndsAt(Date.now() + SLEEP_OPTIONS[idx - 2].ms);
            setSleepAfterCurrent(false);
          }
          setSleepOpen(false);
        }}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // Card
  card: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    overflow: "hidden",
    marginBottom: Spacing.md,
  },

  // Hero
  heroWrapper: { backgroundColor: Colors.bgElevated, overflow: "hidden" },
  heroPlaceholder: { alignItems: "center", justifyContent: "center" },

  heroBadgesTop: {
    position: "absolute",
    top: 10,
    left: 10,
    flexDirection: "row",
    gap: 6,
  },
  qualityBadge: {
    backgroundColor: Colors.glassDark,
    borderRadius: Radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
  },
  qualityBadgeText: {
    color: Colors.textPrimary,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  hdrBadge: {
    backgroundColor: "rgba(229,160,13,0.20)",
    borderColor: Colors.yellow,
  },
  hdrBadgeText: { color: Colors.yellow },
  infoBadge: { justifyContent: "center", alignItems: "center" },
  directBadge: {
    backgroundColor: "rgba(82,181,75,0.15)",
    borderColor: Colors.accent,
  },
  directBadgeText: { color: Colors.accent },
  transBadge: {
    backgroundColor: "rgba(204,41,41,0.15)",
    borderColor: Colors.red,
  },
  transBadgeText: { color: Colors.red },

  stateBadge: {
    position: "absolute",
    top: 10,
    right: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.sm,
  },
  stateBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#000",
    letterSpacing: 0.5,
  },

  heroMeta: {
    position: "absolute",
    left: Spacing.md,
    right: Spacing.md,
    bottom: Spacing.md,
  },
  heroTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  heroSeries: { color: Colors.accent, fontSize: 13, fontWeight: "600" },
  epBadge: {
    backgroundColor: Colors.accentDim,
    borderRadius: Radius.sm,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  epBadgeText: { color: Colors.accent, fontSize: 11, fontWeight: "700" },
  heroTitle: {
    color: Colors.textPrimary,
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: -0.3,
    lineHeight: 30,
    marginBottom: Spacing.xs,
  },

  metaChipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 5,
    marginBottom: Spacing.xs,
  },
  metaChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: Radius.sm,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  metaChipText: { color: Colors.textSecondary, fontSize: 12 },

  watcherBlock: { flexDirection: "column", gap: 2 },
  watcherRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    flexWrap: "wrap",
  },
  watcherName: { color: Colors.textSecondary, fontSize: 12, fontWeight: "500" },
  watcherDot: { color: Colors.textMuted, fontSize: 12 },
  watcherDevice: { color: Colors.textMuted, fontSize: 12 },

  // Controls zone
  controlsZone: {
    backgroundColor: Colors.bgCard,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },

  // Locked
  lockedControls: { paddingVertical: Spacing.sm },
  lockedProgressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: Spacing.sm,
  },
  lockedProgressTrack: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.bgElevated,
    overflow: "hidden",
  },
  lockedProgressFill: {
    height: "100%",
    backgroundColor: Colors.accent,
    borderRadius: 2,
  },
  lockedTimeElapsed: {
    color: Colors.textPrimary,
    fontSize: 13,
    fontWeight: "600",
    minWidth: 42,
    textAlign: "center",
  },
  lockedTimeRemaining: {
    color: Colors.textMuted,
    fontSize: 13,
    minWidth: 42,
    textAlign: "center",
  },
  lockedIndicator: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: Spacing.xs,
  },
  lockedIndicatorText: {
    color: Colors.yellow,
    fontSize: 13,
    fontWeight: "500",
  },

  // Scrubber
  scrubberRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: Spacing.xs,
  },
  scrubberContainer: { flex: 1, position: "relative" },
  scrubber: { height: 40 },
  timeElapsed: {
    color: Colors.textPrimary,
    fontSize: 13,
    fontWeight: "600",
    minWidth: 42,
    textAlign: "center",
  },
  timeRemaining: {
    color: Colors.textMuted,
    fontSize: 13,
    minWidth: 42,
    textAlign: "center",
  },
  seekTooltip: {
    position: "absolute",
    top: -28,
    zIndex: 10,
    backgroundColor: Colors.glassDark,
    borderRadius: Radius.sm,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
  },
  seekTooltipText: {
    color: Colors.textPrimary,
    fontSize: 11,
    fontWeight: "600",
  },

  // Transport
  transportRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.sm,
  },
  secondaryBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.bgElevated,
  },
  secondaryBtnActive: { backgroundColor: Colors.accentDim },
  playBtn: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: Colors.accent,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: Colors.accentGlow,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 14,
    elevation: 8,
  },

  row2: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: Spacing.sm,
    marginBottom: Spacing.md,
  },
  row2Btn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  row2BtnLabel: { color: Colors.textMuted, fontSize: 12 },
  volumeModal: {
    flexDirection: "column",
    alignItems: "center",
    backgroundColor: Colors.bgOverlay,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
  },
  volumeSliderTrack: {
    width: 40,
    height: 180,
    justifyContent: "center",
    alignItems: "center",
  },
  volumeModalSlider: {
    width: 180,
    height: 40,
    transform: [{ rotate: "-90deg" }],
  },
  volumeModalLabel: {
    color: Colors.textSecondary,
    fontSize: 13,
    textAlign: "center",
  },
  snapPickerBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
  },

  // Tracks
  tracksPanel: {
    marginTop: Spacing.xs,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  trackSection: { marginBottom: Spacing.md, paddingVertical: Spacing.sm },
  trackLabel: { ...Typography.label, marginBottom: 6 },

  // Details
  detailsToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: Spacing.sm,
    marginTop: Spacing.xs,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  detailsToggleText: { color: Colors.textMuted, fontSize: 13 },
  detailsPanel: { paddingTop: Spacing.sm, paddingBottom: Spacing.md },
  detailsInner: { flexDirection: "row", gap: Spacing.sm * 1.5 },
  detailsPosterWrapper: {
    width: 96,
    height: 144,
    borderRadius: Radius.md,
    overflow: "hidden",
    backgroundColor: Colors.bgElevated,
    flexShrink: 0,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
  },
  detailsMeta: { flex: 1 },
  detailsSeriesTitle: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 2,
  },
  detailsEpBadge: {
    color: Colors.textMuted,
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.4,
    marginBottom: Spacing.sm,
  },
  detailsOverview: {
    color: Colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
  genreRow: { marginTop: Spacing.md },
  genreChip: {
    backgroundColor: Colors.bgElevated,
    borderRadius: Radius.xl,
    paddingHorizontal: 10,
    paddingTop: 3,
    paddingBottom: 3,
    marginRight: 6,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  genreChipText: { color: Colors.textMuted, fontSize: 12 },
});
