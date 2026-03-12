import React, { useState } from 'react';
import { Box, Text } from 'ink';
import TextInput from 'ink-text-input';

export default function StepProject({ defaultName, onComplete }) {
  const [phase, setPhase] = useState('name'); // name → description → repo
  const [name, setName] = useState(defaultName);
  const [description, setDescription] = useState('');
  const [repoUrl, setRepoUrl] = useState('');

  const handleNameSubmit = (val) => {
    const trimmed = val.trim() || defaultName;
    setName(trimmed);
    setPhase('description');
  };

  const handleDescriptionSubmit = (val) => {
    setDescription(val.trim());
    setPhase('repo');
  };

  const handleRepoSubmit = (val) => {
    onComplete({
      name,
      description: description || null,
      repoUrl: val.trim() || null,
    });
  };

  return (
    <Box flexDirection="column">
      {phase === 'name' ? (
        <Box flexDirection="column">
          <Box>
            <Text color="cyan" bold>
              ?{' '}
            </Text>
            <Text bold>Project name </Text>
            <TextInput value={name} onChange={setName} onSubmit={handleNameSubmit} />
          </Box>
          <Text dimColor> Press enter for "{defaultName}"</Text>
        </Box>
      ) : phase === 'description' ? (
        <Box flexDirection="column">
          <Text dimColor> Project: {name}</Text>
          <Box>
            <Text color="cyan" bold>
              ?{' '}
            </Text>
            <Text bold>Project description </Text>
            <TextInput
              value={description}
              onChange={setDescription}
              onSubmit={handleDescriptionSubmit}
            />
          </Box>
          <Text dimColor> Optional. Press enter to skip.</Text>
        </Box>
      ) : (
        <Box flexDirection="column">
          <Text dimColor> Project: {name}</Text>
          {description ? <Text dimColor> {description}</Text> : null}
          <Box>
            <Text color="cyan" bold>
              ?{' '}
            </Text>
            <Text bold>GitHub repo URL </Text>
            <TextInput value={repoUrl} onChange={setRepoUrl} onSubmit={handleRepoSubmit} />
          </Box>
          <Text dimColor> Optional. Press enter to skip.</Text>
        </Box>
      )}
    </Box>
  );
}
