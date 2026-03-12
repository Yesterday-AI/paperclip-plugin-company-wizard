import React from 'react';
import { Box, Text, useInput } from 'ink';
import { formatRoleName } from '../logic/resolve.js';

export default function StepSummary({
  companyName,
  goal,
  project,
  presetName,
  moduleNames,
  roleNames,
  modules,
  capabilities,
  outputDir,
  apiEnabled,
  dryRun,
  onConfirm,
  onCancel,
}) {
  useInput((input, key) => {
    if (key.return || input === 'y' || input === 'Y') {
      onConfirm();
    } else if (input === 'n' || input === 'N') {
      onCancel();
    }
  });

  const allRoleNames = ['ceo', 'engineer', ...roleNames];
  const allRolesSet = new Set(allRoleNames);

  // Find modules that will be skipped due to missing activatesWithRoles
  const skippedModules = (modules || [])
    .filter(
      (m) =>
        moduleNames.includes(m.name) &&
        m.activatesWithRoles?.length &&
        !m.activatesWithRoles.some((r) => allRolesSet.has(r)),
    )
    .map((m) => ({
      name: m.name,
      needs: m.activatesWithRoles,
    }));

  return (
    <Box flexDirection="column" gap={1}>
      <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={2} paddingY={1}>
        <Text bold color="cyan">
          Summary
        </Text>
        <Text> </Text>
        <Row label="Company" value={companyName} />
        {goal?.title ? <Row label="Goal" value={goal.title} /> : null}
        {goal?.description ? <Row label="" value={goal.description} dim /> : null}
        {project?.name ? <Row label="Project" value={project.name} /> : null}
        {project?.repoUrl ? <Row label="Repo" value={project.repoUrl} dim /> : null}
        <Row label="Preset" value={presetName || 'custom'} />
        <Row label="Modules" value={moduleNames.length > 0 ? moduleNames.join(', ') : 'none'} />
        <Row label="Roles" value={allRoleNames.map((r) => formatRoleName(r)).join(', ')} />
        <Row label="Output" value={outputDir} dim />
        {apiEnabled ? <Row label="API" value="enabled" color="green" /> : null}
      </Box>

      {capabilities.length > 0 ? (
        <Box flexDirection="column" marginLeft={1}>
          <Text dimColor>Capability resolution:</Text>
          {capabilities.map((cap) => (
            <Text key={cap.skill} dimColor>
              {'  '}
              {cap.skill} {'->'} <Text color="cyan">{cap.primary}</Text>
              {cap.fallbacks.length > 0 ? (
                <Text dimColor> (fallback: {cap.fallbacks.join(', ')})</Text>
              ) : null}
            </Text>
          ))}
        </Box>
      ) : null}

      {skippedModules.length > 0 ? (
        <Box marginLeft={1} flexDirection="column">
          {skippedModules.map((m) => (
            <Text key={m.name} color="yellow">
              ! {m.name} will be skipped (needs {m.needs.join(' or ')})
            </Text>
          ))}
        </Box>
      ) : null}

      {dryRun ? (
        <Box marginLeft={1}>
          <Text dimColor>Dry run — press enter to exit, no files will be written.</Text>
        </Box>
      ) : (
        <Box marginLeft={1}>
          <Text bold>Create? </Text>
          <Text dimColor>y/n</Text>
        </Box>
      )}
    </Box>
  );
}

function Row({ label, value, dim, color }) {
  return (
    <Box>
      {label ? <Text dimColor>{label.padEnd(10)}</Text> : <Text>{'          '}</Text>}
      <Text color={color || (dim ? undefined : 'white')} dimColor={dim}>
        {value}
      </Text>
    </Box>
  );
}
