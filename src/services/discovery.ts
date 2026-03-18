/**
 * Emby Server Discovery
 *
 * Strategy (in order, run concurrently):
 *  1. Emby GDM — UDP broadcast to 255.255.255.255:7359
 *     Emby listens for "who is EmbyServer?" and replies with its address + id.
 *     Simple, Emby-specific, works on any LAN with broadcast.
 *
 *  2. SSDP M-SEARCH — UDP multicast to 239.255.255.250:1900
 *     Standard UPnP discovery. Emby responds with a LOCATION header pointing
 *     to its HTTP root. We then probe that URL to confirm and get the server id.
 *
 *  3. Subnet TCP scan — HTTP probe of every x.x.x.1-254 on ports 8096/8920.
 *     Fallback for networks where multicast/broadcast is blocked (e.g. managed
 *     switches, some Wi-Fi APs with client isolation).
 *
 * NOTE: The Android emulator runs on a virtual NIC (10.0.2.15) that is isolated
 * from the host's real LAN. UDP broadcast/multicast will not cross this boundary,
 * and the subnet scan targets the wrong /24. Use a real device for discovery testing.
 */

import UdpSocket from 'react-native-udp';
import * as Network from 'expo-network';
import { probeServer, scanSubnet } from './embyApi';
import { EmbyServer } from '../types/emby';

type DiscoveryCallback = (server: EmbyServer) => void;
type DoneCallback = () => void;

const GDM_PORT = 7359;
const GDM_ADDR = '255.255.255.255';
const GDM_MESSAGE = 'who is EmbyServer?';
const GDM_TIMEOUT_MS = 4000;

const SSDP_PORT = 1900;
const SSDP_ADDR = '239.255.255.250';
const SSDP_TIMEOUT_MS = 4000;
const SSDP_SEARCH = [
  'M-SEARCH * HTTP/1.1',
  `HOST: ${SSDP_ADDR}:${SSDP_PORT}`,
  'MAN: "ssdp:discover"',
  'MX: 3',
  'ST: urn:schemas-upnp-org:device:MediaServer:1',
  '',
  '',
].join('\r\n');

// ─── GDM Discovery ────────────────────────────────────────────────────────

function discoverViaGdm(
  onFound: (address: string, id: string, name: string) => void
): Promise<void> {
  return new Promise((resolve) => {
    let settled = false;
    const done = () => { if (!settled) { settled = true; resolve(); } };

    let socket: ReturnType<typeof UdpSocket.createSocket>;
    try {
      socket = UdpSocket.createSocket({ type: 'udp4', reusePort: true });
    } catch {
      done();
      return;
    }

    const timer = setTimeout(() => { socket.close(); done(); }, GDM_TIMEOUT_MS);

    socket.on('message', (msg: Buffer) => {
      // Response format (one header per line):
      //   HTTP/1.0 200 OK
      //   Server: Emby Server
      //   Address: http://192.168.1.10:8096
      //   Id: {uuid}
      const text = msg.toString();
      const addressMatch = text.match(/^Address:\s*(.+)$/mi);
      const idMatch = text.match(/^Id:\s*(.+)$/mi);
      const nameMatch = text.match(/^Server:\s*(.+)$/mi);
      if (addressMatch) {
        const address = addressMatch[1].trim().replace(/\/$/, '');
        const id = idMatch?.[1].trim() ?? address;
        const name = nameMatch?.[1].trim() ?? 'Emby Server';
        onFound(address, id, name);
      }
    });

    socket.on('error', () => {
      clearTimeout(timer);
      socket.close();
      done();
    });

    socket.bind(0, () => {
      try {
        socket.setBroadcast(true);
        const buf = Buffer.from(GDM_MESSAGE);
        socket.send(buf, 0, buf.length, GDM_PORT, GDM_ADDR, (error?: Error) => {
          if (error) { clearTimeout(timer); socket.close(); done(); }
        });
      } catch {
        clearTimeout(timer);
        socket.close();
        done();
      }
    });
  });
}

// ─── SSDP Discovery ───────────────────────────────────────────────────────

function discoverViaSsdp(
  onFound: (locationUrl: string) => void
): Promise<void> {
  return new Promise((resolve) => {
    let settled = false;
    const done = () => { if (!settled) { settled = true; resolve(); } };

    let socket: ReturnType<typeof UdpSocket.createSocket>;
    try {
      socket = UdpSocket.createSocket({ type: 'udp4', reusePort: true });
    } catch {
      done();
      return;
    }

    const timer = setTimeout(() => { socket.close(); done(); }, SSDP_TIMEOUT_MS);

    socket.on('message', (msg: Buffer) => {
      const text = msg.toString();
      const locationMatch = text.match(/^LOCATION:\s*(.+)$/mi);
      if (locationMatch) {
        onFound(locationMatch[1].trim());
      }
    });

    socket.on('error', () => {
      clearTimeout(timer);
      socket.close();
      done();
    });

    socket.bind(0, () => {
      try {
        socket.addMembership(SSDP_ADDR);
        const buf = Buffer.from(SSDP_SEARCH);
        socket.send(buf, 0, buf.length, SSDP_PORT, SSDP_ADDR, (error?: Error) => {
          if (error) { clearTimeout(timer); socket.close(); done(); }
        });
      } catch {
        clearTimeout(timer);
        socket.close();
        done();
      }
    });
  });
}

// ─── Main Discovery ───────────────────────────────────────────────────────

export async function discoverServers(
  onFound: DiscoveryCallback,
  onDone: DoneCallback
): Promise<void> {
  const seen = new Set<string>();

  const report = (server: EmbyServer) => {
    if (!seen.has(server.id)) {
      seen.add(server.id);
      onFound(server);
    }
  };

  try {
    // Run GDM, SSDP, and subnet scan concurrently
    await Promise.all([

      // 1. GDM
      discoverViaGdm((address, id, name) => {
        report({ id, name, address, discovered: true });
      }),

      // 2. SSDP — probe the LOCATION URL to get the Emby server id/name
      discoverViaSsdp(async (locationUrl) => {
        try {
          // LOCATION points to the UPnP device description; derive base URL
          const url = new URL(locationUrl);
          const base = `${url.protocol}//${url.host}`;
          const info = await probeServer(base);
          report({ id: info.id, name: info.name, address: base, version: info.version, discovered: true });
        } catch { }
      }),

      // 3. Subnet scan fallback
      (async () => {
        try {
          const ip = await Network.getIpAddressAsync();
          if (!ip || ip === '0.0.0.0') return;
          await scanSubnet(ip, (address, name, id) => {
            report({ id, name, address, discovered: true });
          });
        } catch { }
      })(),

    ]);
  } catch (e) {
    console.warn('Discovery error:', e);
  } finally {
    onDone();
  }
}

// ─── Manual Entry ─────────────────────────────────────────────────────────

export async function probeManualServer(
  rawAddress: string
): Promise<EmbyServer> {
  let address = rawAddress.trim().replace(/\/$/, '');
  const urlObj = new URL(address);
  if (!urlObj.port) {
    address = address + ':8096';
  }

  const info = await probeServer(address);
  return {
    id: info.id,
    name: info.name,
    address,
    version: info.version,
    discovered: false,
  };
}
