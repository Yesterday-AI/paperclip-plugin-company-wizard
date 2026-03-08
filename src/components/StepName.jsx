import React, { useState } from "react";
import { Box, Text } from "ink";
import TextInput from "ink-text-input";

export default function StepName({ onComplete }) {
  const [value, setValue] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (val) => {
    const trimmed = val.trim();
    if (!trimmed) {
      setError("Name is required");
      return;
    }
    if (!/^[a-zA-Z][a-zA-Z0-9 _-]*$/.test(trimmed)) {
      setError("Use letters, numbers, spaces, hyphens, or underscores");
      return;
    }
    onComplete(trimmed);
  };

  return (
    <Box flexDirection="column">
      <Box>
        <Text bold>Company name: </Text>
        <TextInput
          value={value}
          onChange={(v) => {
            setValue(v);
            setError("");
          }}
          onSubmit={handleSubmit}
        />
      </Box>
      {error ? (
        <Text color="red">  {error}</Text>
      ) : null}
    </Box>
  );
}
