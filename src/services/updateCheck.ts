import Constants from 'expo-constants';
import { File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

const GITHUB_REPO = 'Kenttleton/emby-kiosk';
const RELEASES_URL = `https://api.github.com/repos/${GITHUB_REPO}/releases?per_page=1`;

export interface UpdateInfo {
  version: string;         // e.g. "0.2.0"
  releaseUrl: string;      // GitHub release page
  apkUrl: string | null;   // direct APK download URL (Android)
  ipaUrl: string | null;   // direct IPA download URL (iOS)
  releaseNotes: string | null;
}

function parseVersion(v: string): number[] {
  return v.replace(/^v/, '').split('.').map(Number);
}

function isNewer(remote: string, local: string): boolean {
  const r = parseVersion(remote);
  const l = parseVersion(local);
  for (let i = 0; i < 3; i++) {
    if ((r[i] ?? 0) > (l[i] ?? 0)) return true;
    if ((r[i] ?? 0) < (l[i] ?? 0)) return false;
  }
  return false;
}

export async function checkForUpdate(): Promise<UpdateInfo | null> {
  try {
    const res = await fetch(RELEASES_URL, {
      headers: { Accept: 'application/vnd.github+json' },
    });
    if (!res.ok) return null;

    const releases = await res.json();
    const data = releases[0];
    if (!data) return null;
    const remoteVersion: string = data.tag_name ?? '';
    const localVersion: string = Constants.expoConfig?.version ?? '0.0.0';

    if (!isNewer(remoteVersion, localVersion)) return null;

    const assets: { name: string; browser_download_url: string }[] = data.assets ?? [];
    const apkAsset = assets.find((a) => a.name.endsWith('.apk'));
    const ipaAsset = assets.find((a) => a.name.endsWith('.ipa'));

    return {
      version: remoteVersion.replace(/^v/, ''),
      releaseUrl: data.html_url ?? `https://github.com/${GITHUB_REPO}/releases/latest`,
      apkUrl: apkAsset?.browser_download_url ?? null,
      ipaUrl: ipaAsset?.browser_download_url ?? null,
      releaseNotes: data.body ?? null,
    };
  } catch {
    return null;
  }
}

export async function downloadAndInstallApk(
  apkUrl: string,
  onProgress: (progress: number) => void,
): Promise<void> {
  const destFile = new File(Paths.cache, 'emby-kiosk-update.apk');

  if (destFile.exists) destFile.delete();

  // Stream download so we can report progress
  const response = await fetch(apkUrl);
  const contentLength = Number(response.headers.get('content-length') ?? 0);
  const reader = response.body?.getReader();

  if (!reader) {
    await File.downloadFileAsync(apkUrl, destFile, { idempotent: true });
  } else {
    const chunks: Uint8Array[] = [];
    let received = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      received += value.length;
      if (contentLength > 0) onProgress(received / contentLength);
    }
    const combined = new Uint8Array(received);
    let offset = 0;
    for (const chunk of chunks) { combined.set(chunk, offset); offset += chunk.length; }
    destFile.write(combined);
  }

  if (Platform.OS === 'android') {
    const { startActivityAsync } = await import('expo-intent-launcher');
    await startActivityAsync('android.intent.action.VIEW', {
      data: destFile.contentUri,
      flags: 1,   // FLAG_GRANT_READ_URI_PERMISSION
      type: 'application/vnd.android.package-archive',
    });
  }
}
