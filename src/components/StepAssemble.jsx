import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import { assembleCompany } from '../logic/assemble.js';

export default function StepAssemble({
  companyName,
  goal,
  project,
  moduleNames,
  extraRoleNames,
  goals,
  outputDir,
  templatesDir,
  onComplete,
  onError,
}) {
  const [log, setLog] = useState([]);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;

    assembleCompany({
      companyName,
      goal,
      project,
      moduleNames,
      extraRoleNames,
      goals,
      outputDir,
      templatesDir,
      onProgress: (line) => {
        if (!cancelled) {
          setLog((prev) => [...prev, line]);
        }
      },
    })
      .then((result) => {
        if (!cancelled) {
          setDone(true);
          onComplete(result);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          onError(err.message);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Box flexDirection="column">
      <Box>
        {done ? (
          <Text color="green">✓ </Text>
        ) : (
          <Text color="cyan">
            <Spinner type="dots" />{' '}
          </Text>
        )}
        <Text bold>{done ? 'Workspace assembled' : 'Assembling workspace...'}</Text>
      </Box>
      <Box flexDirection="column" marginLeft={2}>
        {log.map((line, i) => {
          const isAdd = line.startsWith('+');
          const isSkip = line.startsWith('○') || line.startsWith('!');
          return (
            <Text key={i} color={isAdd ? 'green' : isSkip ? 'yellow' : undefined} dimColor={isSkip}>
              {line}
            </Text>
          );
        })}
      </Box>
    </Box>
  );
}
