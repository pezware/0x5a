import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parsePlatformConfig } from '../src/config/platform-config.js';
import { createBrandingRuntime } from '../src/brand/branding-runtime.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const exampleConfigPath = path.resolve(__dirname, '../config/platform.example.json');
const parsed = parsePlatformConfig(JSON.parse(fs.readFileSync(exampleConfigPath, 'utf8')));

test('branding runtime exposes default theme tokens', () => {
  const runtime = createBrandingRuntime(parsed);
  const tokens = runtime.getThemeTokens();
  // default tenant overrides dark mode
  assert.equal(tokens.theme, 'dark');
  assert.equal(tokens.primaryColor, '#0F172A');
});

test('setActiveTenant switches theme and preserves overrides', () => {
  const runtime = createBrandingRuntime(parsed, { tenantId: 'default' });
  const tokensBefore = runtime.getThemeTokens();
  assert.equal(tokensBefore.theme, 'dark');
  runtime.setActiveTenant('default');
  const classNames = runtime.getThemeClassNames(['base']);
  assert.ok(classNames.includes('theme-dark'));
});

test('unknown tenant throws helpful error', () => {
  const runtime = createBrandingRuntime(parsed);
  assert.throws(() => runtime.setActiveTenant('missing'), /Unknown tenant/);
});
