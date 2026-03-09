import React, { useState } from "react";
import { Box, Text } from "ink";
import SelectInput from "ink-select-input";

export default function StepPreset({ presets, onComplete }) {
  const [highlighted, setHighlighted] = useState(presets[0] || null);
  const maxLen = Math.max(...presets.map((p) => p.name.length), "custom".length);
  const items = [
    ...presets.map((p) => ({
      key: p.name,
      label: p.name.padEnd(maxLen),
      value: p,
    })),
    {
      key: "custom",
      label: "custom".padEnd(maxLen),
      value: { name: "custom", description: "Pick modules manually" },
    },
  ];

  // Short one-liner for the list row
  const shortDesc = (desc) => {
    if (!desc) return "";
    const dot = desc.indexOf(". ");
    return dot > 0 ? desc.slice(0, dot + 1) : desc;
  };

  const detail = highlighted?.description || "";
  const constraints = highlighted?.constraints || [];

  return (
    <Box flexDirection="column">
      <Box>
        <Text color="cyan" bold>? </Text>
        <Text bold>Select a preset</Text>
      </Box>
      <Box marginLeft={2} marginTop={1} flexDirection="column">
        <SelectInput
          items={items}
          onSelect={(item) => onComplete(item.value)}
          onHighlight={(item) => setHighlighted(item.value)}
          itemComponent={({ isSelected, label, value }) => {
            const name = value?.name || label?.trim() || "";
            const desc = shortDesc(value?.description);
            return (
              <Text color={isSelected ? "cyan" : undefined} bold={isSelected}>
                {name.padEnd(maxLen + 2)}
                <Text dimColor>{desc}</Text>
              </Text>
            );
          }}
        />
      </Box>
      {detail ? (
        <Box marginLeft={2} marginTop={1}>
          <Text dimColor>{detail}</Text>
        </Box>
      ) : null}
      {constraints.length > 0 ? (
        <Box marginLeft={2} marginTop={1} flexDirection="column">
          {constraints.map((c, i) => (
            <Text key={i} color="yellow">! {c}</Text>
          ))}
        </Box>
      ) : null}
    </Box>
  );
}
