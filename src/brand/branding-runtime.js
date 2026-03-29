function mergeBranding(baseBranding, overrides = {}) {
  return {
    ...baseBranding,
    ...overrides,
    darkModeDefault: overrides.darkModeDefault ?? baseBranding.darkModeDefault
  };
}

export function createBrandingRuntime(config, { tenantId } = {}) {
  const tenants = config.tenants ?? [];
  let activeTenant = tenants.find((tenant) => tenant.id === tenantId) ?? tenants[0] ?? null;

  function getBranding() {
    return mergeBranding(config.branding, activeTenant?.brandingOverrides);
  }

  function getThemeTokens() {
    const branding = getBranding();
    return {
      primaryColor: branding.primaryColor,
      secondaryColor: branding.secondaryColor,
      logo: branding.logo,
      theme: branding.darkModeDefault ? 'dark' : 'light'
    };
  }

  function setActiveTenant(nextTenantId) {
    const match = tenants.find((tenant) => tenant.id === nextTenantId);
    if (!match) {
      throw new Error(`Unknown tenant: ${nextTenantId}`);
    }
    activeTenant = match;
    return getBranding();
  }

  function getActiveTenant() {
    return activeTenant;
  }

  function getThemeClassNames(base = []) {
    const tokens = getThemeTokens();
    return Array.from(new Set([...base, tokens.theme === 'dark' ? 'theme-dark' : 'theme-light']));
  }

  return {
    getBranding,
    getThemeTokens,
    getThemeClassNames,
    getActiveTenant,
    setActiveTenant
  };
}
