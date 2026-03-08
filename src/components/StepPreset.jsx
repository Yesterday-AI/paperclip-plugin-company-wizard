import React from "react";
import { Box, Text } from "ink";
import SelectInput from "ink-select-input";

export default function StepPreset({ presets, onComplete }) {
  const items = [
    ...presets.map((p) => ({
      key: p.name,
      label: `${p.name} — ${p.description || ""}`,
      value: p,
    })),
    {
      key: "custom",
      label: "custom — Pick modules manually",
      value: { name: "custom" },
    },
  ];

  return (
    <Box flexDirection="column">
      <Text bold>Select a preset:</Text>
      <Box marginTop={1}>
        <SelectInput
          items={items}
          onSelect={(item) => onComplete(item.value)}
        />
      </Box>
      {presets
        .filter((p) => p.constraints?.length)
        .map((p) => (
          <Text key={`constraint-${p.name}`} color="yellow">
            {"  "}
            {p.name}: {p.constraints[0]}
          </Text>
        ))}
    </Box>
  );
}
