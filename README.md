# Emby Kiosk — React Native / Expo App

A native Android (and iOS-compatible) app to monitor what a user is streaming on your Emby server,
with a full remote-control kiosk mode. Also builds as a static web app for Linux-based kiosk
deployments on low-cost single-board computers.

---

## Features

| Feature | Details |
|---|---|
| **Server Discovery** | Auto-scans your LAN subnet (192.168.x.0/24) on ports 8096 & 8920 |
| **Manual Server Entry** | Type any IP/hostname, app probes and validates it |
| **Public User Quick-Pick** | Shows Emby's public users with avatar images for one-tap login |
| **Now Playing** | Poster, backdrop, title, series info, rating, year, runtime, progress bar |
| **Playback State** | Playing / Paused / Stopped indicators, current position, live via WebSocket |
| **Multiple Sessions** | Shows all sessions for the user, idle devices listed separately |
| **Remote Control (Kiosk)** | Play, Pause, Stop, timeline scrubber, volume, audio & subtitle track switching |
| **Session Picker** | Target any active session on your server |
| **Content Search** | Text search across Movies, Series, Episodes with poster previews |
| **Load to Remote** | Send any search result to play on the selected session immediately |
| **Persistent State** | Server + auth token saved; re-opens straight to sessions on relaunch |

---

## Project Structure

```
EmbyMonitor/
├── app/                      # Expo Router screens
│   ├── _layout.tsx           # Root layout, navigation shell
│   ├── index.tsx             # Server discovery / selection
│   ├── login.tsx             # User login
│   ├── session.tsx           # Now playing / session info
│   └── kiosk.tsx             # Remote control + search
├── src/
│   ├── hooks/
│   │   └── useEmbySocket.ts  # WebSocket hook (live session updates + reconnect)
│   ├── services/
│   │   ├── embyApi.ts        # All Emby REST API calls
│   │   └── discovery.ts      # LAN subnet scanning
│   ├── store/
│   │   └── index.ts          # Zustand state (server, token, user)
│   ├── types/
│   │   └── emby.ts           # TypeScript types for all Emby objects
│   ├── theme.ts              # Colors, spacing, typography tokens
│   └── utils.ts              # Tick conversion, time formatting helpers
├── app.json                  # Expo config
├── package.json
└── tsconfig.json
```

---

## Prerequisites

- **Node.js** 18 or newer — https://nodejs.org

Additional requirements depend on which build path you choose (see below).

### Build paths at a glance

**Option A — Local APK via `expo prebuild` + Gradle (recommended)**
Fully local, free, no account needed, no build limits. Expo generates the native
`android/` folder from your project config, then you build with Gradle on your own
machine. Requires **Android Studio** (free) — https://developer.android.com/studio —
which bundles the Android SDK, build tools, emulator, and OpenJDK 17 in one installer.
See the **Building a Standalone APK** section.

**Option B — EAS cloud build (alternate)**
Expo's hosted build service compiles the APK in the cloud. Requires a free account at
https://expo.dev and an internet connection during the build. The free tier has a monthly
build limit; paid plans remove the cap. No Android Studio or local SDK needed.
See the **Building a Standalone APK (EAS alternate)** section.

**Option C — Quick device testing via Expo Go**
Install the **Expo Go** app from the Google Play Store on your Android phone. Run
`npx expo start` on your dev machine and scan the QR code. Both devices must be on the
same Wi-Fi network. No build step required — useful for rapid UI iteration, but the app
runs inside the Expo Go sandbox rather than as a standalone install.

**Option D — Web app build (for SBC / Linux kiosk deployments)**
Exports a static HTML/JS bundle served by a local HTTP server and opened fullscreen in
Chromium. No Android, no APK, no native toolchain needed on the target device.
See the **Web Build & Linux Kiosk Deployment** section.

---

## Quick Start

### Option A — Local build (recommended)

```bash
# 1. Install dependencies
cd EmbyMonitor
npm install

# 2. Generate the native Android project (one-time setup)
npx expo prebuild --platform android

# 3. Build and run on a connected emulator or USB device
npx expo run:android
```

Metro hot-reloads JS changes as you edit. When you need a distributable APK for
sideloading, run `cd android && ./gradlew assembleRelease`.

### Option C — Expo Go (quickest way to see the app running, no build needed)

```bash
npm install
npx expo start   # prints a QR code
```

Scan the QR code with the **Expo Go** app (Google Play Store) on an Android phone on the
same Wi-Fi network. No APK, no build step — good for rapid UI iteration.

---

## App Flow

```
Server Discovery Screen
    ↓  (select or auto-discover server)
Login Screen
    ↓  (enter username + password)
Session Screen  ←──────────────────────────────────┐
    │  (shows what user is streaming, auto-polls)   │
    ↓  (tap "Remote Control")                       │
Kiosk Screen                                        │
    ↑  (back button)  ──────────────────────────────┘
```

**Back navigation** — the standard Android back gesture or the header back button always
works at every step. From the Session screen, "Sign Out" returns to Login.
From Login, tapping the server badge returns to Server Discovery.

---

## Emby API Endpoints Used

| Purpose | Endpoint |
|---|---|
| Server probe | `GET /emby/System/Info/Public` |
| Public users | `GET /emby/Users/Public` |
| Login | `POST /emby/Users/AuthenticateByName` |
| Sessions | `GET /emby/Sessions?userId={id}` |
| Images | `GET /emby/Items/{id}/Images/{type}` |
| Search | `GET /emby/Items?searchTerm=…` |
| Remote play | `POST /emby/Sessions/{id}/Playing` |
| Playstate | `POST /emby/Sessions/{id}/Playing/{Command}` |
| Logout | `POST /emby/Sessions/Logout` |

Authentication uses the `Authorization: Emby …` header + `X-Emby-Token` on every request,
exactly as specified in the Emby developer docs.

---

## Remote Control Notes

- The **Kiosk screen** shows all sessions on your Emby server (not just the current user).
  This allows you to control any player — a TV, a web browser, another phone, etc.
- The **session picker** at the top lets you switch which player you're targeting.
- **Audio & subtitle track pickers** appear automatically when the selected session's
  `NowPlayingItem` includes `MediaStreams`. Emby only includes this field in the WebSocket
  `Sessions` message if the server is configured to send it. If the pickers don't appear,
  the server may need `Fields=MediaStreams` added to the HTTP sessions fetch as a fallback —
  but for the WebSocket path this is server-controlled.
- **Seek** works by sending `POST /Sessions/{id}/Playing/Seek?SeekPositionTicks={ticks}`.
  The receiving client must support seeking (most do).
- **Play Now** sends the item's `Id` with `PlayCommand: PlayNow`.
  The target session's Emby client handles buffering/transcoding decisions itself.

---

## Building a Standalone APK

This project uses **`expo prebuild` + local Gradle** — a fully local, free, open source
build pipeline. No EAS account, no cloud service, no build limits of any kind.

### How it works

`expo prebuild` reads `app.json` and `package.json` and generates a native `android/`
folder with everything pre-configured: `AndroidManifest.xml` permissions, Gradle
dependencies, and native module linking for all `expo-*` packages. You then build that
`android/` folder with Gradle exactly as you would any standard Android project. The Expo
SDK libraries (routing, network, secure storage, etc.) remain in use — only the cloud
build service is replaced with a local build.

The `eas.json` file in the project root is not used by this workflow and can be deleted.

### Prerequisites

Install **Android Studio** from https://developer.android.com/studio. During setup, accept
the prompts to install the Android SDK, SDK Build-Tools, and an Android emulator image
(API 34 / Android 14 is a good choice). Android Studio bundles OpenJDK 17 — no separate
Java install needed.

After installation, confirm the SDK path is set. Android Studio will prompt you to do this
on first launch. The path is typically:
- **Windows:** `C:\Users\<you>\AppData\Local\Android\Sdk`
- **macOS:** `~/Library/Android/sdk`
- **Linux:** `~/Android/Sdk`

Set `ANDROID_HOME` in your shell profile if Gradle can't find the SDK:
```bash
export ANDROID_HOME=$HOME/Android/Sdk
export PATH=$PATH:$ANDROID_HOME/platform-tools
```

### 1. Set your app identifier

Edit `app.json` → `expo.android.package` to a unique reverse-domain string:
```json
"package": "com.yourname.embymonitor"
```

### 2. Install dependencies

```bash
npm install
```

### 3. Generate the native Android project

```bash
npx expo prebuild --platform android
```

This creates the `android/` folder. You only need to run this again if you later add a
new native module or change native config in `app.json`.

### 4. Build the APK

```bash
cd android
./gradlew assembleRelease
```

On Windows use `gradlew.bat assembleRelease`. The first run downloads Gradle and
dependencies — this takes a few minutes. Subsequent builds are fast.

Output APK:
```
android/app/build/outputs/apk/release/app-release.apk
```

### 5. Sideload the APK

Transfer the `.apk` to your Android device via USB cable, then:

1. On the device: **Settings → Security → Install unknown apps** → allow your file manager
2. Open the `.apk` from the file manager and tap Install

Or push directly via ADB if the device is connected and USB debugging is enabled:
```bash
adb install android/app/build/outputs/apk/release/app-release.apk
```

### Day-to-day development workflow

For active development, use the Metro bundler with a connected emulator or USB device
rather than rebuilding the APK each time:

```bash
# Terminal 1 — start the JS bundler
npx expo start

# Terminal 2 — build and launch on emulator or connected device
npx expo run:android
```

`npx expo run:android` does a full native build and installs the app. After that, Metro
hot-reloads JS changes instantly without a rebuild. Only run `./gradlew assembleRelease`
again when you need a distributable APK for sideloading.

### Updating package.json scripts

Replace the EAS-dependent scripts with local equivalents:

```json
"scripts": {
  "start": "expo start",
  "android": "expo run:android",
  "build:apk": "cd android && ./gradlew assembleRelease",
  "web": "expo export -p web"
}
```

---

## Building a Standalone APK (EAS alternate)

EAS (Expo Application Services) is Expo's hosted cloud build service. It compiles your APK
on Expo's servers so you don't need Android Studio or a local SDK. The tradeoff is that it
requires a free account and has a monthly build limit on the free tier.

**When this makes sense:** you don't want to install Android Studio, you're on a machine
without enough resources to run the Android emulator, or you're doing a one-off build.

**When Option A is better:** day-to-day development, no internet during builds, no build
limits, full local control.

### 1. Install EAS CLI and log in

```bash
npm install -g eas-cli
eas login       # creates / uses your account at expo.dev
```

### 2. Set your app identifier

Edit `app.json` → `expo.android.package` to something unique, e.g.:
`"com.yourname.embymonitor"`

### 3. Configure EAS (first time only)

```bash
eas build:configure
```

Confirm the generated `eas.json` has a `preview` profile:

```json
{
  "build": {
    "preview": {
      "android": { "buildType": "apk" }
    },
    "production": {}
  }
}
```

### 4. Build

```bash
eas build --platform android --profile preview
```

EAS queues and runs the build in the cloud. When complete, it provides a download link
for the `.apk`.

### 5. Sideload the APK

- Transfer the `.apk` to your device via USB, email, or cloud storage
- **Settings → Security → Install unknown apps** → allow your file manager
- Open the `.apk` and tap Install

---

## Web Build & Linux Kiosk Deployment

Expo supports compiling this app to a static web bundle via `expo export`. This is the
recommended path for deploying on low-cost single-board computers (SBCs) running Linux,
since it avoids the complexity of running Android on embedded hardware. The app is served
locally by a tiny HTTP server and opened fullscreen in Chromium on boot — no Android,
no app store, no APK involved.

### Seek slider and web builds

`@react-native-community/slider` v5.x (the stable release used in this project) supports
Android, iOS, and Windows natively with full performance. Web support exists but ships
separately under the `@next` dist tag (`@react-native-community/slider@next`), which is a
prerelease channel and not considered production-stable yet.

For the Android and emulator builds you use day-to-day, no changes are needed — the slider
works correctly out of the box at v5.1.2.

For a web build targeting an SBC/Linux kiosk, the recommended approach is to keep v5.1.2
for native builds and substitute a plain HTML range input on web using a `Platform.OS`
conditional. This keeps one codebase that works correctly on both targets without pulling
in a prerelease dependency:

```tsx
import { Platform } from 'react-native';

// Replace <Slider ... /> in app/kiosk.tsx with:
{Platform.OS === 'web' ? (
  <input
    type="range"
    min={0}
    max={1}
    step={0.001}
    value={sliderValue}
    style={{ width: '100%', accentColor: '#52b8ff' }}
    onChange={(e) => setSeekValue(parseFloat(e.target.value))}
    onMouseDown={() => setSeeking(true)}
    onTouchStart={() => setSeeking(true)}
    onMouseUp={(e) => {
      setSeeking(false);
      seekTo(parseFloat((e.target as HTMLInputElement).value));
    }}
    onTouchEnd={(e) => {
      setSeeking(false);
      seekTo(parseFloat((e.target as HTMLInputElement).value));
    }}
  />
) : (
  <Slider
    style={styles.slider}
    minimumValue={0}
    maximumValue={1}
    value={sliderValue}
    minimumTrackTintColor={Colors.accent}
    maximumTrackTintColor={Colors.bgElevated}
    thumbTintColor={Colors.accent}
    onSlidingStart={() => { setSeeking(true); setSeekValue(sliderValue); }}
    onValueChange={(v) => setSeekValue(v)}
    onSlidingComplete={(v) => { setSeeking(false); seekTo(v); }}
  />
)}
```

If `@react-native-community/slider@next` stabilises and ships web support in a full
release, the `Platform.OS` conditional can be removed and the single component used
everywhere.

### Build the web bundle

```bash
npx expo export -p web
# Output goes to: dist/
```

Copy the `dist/` folder to your SBC via `scp`, USB drive, or SD card.

### Serve the bundle on the SBC

Python 3 is available on every major Linux distro with no installation required:

```bash
# Verify manually first
python3 -m http.server 3000 --directory /home/pi/dist
# Open http://localhost:3000 in a browser to confirm it loads
```

Create a systemd service so it starts automatically on every boot:

```bash
sudo nano /etc/systemd/system/emby-ui.service
```

```ini
[Unit]
Description=Emby Kiosk UI
After=network.target

[Service]
ExecStart=python3 -m http.server 3000 --directory /home/pi/dist
Restart=always
User=pi

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable emby-ui
sudo systemctl start emby-ui
```

### Autostart Chromium in kiosk mode

```bash
mkdir -p ~/.config/autostart
nano ~/.config/autostart/kiosk.desktop
```

```ini
[Desktop Entry]
Name=EmbyMonitor Kiosk
Exec=chromium --kiosk --noerrdialogs --disable-infobars --no-first-run --disable-pinch --overscroll-history-navigation=0 --app=http://localhost:3000
Type=Application
```

The `--app` flag strips all browser UI (address bar, buttons, tabs). `--kiosk` enforces
true fullscreen. Together these make Chromium behave as a single-purpose display with no
way for a casual user to accidentally navigate away.

### Disable screen blanking

Add a second autostart entry, or append to your session startup script:

```bash
nano ~/.config/autostart/nodpms.desktop
```

```ini
[Desktop Entry]
Name=Disable DPMS
Exec=bash -c "xset s off && xset -dpms && xset s noblank"
Type=Application
```

### Enable desktop auto-login on boot

On Armbian / Debian with LightDM:

```bash
sudo nano /etc/lightdm/lightdm.conf
# Set: autologin-user=pi
# Set: autologin-user-timeout=0
```

On Raspberry Pi OS: `sudo raspi-config` → System Options → Boot / Auto Login → Desktop Autologin.

---

## Hardware Deployment Options

The sections below cover four approaches to building a dedicated kiosk for this app,
from free/found hardware up to a convenient off-the-shelf purchase. Prices are omitted
as they shift constantly — check AliExpress, eBay, and local marketplaces for current
figures.

---

### Option 1 — Repurpose existing hardware (free to very cheap)

Before buying anything, check whether you already own — or can source cheaply locally —
any of the following. All support APK sideloading natively; older Android phones and
tablets also work well running the web build opened fullscreen in Chrome.

**Good candidates:**
- Any Android phone from ~2017 onward (Android 7+) with a working touchscreen
- Any Android tablet — old Fire tablets, Samsung Tab A/E, Lenovo Tab, etc.
- A spare laptop or mini PC running Linux, paired with any USB touchscreen monitor

**Kiosk setup on recycled Android hardware:**
1. Enable Developer Options: Settings → About Phone → tap Build Number 7 times
2. Enable Unknown Sources: Settings → Security → Install Unknown Apps → on
3. Transfer the `.apk` via USB cable or a download link and tap to install
4. Install **Fully Kiosk Browser** (free tier) from `fully-kiosk.com` — handles autostart
   on boot, keeps screen on, and locks the device to a single app
5. Mount with a cheap phone/tablet wall mount or stand

**Where to look locally:** Facebook Marketplace, Craigslist, OfferUp, and thrift stores
regularly have functional old Android phones and tablets at low prices. A cosmetically
worn device is perfect for a fixed wall mount.

This is the best first move. If something suitable turns up, the total new spend is the
mount hardware and nothing else.

---

### Option 2 — Minimal DIY SBC build

The smallest viable build using new components sourced from AliExpress. Uses the **web
build path** (Chromium kiosk on Linux/Armbian) rather than Android, which is significantly
more stable on this class of hardware and requires much less configuration.

**Components to source:**
- **Orange Pi Zero 2W (1GB RAM)** — quad-core Cortex-A53, Mali G31 GPU, Wi-Fi, tiny
  30×65mm footprint. Search "Orange Pi Zero 2W" on AliExpress or direct from orangepi.org.
- **Orange Pi Zero 2W expansion board** — adds USB-A ports required for touchscreen HID
  input. Search "Orange Pi Zero 2W expansion board".
- **4" HDMI IPS capacitive touchscreen, 800×480** — smallest practical screen size for
  this UI. Search "4 inch HDMI IPS capacitive touch SBC". Spend a little more for
  **capacitive** over resistive — resistive touch is frustrating for a tap-based interface.
- **16GB Class 10 microSD card**
- **USB-C 5V/2A power supply** — any phone charger works
- **Mini HDMI to HDMI cable**

**OS:** Armbian (Debian Bookworm, desktop build) — download from armbian.com, flash with
Balena Etcher. Follow the Web Build & Linux Kiosk Deployment steps above.

**Wiring:**
```
[5V USB-C PSU]
      │
      ▼
[Orange Pi Zero 2W]
  mini-HDMI ──────────────► [4" Touchscreen HDMI in]
  USB-A (via expansion) ──► [Touchscreen USB touch in]
```

The touchscreen's USB cable registers as a standard HID pointer device — no drivers
needed on Linux. If the screen can be powered via USB (most can), it can draw power from
the expansion board's USB-A port, keeping the whole build on a single power supply.

**Enclosure:** The board is 30×65mm. A simple two-piece sandwich with standoffs printed
in PLA is quick to design and print. Alternatively, mount both to a small acrylic panel
with M2.5 standoffs for a clean, fully visible result.

**Optional soldering:** None required for basic operation. If you want to eliminate the
mini HDMI cable, you could hard-wire a direct FPC or ribbon connection, but this is not
worth the effort for most builds.

---

### Option 3 — Ideal DIY SBC build

The same approach as Option 2 but with a larger screen and more RAM, giving a more
comfortable reading experience and headroom for future expansion (e.g. a local Node server,
a second service, or GPIO integrations like a PIR motion wake sensor).

**Upgrades over Option 2:**
- **Orange Pi Zero 2W (2GB RAM)** instead of 1GB
- **7" HDMI IPS capacitive touchscreen, 1024×600** — a much more comfortable panel for
  a home theater context; fits poster images, metadata, and the scrubber without scrolling.
  Search "7 inch HDMI IPS capacitive touch 1024x600 SBC".
- Everything else remains identical

A 7" panel is close to the practical minimum for comfortable arm's-length reading in a
lounge or theater room. If wall-mounting near a seating position rather than on an equipment
rack, a 10" panel (same search with "10 inch") is worth considering for the extra
readability — and the price difference between 7" and 10" AliExpress panels is often small.

**Optional PIR motion wake:** Connect a cheap HC-SR501 PIR sensor to a GPIO pin and run
a small Python script that calls `xset dpms force on` on motion detection. This lets the
screen sleep when the room is empty and wake automatically when someone walks in — useful
for a panel that's on all day.

---

### Option 4 — Off-the-shelf (least setup, most convenient)

Pre-built consumer hardware that works out of the box with the APK sideload path. No
soldering, no Linux configuration, no SD card flashing required.

**Amazon Fire HD 8**

The standard choice for the home automation kiosk community — Home Assistant dashboards,
SmartThings panels, and similar projects all use this hardware for exactly this use case.

- Fire OS is Android 11 underneath; sideloading APKs is well-supported and documented
- **Fire Toolbox** (search GitHub for "Fire-Toolbox") automates: disabling Amazon
  bloatware, sideloading Google Play if desired, removing lockscreen ads, and setting a
  custom launcher
- **Fully Kiosk Browser** (free tier is sufficient; paid license adds motion-wake via
  the front camera and remote management) handles autostart on boot and single-app lock
- First-party standing covers and third-party wall mounts are widely available
- Amazon discounts Fire tablets heavily several times per year (Prime Day, Black Friday,
  and other events). Set a price alert — do not pay list price.

**Generic Android tablet from AliExpress**

Many manufacturers sell functional Android tablets (not Fire OS) at competitive prices.
Stock Android means straightforward APK sideloading with standard Developer Options — no
Fire Toolbox or workarounds required. Search "10 inch Android tablet 4GB RAM". Common
brands at the low end include Teclast, Alldocument, PRITOM, and similar. Quality varies;
read reviews and favour sellers with high order counts and recent feedback.

**Used or refurbished tablet (eBay, Facebook Marketplace, OfferUp)**

Functionally identical to new off-the-shelf but cheaper. Good targets: Samsung Galaxy Tab
A series, Lenovo Tab M series, older iPad (use the web build in Safari — iOS doesn't
allow APK sideloading without a developer account). A cosmetically worn but fully
functional tablet is ideal for a fixed wall mount where no one will see the back.

---

## Customisation

### Change poll interval

In `app/session.tsx`, change `POLL_INTERVAL` (default 5000ms):
```ts
const POLL_INTERVAL = 5000; // milliseconds
```

In `app/kiosk.tsx` it's 3000ms for more responsive remote control.

### Default server port

In `src/services/discovery.ts`, the scanned ports are:
```ts
const ports = [8096, 8920];
```
Add any custom port your Emby server uses.

### Dark theme colours

All colours live in `src/theme.ts`. Change `Colors.accent` (currently `#52b8ff`) to
match any branding you prefer.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| LAN scan finds nothing | Confirm Emby runs on port 8096 or 8920; check that your firewall allows LAN traffic on those ports |
| Login fails with 401 | Double-check username/password — Emby is case-sensitive for usernames |
| Poster images don't load | Verify your device can reach the server IP directly on the same subnet |
| Remote control does nothing | The target session's client must be open and connected to Emby; web browser sessions work best for testing |
| `prebuild` fails | Delete the `android/` folder and re-run `npx expo prebuild --platform android` |
| Gradle build fails | Confirm `ANDROID_HOME` is set and Android Studio SDK is installed; run `./gradlew clean` then retry |
| `adb` not found | Add `$ANDROID_HOME/platform-tools` to your `PATH` |
| EAS build fails | Run `eas diagnostics` for hints; ensure the `package` field in `app.json` is unique |
| Web build — slider missing | Apply the `Platform.OS === 'web'` seek slider shim described in the Web Build section |
| Web build — blank screen on SBC | Confirm the `emby-ui` systemd service is running: `systemctl status emby-ui` |
| Chromium won't go fullscreen | Ensure the `--kiosk` flag is present in the autostart `.desktop` entry |
| Touch not working on Linux | Confirm the touchscreen USB cable is connected; run `xinput list` to verify it appears as an input device |
| Screen blanks after idle | Apply the DPMS disable autostart entry described in the Web Build section |

---

## Extending the App

Some ideas for future additions:

- **WebSocket live updates** — Emby supports WebSocket connections for real-time session
  events instead of polling. Endpoint:
  `ws://server:8096/embywebsocket?api_key={token}&deviceId={id}`
- **Multi-user monitoring** — The session screen currently scopes to the logged-in user.
  An admin token could show all users simultaneously on one screen.
- **Volume control** — `POST /Sessions/{id}/Command/SetVolume` with an `Arguments` body
- **Subtitle / audio track switching** — via `SetAudioStreamIndex` /
  `SetSubtitleStreamIndex` session commands
- **Push notifications** — Expo Notifications + a background task to alert when a
  specific user starts streaming
- **PIR motion wake (SBC builds)** — HC-SR501 sensor on a GPIO pin + a small Python
  script calling `xset dpms force on` to wake the screen when someone enters the room