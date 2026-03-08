import React from "react";
import { Box, Text } from "ink";

export default function Header() {
  return (
    <Box
      borderStyle="round"
      borderColor="magenta"
      paddingX={2}
      marginBottom={1}
    >
      <Text bold>Clipper</Text>
    </Box>
  );
}
