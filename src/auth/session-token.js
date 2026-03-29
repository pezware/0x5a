import { base64UrlEncodeString, base64UrlEncode, encodeUtf8 } from './encoding.js';

const SIGNING_ALGORITHM = { name: 'HMAC', hash: 'SHA-256' };

async function sign(input, secret) {
  const key = await crypto.subtle.importKey('raw', encodeUtf8(secret), SIGNING_ALGORITHM, false, ['sign']);
  const signature = await crypto.subtle.sign(SIGNING_ALGORITHM.name, key, encodeUtf8(input));
  return base64UrlEncode(new Uint8Array(signature));
}

export async function createSessionToken(claims, { secret, issuer, audience, ttlSeconds }, options = {}) {
  if (!secret) {
    throw new Error('session secret required');
  }
  const issuedAtMs = typeof options.now === 'number' ? options.now : Date.now();
  const issuedAt = Math.floor(issuedAtMs / 1000);
  const expiresAt = issuedAt + ttlSeconds;
  const header = { alg: 'HS256', typ: 'JWT' };
  const payload = {
    ...claims,
    iss: issuer,
    aud: audience,
    iat: issuedAt,
    exp: expiresAt
  };
  const encodedHeader = base64UrlEncodeString(JSON.stringify(header));
  const encodedPayload = base64UrlEncodeString(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signature = await sign(signingInput, secret);
  return {
    token: `${signingInput}.${signature}`,
    expiresAt
  };
}
