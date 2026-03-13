import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import SelectInput from 'ink-select-input';

export default function StepGoalTemplates({ goalTemplates, onComplete }) {
  const [highlighted, setHighlighted] = useState(null);
  const skip = goalTemplates.length === 0;

  useEffect(() => {
    if (skip) onComplete(null);
  }, [skip, onComplete]);

  if (skip) return null;

  const items = [
    {
      key: '__skip__',
      label: 'Skip',
      value: null,
    },
    ...goalTemplates.map((g) => ({
      key: g.name,
      label: g.title,
      value: g,
    })),
  ];

  const detail = highlighted?.description || '';
  const issueCount = highlighted?.issues?.length || 0;
  const milestoneCount = highlighted?.milestones?.length || 0;

  return (
    <Box flexDirection="column">
      <Box>
        <Text color="cyan" bold>
          ?{' '}
        </Text>
        <Text bold>Choose a starter goal (optional)</Text>
      </Box>
      <Box marginLeft={2} marginTop={1} flexDirection="column">
        <SelectInput
          items={items}
          onSelect={(item) => onComplete(item.value)}
          onHighlight={(item) => setHighlighted(item.value)}
          itemComponent={({ isSelected, label }) => (
            <Text color={isSelected ? 'cyan' : undefined} bold={isSelected}>
              {label}
            </Text>
          )}
        />
      </Box>
      {detail ? (
        <Box marginLeft={2} marginTop={1} flexDirection="column">
          <Text dimColor>{detail}</Text>
          {milestoneCount > 0 || issueCount > 0 ? (
            <Text dimColor>
              {milestoneCount > 0 ? `${milestoneCount} milestones` : ''}
              {milestoneCount > 0 && issueCount > 0 ? ', ' : ''}
              {issueCount > 0 ? `${issueCount} starter issues` : ''}
            </Text>
          ) : null}
        </Box>
      ) : null}
    </Box>
  );
}
