/**
 * Central endpoint configuration for the mobile app.
 *
 * Expo inlines EXPO_PUBLIC_* variables at bundle time from apps/mobile/.env
 * (copy .env.example). Nothing is hardcoded so the same build can point at a
 * LAN dev server or production by changing the env file.
 */

const rawBaseUrl = process.env.EXPO_PUBLIC_VPN_API_URL;

if (!rawBaseUrl) {
  throw new Error(
    "EXPO_PUBLIC_VPN_API_URL is not set. " +
      "Copy apps/mobile/.env.example to apps/mobile/.env and set the web app " +
      "base URL, e.g. EXPO_PUBLIC_VPN_API_URL=http://192.168.1.10:3000",
  );
}

/** Web app base URL, no trailing slash. */
export const VPN_API_URL = rawBaseUrl.replace(/\/$/, "");

/** Web app endpoint used to create a VPN peer. */
export const VPN_PEER_CREATE_URL = `${VPN_API_URL}/api/vpn/peer/create`;
