import { base64EncodeBytes, encodeUtf8 } from './encoding.js';

const SHARED_PASSWORD_KDF_SALT = encodeUtf8('shared-password:v1');
const SHARED_PASSWORD_KDF_ITERATIONS = 600_000;
const SHARED_PASSWORD_KDF_BITS = 256;

export function constantTimeEquals(a, b) {
  const left = a ?? '';
  const right = b ?? '';
  const len = Math.max(left.length, right.length);
  let result = left.length ^ right.length;
  for (let i = 0; i < len; i += 1) {
    const leftCode = left.charCodeAt(i) || 0;
    const rightCode = right.charCodeAt(i) || 0;
    result |= leftCode ^ rightCode;
  }
  return result === 0;
}

async function deriveSharedPasswordBits(password) {
  const keyMaterial = await crypto.subtle.importKey('raw', encodeUtf8(password ?? ''), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt: SHARED_PASSWORD_KDF_SALT,
      iterations: SHARED_PASSWORD_KDF_ITERATIONS
    },
    keyMaterial,
    SHARED_PASSWORD_KDF_BITS
  );
  return new Uint8Array(bits);
}

export async function hashSharedPassword(password) {
  const derivedBytes = await deriveSharedPasswordBits(password ?? '');
  return base64EncodeBytes(derivedBytes);
}

export async function verifySharedPassword(password, expectedHash) {
  if (!expectedHash) {
    throw new Error('expectedHash is required');
  }
  const computedHash = await hashSharedPassword(password ?? '');
  return constantTimeEquals(computedHash, expectedHash);
}
