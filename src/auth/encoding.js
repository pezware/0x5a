const textEncoder = new TextEncoder();

function hasBuffer() {
  return typeof Buffer !== 'undefined';
}

function bytesToBinary(bytes) {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return binary;
}

function base64Encode(bytes) {
  if (hasBuffer()) {
    return Buffer.from(bytes).toString('base64');
  }
  if (typeof btoa === 'function') {
    return btoa(bytesToBinary(bytes));
  }
  throw new Error('No base64 encoder available in this runtime');
}

function base64UrlFromBase64(base64) {
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function base64UrlEncode(bytes) {
  return base64UrlFromBase64(base64Encode(bytes));
}

export function base64UrlEncodeString(value) {
  return base64UrlEncode(encodeUtf8(value));
}

export function encodeUtf8(value) {
  return textEncoder.encode(value);
}

export function base64EncodeBytes(bytes) {
  return base64Encode(bytes);
}
