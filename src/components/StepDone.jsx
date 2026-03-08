import React from "react";
import { Box, Text } from "ink";
import { formatRoleName } from "../logic/resolve.js";

export default function StepDone({
  companyDir,
  allRoles,
  provisioned,
  companyId,
}) {
  const rolesList = [...allRoles];

  return (
    <Box flexDirection="column" gap={1}>
      <Text color="green" bold>
        Done!
      </Text>

      {provisioned ? (
        <Box flexDirection="column">
          <Text bold>Company provisioned via API:</Text>
          <Text dimColor>  ID: {companyId}</Text>
          <Text dimColor>  All agents created and initial tasks queued.</Text>
          <Text />
          <Text bold>Next:</Text>
          <Text>  1. Start the CEO heartbeat in the Paperclip UI</Text>
        </Box>
      ) : (
        <Box flexDirection="column">
          <Text bold>Next steps:</Text>
          <Text>  1. Create the company in the Paperclip UI</Text>
          {rolesList.map((role, i) => (
            <Box key={role} flexDirection="column">
              <Text>
                {"  "}
                {i + 2}. Create the <Text bold>{formatRoleName(role)}</Text>{" "}
                agent with:
              </Text>
              <Text dimColor>     cwd = {companyDir}</Text>
              <Text dimColor>
                {"     "}instructionsFilePath = agents/{role}/AGENTS.md
              </Text>
            </Box>
          ))}
        </Box>
      )}

      <Text dimColor>Workspace: {companyDir}</Text>
    </Box>
  );
}
