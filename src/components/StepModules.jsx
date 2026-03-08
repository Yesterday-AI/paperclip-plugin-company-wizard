import React from "react";
import MultiSelect from "./MultiSelect.jsx";

export default function StepModules({ modules, preselected, onComplete }) {
  const items = modules.map((m) => ({
    value: m.name,
    label: m.name,
    description: m.description || undefined,
  }));

  return (
    <MultiSelect
      label="Select modules:"
      items={items}
      preselected={preselected}
      onSubmit={onComplete}
    />
  );
}
