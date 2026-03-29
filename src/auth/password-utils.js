import { base64EncodeBytes, encodeUtf8 } from './encoding.js';

const HASH_ALGORITHM = 'SHA-256';

function constantTimeEquals(a, b) {
  if (a.length !== b.length) {
    return false;
  }
  let result = 0;
  for (let i = 0; i < a.length; i += 1) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

export async function hashSharedPassword(password) {
  const data = encodeUtf8(password ?? '');
  const digest = await crypto.subtle.digest(HASH_ALGORITHM, data);
  return base64EncodeBytes(new Uint8Array(digest));
}

export async function verifySharedPassword(password, expectedHash) {
  if (!expectedHash) {
    throw new Error('expectedHash is required');
  }
  const computedHash = await hashSharedPassword(password ?? '');
  return constantTimeEquals(computedHash, expectedHash);
}
