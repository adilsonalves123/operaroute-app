/** Helpers de endpoint FCM — seguros para client e server. */

export function fcmEndpointFromToken(token: string): string {
  return `fcm://${token}`;
}

export function tokenFromFcmEndpoint(endpoint: string): string | null {
  if (!endpoint.startsWith("fcm://")) return null;
  const token = endpoint.slice("fcm://".length).trim();
  return token || null;
}

export function isFcmEndpoint(endpoint: string): boolean {
  return endpoint.startsWith("fcm://");
}
