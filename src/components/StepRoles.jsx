import React from "react";
import MultiSelect from "./MultiSelect.jsx";

export default function StepRoles({ roles, preselected, onComplete }) {
  if (roles.length === 0) {
    // No optional roles available, skip
    React.useEffect(() => {
      onComplete(preselected);
    }, []);
    return null;
  }

  const items = roles.map((r) => ({
    value: r.name,
    label: `${r.title || r.name}`,
    description: r.description || undefined,
    hints: r.enhances,
  }));

  return (
    <MultiSelect
      label="Add roles (optional — capabilities adapt gracefully):"
      items={items}
      preselected={preselected}
      onSubmit={onComplete}
    />
  );
}
