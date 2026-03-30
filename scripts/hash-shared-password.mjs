#!/usr/bin/env node

import { hashSharedPassword } from '../src/auth/password-utils.js';

async function readPasswordArg() {
  const [, , arg] = process.argv;
  if (arg) {
    return arg;
  }
  return new Promise((resolve, reject) => {
    if (process.stdin.isTTY) {
      reject(new Error('Usage: node scripts/hash-shared-password.mjs "<password>"'));
      return;
    }
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => {
      data += chunk;
    });
    process.stdin.on('end', () => resolve(data.trim()));
    process.stdin.on('error', reject);
  });
}

async function main() {
  try {
    const password = await readPasswordArg();
    if (!password) {
      throw new Error('Password is required (pass as an argument or via stdin).');
    }
    const hash = await hashSharedPassword(password);
    console.log(hash);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

await main();
