import React, { useMemo } from "react";
import MultiSelect from "./MultiSelect.jsx";
import {
  buildModuleDeps,
  expandModuleDeps,
  getBlockingDependents,
} from "../logic/resolve.js";

export default function StepModules({ modules, preselected, onComplete }) {
  const { requires, requiredBy } = useMemo(
    () => buildModuleDeps(modules),
    [modules]
  );

  const items = modules.map((m) => {
    const desc = m.description || "";
    const gated = m.activatesWithRoles?.length
      ? `Needs role: ${m.activatesWithRoles.join(" or ")}`
      : "";
    return {
      value: m.name,
      label: m.name,
      description: desc && gated ? `${desc} — ${gated}` : desc || gated || undefined,
    };
  });

  return (
    <MultiSelect
      label="Select modules:"
      items={items}
      preselected={preselected}
      onToggleOn={(value, selected) => {
        const { autoSelected } = expandModuleDeps([value], requires);
        // Filter to only deps not already selected
        const newDeps = autoSelected.filter((d) => !selected.has(d));
        return {
          alsoSelect: newDeps,
          hints: newDeps.map((d) => `${value} requires ${d}, auto-selected`),
        };
      }}
      onToggleOff={(value, selected) => {
        const blockers = getBlockingDependents(
          value,
          [...selected],
          requiredBy
        );
        if (blockers.length > 0) {
          return {
            blocked: true,
            hint: `Cannot deselect: required by ${blockers.join(", ")}`,
          };
        }
        return { blocked: false };
      }}
      onSubmit={onComplete}
    />
  );
}
