import React, { useState } from "react";
import { Box, Text, useInput } from "ink";

/**
 * Multi-select component with pre-selection support.
 * Space toggles, Enter confirms.
 */
export default function MultiSelect({
  items,
  preselected = [],
  onSubmit,
  label,
}) {
  const [cursor, setCursor] = useState(0);
  const [selected, setSelected] = useState(new Set(preselected));

  useInput((input, key) => {
    if (key.upArrow) {
      setCursor((c) => (c > 0 ? c - 1 : items.length - 1));
    } else if (key.downArrow) {
      setCursor((c) => (c < items.length - 1 ? c + 1 : 0));
    } else if (input === " ") {
      const item = items[cursor];
      if (item) {
        setSelected((prev) => {
          const next = new Set(prev);
          if (next.has(item.value)) {
            // Don't allow deselecting pre-selected items
            if (!preselected.includes(item.value)) {
              next.delete(item.value);
            }
          } else {
            next.add(item.value);
          }
          return next;
        });
      }
    } else if (key.return) {
      onSubmit([...selected]);
    }
  });

  return (
    <Box flexDirection="column">
      {label ? <Text bold>{label}</Text> : null}
      <Text dimColor>  ↑↓ navigate · space toggle · enter confirm</Text>
      <Box marginTop={1} flexDirection="column">
        {items.map((item, i) => {
          const isSelected = selected.has(item.value);
          const isPreselected = preselected.includes(item.value);
          const isCursor = i === cursor;
          const marker = isSelected ? "◉" : "○";
          const prefix = isCursor ? "❯" : " ";

          return (
            <Box key={item.value} flexDirection="column">
              <Box>
                <Text color={isCursor ? "cyan" : undefined}>
                  {prefix} {marker} {item.label}
                </Text>
                {isPreselected ? (
                  <Text color="green"> [included]</Text>
                ) : null}
              </Box>
              {item.description ? (
                <Text dimColor>      {item.description}</Text>
              ) : null}
              {item.hints?.map((h, j) => (
                <Text key={j} color="cyan">
                  {"      + "}
                  {h}
                </Text>
              ))}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
