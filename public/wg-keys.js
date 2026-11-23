// WireGuard keys for the wizard VPN step. Curve25519 (X25519) keys, base64 like `wg genkey` / `wg pubkey`.
// Preferred: WebCrypto in the browser (keys never leave it). WebCrypto exists only in secure contexts
// (https or localhost); when the app is opened over plain http on the LAN, ask the server instead.

const b64 = (u8) => btoa(String.fromCharCode(...u8));

export async function wgKeypair() {
  if (globalThis.crypto?.subtle) {
    try {
      const kp = await crypto.subtle.generateKey({ name: 'X25519' }, true, ['deriveBits']);
      const pubBytes = new Uint8Array(await crypto.subtle.exportKey('raw', kp.publicKey));
      const privDer = new Uint8Array(await crypto.subtle.exportKey('pkcs8', kp.privateKey));
      // the raw 32-byte key is the LAST 32 bytes of the PKCS#8 DER
      const privBytes = privDer.subarray(-32);
      return { priv: b64(privBytes), pub: b64(pubBytes) };
    } catch (e) {
      // fall through to server fallback if browser lacks X25519 support in WebCrypto
    }
  }

  const r = await fetch('/api/wg-keys', { method: 'POST', cache: 'no-store' });
  if (!r.ok) throw new Error('key generation failed');
  return await r.json();
}

export function wgPsk() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return b64(bytes);
}
