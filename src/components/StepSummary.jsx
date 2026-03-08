import React from "react";
import { Box, Text, useInput } from "ink";

export default function StepSummary({
  companyName,
  baseName,
  moduleNames,
  roleNames,
  capabilities,
  outputDir,
  apiEnabled,
  onConfirm,
  onCancel,
}) {
  useInput((input, key) => {
    if (key.return || input === "y" || input === "Y") {
      onConfirm();
    } else if (input === "n" || input === "N") {
      onCancel();
    }
  });

  const allRoleNames = ["ceo", "engineer", ...roleNames];

  return (
    <Box flexDirection="column" gap={1}>
      {capabilities.length > 0 ? (
        <Box flexDirection="column">
          <Text bold>Capability resolution:</Text>
          {capabilities.map((cap) => (
            <Text key={cap.skill}>
              {"  "}
              <Text color="cyan">{cap.skill}</Text>
              {": "}
              <Text bold>{cap.primary}</Text>
              {cap.fallbacks.length > 0 ? (
                <Text dimColor> (fallback: {cap.fallbacks.join(", ")})</Text>
              ) : null}
            </Text>
          ))}
        </Box>
      ) : null}

      <Box flexDirection="column">
        <Text bold>Summary:</Text>
        <Text>
          {"  Company:  "}
          <Text color="cyan">{companyName}</Text>
        </Text>
        <Text>
          {"  Base:     "}
          <Text color="cyan">{baseName}</Text>
        </Text>
        <Text>
          {"  Modules:  "}
          {moduleNames.length > 0 ? (
            moduleNames.map((m, i) => (
              <Text key={m}>
                {i > 0 ? ", " : ""}
                <Text color="cyan">{m}</Text>
              </Text>
            ))
          ) : (
            <Text dimColor>none</Text>
          )}
        </Text>
        <Text>
          {"  Roles:    "}
          {allRoleNames.map((r, i) => (
            <Text key={r}>
              {i > 0 ? ", " : ""}
              <Text color="cyan">{r}</Text>
            </Text>
          ))}
        </Text>
        <Text>
          {"  Output:   "}
          <Text dimColor>{outputDir}</Text>
        </Text>
        {apiEnabled ? (
          <Text>
            {"  API:      "}
            <Text color="green">enabled</Text>
          </Text>
        ) : null}
      </Box>

      <Text bold>
        Create? <Text dimColor>[Y/n]</Text>
      </Text>
    </Box>
  );
}
