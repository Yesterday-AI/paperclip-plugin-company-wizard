/**
 * Resolve capability ownership based on present roles.
 * Returns structured data for display and assembly.
 */
export function resolveCapabilities(modules, selectedModules, allRoles) {
  const resolved = [];
  for (const mod of modules) {
    if (!selectedModules.includes(mod.name) || !mod.capabilities?.length)
      continue;
    for (const cap of mod.capabilities) {
      const primaryOwner = cap.owners.find((r) => allRoles.has(r));
      const fallbacks = cap.owners.filter(
        (r) => r !== primaryOwner && allRoles.has(r)
      );
      if (primaryOwner) {
        resolved.push({
          skill: cap.skill,
          module: mod.name,
          primary: primaryOwner,
          fallbacks,
        });
      }
    }
  }
  return resolved;
}

/**
 * Build the full set of roles from base + extra.
 */
export function buildAllRoles(baseRoles, extraRoleNames) {
  const allRoles = new Set(baseRoles);
  for (const role of extraRoleNames) allRoles.add(role);
  return allRoles;
}

/**
 * Pretty-print a role name: "product-owner" → "Product Owner"
 */
export function formatRoleName(role) {
  return role
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
