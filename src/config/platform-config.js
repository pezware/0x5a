import fs from 'node:fs/promises';
import path from 'node:path';

const DEFAULT_CONFIG_PATH = path.resolve('config/platform.json');
const EXAMPLE_CONFIG_PATH = path.resolve('config/platform.example.json');
const MODULE_KEYS = ['auction', 'volunteer', 'campaigns', 'donations', 'events', 'contacts'];
const INTEGRATION_KEYS = ['email', 'payments', 'storage', 'analytics'];
const SUPPORTED_SCHEMA_VERSIONS = new Set([1]);

const moduleDefaults = {
  auction: { enabled: false, enableBuyNow: false, minimumBidIncrement: 5 },
  volunteer: { enabled: false, requireDeviceTrust: false },
  campaigns: { enabled: false, enableResendSync: false },
  donations: { enabled: false, paymentMethods: [] },
  events: { enabled: false, allowSelfEnrollment: false },
  contacts: { enabled: false, defaultGroups: [] }
};

function requireObject(value, label) {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value;
}

function clonePlainObject(value, label) {
  if (value === undefined) {
    return undefined;
  }
  requireObject(value, label);
  return { ...value };
}

function normalizeBranding(rawBranding = {}) {
  requireObject(rawBranding, 'branding');
  const { name, shortName, primaryColor, secondaryColor, logo, darkModeDefault = false } = rawBranding;
  if (!name || !shortName || !primaryColor || !secondaryColor) {
    throw new Error('branding is missing required fields (name, shortName, primaryColor, secondaryColor)');
  }
  return { name, shortName, primaryColor, secondaryColor, logo: logo ?? '', darkModeDefault: Boolean(darkModeDefault) };
}

function normalizeModules(rawModules = {}) {
  const normalized = {};
  for (const key of MODULE_KEYS) {
    const incoming = rawModules[key];
    if (incoming !== undefined && (typeof incoming !== 'object' || incoming === null || Array.isArray(incoming))) {
      throw new Error(`module '${key}' must be an object`);
    }
    normalized[key] = {
      ...moduleDefaults[key],
      ...(typeof incoming === 'object' && incoming !== null ? incoming : {})
    };
    normalized[key].enabled = Boolean(normalized[key].enabled);
  }
  return normalized;
}

function normalizeTenants(rawTenants = [], modules) {
  if (!Array.isArray(rawTenants)) {
    throw new Error('tenants must be an array');
  }
  return rawTenants.map((tenant) => {
    requireObject(tenant, 'tenant');
    if (!tenant.id) {
      throw new Error('every tenant requires an id');
    }
    return {
      id: String(tenant.id),
      name: tenant.name ? String(tenant.name) : String(tenant.id),
      locale: tenant.locale ?? 'en-US',
      timeZone: tenant.timeZone ?? 'UTC',
      currency: tenant.currency ?? 'USD',
      modules: tenant.modules ? normalizeModules({ ...modules, ...tenant.modules }) : modules,
      brandingOverrides: clonePlainObject(tenant.brandingOverrides, `brandingOverrides for tenant ${tenant.id}`) ?? {}
    };
  });
}

function normalizeIntegrations(rawIntegrations = {}) {
  if (typeof rawIntegrations !== 'object' || rawIntegrations === null || Array.isArray(rawIntegrations)) {
    throw new Error('integrations must be an object');
  }
  const normalized = {};
  for (const key of INTEGRATION_KEYS) {
    const incoming = rawIntegrations[key];
    if (incoming === undefined) {
      continue;
    }
    if (typeof incoming !== 'object' || incoming === null || Array.isArray(incoming)) {
      throw new Error(`integration '${key}' must be an object`);
    }
    normalized[key] = { ...incoming };
  }
  return normalized;
}

function normalizeAuth(rawAuth) {
  if (rawAuth === undefined) {
    throw new Error('auth block is required');
  }
  requireObject(rawAuth, 'auth');
  const {
    issuer,
    audience,
    sharedPasswordLabel,
    sharedPasswordHash,
    tokenTTLSeconds = 3600
  } = rawAuth;
  if (!issuer || !audience || !sharedPasswordLabel || !sharedPasswordHash) {
    throw new Error('auth block requires issuer, audience, sharedPasswordLabel, and sharedPasswordHash');
  }
  const ttl = Number(tokenTTLSeconds);
  if (!Number.isInteger(ttl) || ttl <= 0) {
    throw new Error('auth.tokenTTLSeconds must be a positive integer');
  }
  return {
    issuer: String(issuer),
    audience: String(audience),
    sharedPasswordLabel: String(sharedPasswordLabel),
    sharedPasswordHash: String(sharedPasswordHash),
    tokenTTLSeconds: ttl
  };
}

function normalizeRoles(rawRoles = {}) {
  if (typeof rawRoles !== 'object' || rawRoles === null) {
    throw new Error('roles must be an object mapping role names to permission arrays');
  }
  const roles = {};
  for (const [role, permissions] of Object.entries(rawRoles)) {
    if (!Array.isArray(permissions)) {
      throw new Error(`role ${role} must be an array of permission strings`);
    }
    roles[role] = permissions.map((perm) => String(perm));
  }
  return roles;
}

export function parsePlatformConfig(rawConfig) {
  requireObject(rawConfig, 'platform config');
  const schemaVersion = Number(rawConfig.schemaVersion ?? 1);
  if (!Number.isInteger(schemaVersion) || schemaVersion < 1) {
    throw new Error('schemaVersion must be a positive integer');
  }
  if (!SUPPORTED_SCHEMA_VERSIONS.has(schemaVersion)) {
    throw new Error(`schemaVersion ${schemaVersion} is not supported by this runtime`);
  }
  const branding = normalizeBranding(rawConfig.branding);
  const modules = normalizeModules(rawConfig.modules);
  const tenants = normalizeTenants(rawConfig.tenants ?? [], modules);
  const integrations = normalizeIntegrations(rawConfig.integrations ?? {});
  const auth = normalizeAuth(rawConfig.auth);
  const roles = normalizeRoles(rawConfig.roles ?? { Admin: ['*'] });

  return {
    schemaVersion,
    branding,
    modules,
    tenants,
    integrations,
    auth,
    roles
  };
}

async function readJsonIfExists(candidatePath) {
  try {
    const payload = await fs.readFile(candidatePath, 'utf8');
    return JSON.parse(payload);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

export async function loadPlatformConfig({ configPath = DEFAULT_CONFIG_PATH, fallbackPath = EXAMPLE_CONFIG_PATH } = {}) {
  const raw = (await readJsonIfExists(configPath)) ?? (await readJsonIfExists(fallbackPath));
  if (!raw) {
    throw new Error(`No platform config found. Expected ${configPath} or ${fallbackPath}`);
  }
  return parsePlatformConfig(raw);
}

export const defaults = {
  moduleDefaults,
  defaultConfigPath: DEFAULT_CONFIG_PATH,
  exampleConfigPath: EXAMPLE_CONFIG_PATH
};
