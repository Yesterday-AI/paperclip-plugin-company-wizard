import React, { useState, useEffect } from 'react';
import { join, basename } from 'node:path';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import { PaperclipClient } from '../api/client.js';
import { provisionCompany } from '../api/provision.js';

export default function StepProvision({
  companyName,
  companyDir,
  goal,
  project,
  allRoles,
  rolesData,
  initialTasks,
  goals,
  roleAdapterOverrides,
  apiBaseUrl,
  apiEmail,
  apiPassword,
  apiWorkspaceRoot,
  model,
  startCeo,
  onComplete,
  onError,
}) {
  const [log, setLog] = useState([]);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const client = new PaperclipClient(apiBaseUrl, {
      email: apiEmail,
      password: apiPassword,
    });

    client
      .connect()
      .then(() =>
        provisionCompany({
          client,
          companyName,
          companyDir,
          goal,
          projectName: project?.name || companyName,
          projectDescription: project?.description,
          repoUrl: project?.repoUrl,
          allRoles,
          rolesData,
          initialTasks,
          goals,
          roleAdapterOverrides,
          model,
          remoteCompanyDir: apiWorkspaceRoot ? join(apiWorkspaceRoot, basename(companyDir)) : null,
          startCeo,
          onProgress: (line) => {
            if (!cancelled) {
              setLog((prev) => [...prev, line]);
            }
          },
        }),
      )
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
        <Text bold>{done ? 'Provisioned via API' : 'Provisioning via Paperclip API...'}</Text>
      </Box>
      <Box flexDirection="column" marginLeft={2}>
        {log.map((line, i) => {
          const isDone = line.startsWith('✓');
          return (
            <Text key={i} color={isDone ? 'green' : undefined} dimColor={!isDone}>
              {line}
            </Text>
          );
        })}
      </Box>
    </Box>
  );
}
