import React, { useState, useEffect } from 'react';
import { Box, Text, useApp } from 'ink';
import Header from './components/Header.jsx';
import PrevSelections from './components/PrevSelections.jsx';
import StepName from './components/StepName.jsx';
import StepGoal from './components/StepGoal.jsx';
import StepProject from './components/StepProject.jsx';
import StepPreset from './components/StepPreset.jsx';
import StepModules from './components/StepModules.jsx';
import StepRoles from './components/StepRoles.jsx';
import StepGoalTemplates from './components/StepGoalTemplates.jsx';
import StepSummary from './components/StepSummary.jsx';
import StepAssemble from './components/StepAssemble.jsx';
import StepProvision from './components/StepProvision.jsx';
import StepDone from './components/StepDone.jsx';
import { loadPresets, loadModules, loadRoles, loadGoals } from './logic/load-templates.js';
import { resolveCapabilities, buildAllRoles } from './logic/resolve.js';
import { toPascalCase } from './logic/assemble.js';

const STEPS = {
  LOADING: 'loading',
  NAME: 'name',
  GOAL: 'goal',
  PROJECT: 'project',
  PRESET: 'preset',
  MODULES: 'modules',
  GOAL_TEMPLATES: 'goal_templates',
  ROLES: 'roles',
  SUMMARY: 'summary',
  ASSEMBLE: 'assemble',
  PROVISION: 'provision',
  DONE: 'done',
  ERROR: 'error',
};

export default function App({
  outputDir,
  templatesDir,
  dryRun,
  apiEnabled,
  apiBaseUrl,
  apiEmail,
  apiPassword,
  apiWorkspaceRoot,
  model,
  startCeo,
  // Pre-filled values from CLI flags (partial non-interactive)
  initialName = null,
  initialGoal = null,
  initialGoalDescription = null,
  initialProjectName = null,
  initialProjectDescription = null,
  initialRepo = null,
  initialPreset = null,
  initialModules = [],
  initialRoles = [],
}) {
  const { exit } = useApp();

  const [step, setStep] = useState(STEPS.LOADING);
  const [error, setError] = useState(null);

  // Template data (loaded once)
  const [presets, setPresets] = useState([]);
  const [modules, setModules] = useState([]);
  const [availableRoles, setAvailableRoles] = useState([]);
  const [goalTemplates, setGoalTemplates] = useState([]);

  // User selections (pre-filled from flags where available)
  const [companyName, setCompanyName] = useState(initialName || '');
  const [goal, setGoal] = useState({
    title: initialGoal || '',
    description: initialGoalDescription || null,
  });
  const [project, setProject] = useState({
    name: initialProjectName || '',
    description: initialProjectDescription || null,
    repoUrl: initialRepo || null,
  });
  const [presetName, setPresetName] = useState('');
  const [selectedModules, setSelectedModules] = useState([]);
  const [preselectedModules, setPreselectedModules] = useState([]);
  const [selectedRoles, setSelectedRoles] = useState([]);
  const [preselectedRoles, setPreselectedRoles] = useState([]);
  const [selectedGoalTemplate, setSelectedGoalTemplate] = useState(null);

  // Results
  const [assemblyResult, setAssemblyResult] = useState(null);
  const [provisionResult, setProvisionResult] = useState(null);

  // Determine the first step that needs user input
  function resolveFirstStep(loadedPresets) {
    if (!companyName) return STEPS.NAME;
    if (!goal.title && !initialGoal) return STEPS.GOAL;
    // If goal was set via flag, project name defaults to company name
    if (!project.name && !initialProjectName) {
      setProject((p) => ({ ...p, name: companyName }));
    }
    if (initialPreset) {
      // Apply preset immediately
      const preset = loadedPresets.find((p) => p.name === initialPreset);
      if (preset) {
        const mods = [...new Set([...(preset.modules || []), ...initialModules])];
        const roles = [...new Set([...(preset.roles || []), ...initialRoles])];
        setPresetName(preset.name);
        setPreselectedModules(mods);
        setSelectedModules(mods);
        setPreselectedRoles(roles);
        setSelectedRoles(roles);
        return STEPS.SUMMARY;
      }
    }
    return STEPS.PRESET;
  }

  // Load template data on mount
  useEffect(() => {
    Promise.all([
      loadPresets(templatesDir),
      loadModules(templatesDir),
      loadRoles(templatesDir),
      loadGoals(templatesDir),
    ])
      .then(([p, m, r, g]) => {
        setPresets(p);
        setModules(m);
        setAvailableRoles(r);
        setGoalTemplates(g);
        setStep(resolveFirstStep(p));
      })
      .catch((err) => {
        setError(err.message);
        setStep(STEPS.ERROR);
      });
  }, []);

  // Derived state
  const allRolesSet = buildAllRoles(availableRoles, selectedRoles);
  const capabilities = resolveCapabilities(modules, selectedModules, allRolesSet);

  const rolesData = new Map();
  for (const r of availableRoles) {
    rolesData.set(r.name, r);
  }

  const companyDir = companyName ? `${outputDir}/${toPascalCase(companyName)}` : '';

  // Map steps to user-visible step numbers (wizard steps only)
  const STEP_NUMBERS = {
    [STEPS.NAME]: 1,
    [STEPS.GOAL]: 2,
    [STEPS.PROJECT]: 3,
    [STEPS.PRESET]: 4,
    [STEPS.MODULES]: 5,
    [STEPS.GOAL_TEMPLATES]: 6,
    [STEPS.ROLES]: 7,
    [STEPS.SUMMARY]: 8,
  };
  const TOTAL_STEPS = 8;
  const currentStepNum = STEP_NUMBERS[step] || null;

  const handleError = (msg) => {
    setError(msg);
    setStep(STEPS.ERROR);
  };

  // Build previous selections for context display
  const prev = {
    company: companyName ? [['Company', companyName]] : [],
    goal: goal.title
      ? [
          ['Company', companyName],
          ['Goal', goal.title],
          ...(goal.description ? [['', goal.description]] : []),
        ]
      : [['Company', companyName]],
    project: [
      ['Company', companyName],
      ...(goal.title ? [['Goal', goal.title]] : []),
      ...(project.name ? [['Project', project.name]] : []),
      ...(project.repoUrl ? [['Repo', project.repoUrl]] : []),
    ],
    preset: [
      ['Company', companyName],
      ...(goal.title ? [['Goal', goal.title]] : []),
      ...(project.name ? [['Project', project.name]] : []),
    ],
    modules: [
      ['Company', companyName],
      ...(goal.title ? [['Goal', goal.title]] : []),
      ...(presetName ? [['Preset', presetName]] : []),
    ],
    roles: [
      ['Company', companyName],
      ...(presetName ? [['Preset', presetName]] : []),
      ...(selectedModules.length ? [['Modules', selectedModules.join(', ')]] : []),
    ],
  };

  return (
    <Box flexDirection="column">
      <Header step={currentStepNum} totalSteps={TOTAL_STEPS} />

      {step === STEPS.LOADING && <Text dimColor>Loading templates...</Text>}

      {step === STEPS.NAME && (
        <StepName
          onComplete={(name) => {
            setCompanyName(name);
            setStep(STEPS.GOAL);
          }}
        />
      )}

      {step === STEPS.GOAL && (
        <>
          <PrevSelections entries={prev.company} />
          <StepGoal
            onComplete={(g) => {
              setGoal(g);
              setStep(STEPS.PROJECT);
            }}
          />
        </>
      )}

      {step === STEPS.PROJECT && (
        <>
          <PrevSelections entries={prev.goal} />
          <StepProject
            defaultName={companyName}
            companyDir={companyDir}
            onComplete={(p) => {
              setProject(p);
              setStep(STEPS.PRESET);
            }}
          />
        </>
      )}

      {step === STEPS.PRESET && (
        <>
          <PrevSelections entries={prev.preset} />
          <StepPreset
            presets={presets}
            onComplete={(preset) => {
              setPresetName(preset.name);
              if (preset.name === 'custom') {
                setPreselectedModules([]);
                setPreselectedRoles([]);
              } else {
                setPreselectedModules(preset.modules || []);
                setSelectedModules(preset.modules || []);
                setPreselectedRoles(preset.roles || []);
                setSelectedRoles(preset.roles || []);
              }
              setStep(STEPS.MODULES);
            }}
          />
        </>
      )}

      {step === STEPS.MODULES && (
        <>
          <PrevSelections entries={prev.modules} />
          <StepModules
            modules={modules}
            preselected={preselectedModules}
            onComplete={(mods) => {
              setSelectedModules(mods);
              setStep(STEPS.GOAL_TEMPLATES);
            }}
          />
        </>
      )}

      {step === STEPS.GOAL_TEMPLATES && (
        <>
          <PrevSelections entries={prev.modules} />
          <StepGoalTemplates
            goalTemplates={goalTemplates}
            onComplete={(template) => {
              setSelectedGoalTemplate(template);
              setStep(STEPS.ROLES);
            }}
          />
        </>
      )}

      {step === STEPS.ROLES && (
        <>
          <PrevSelections entries={prev.roles} />
          <StepRoles
            roles={availableRoles.filter((r) => !r.base)}
            preselected={preselectedRoles}
            onComplete={(roles) => {
              setSelectedRoles(roles);
              setStep(STEPS.SUMMARY);
            }}
          />
        </>
      )}

      {step === STEPS.SUMMARY && (
        <StepSummary
          companyName={companyName}
          goal={goal}
          project={project}
          presetName={presetName}
          moduleNames={selectedModules}
          roleNames={selectedRoles}
          modules={modules}
          capabilities={capabilities}
          goalTemplate={selectedGoalTemplate}
          outputDir={companyDir}
          apiEnabled={apiEnabled}
          dryRun={dryRun}
          onConfirm={() => {
            if (dryRun) {
              exit();
            } else {
              setStep(STEPS.ASSEMBLE);
            }
          }}
          onCancel={() => {
            exit();
          }}
        />
      )}

      {step === STEPS.ASSEMBLE && (
        <StepAssemble
          companyName={companyName}
          goal={goal}
          project={project}
          moduleNames={selectedModules}
          extraRoleNames={selectedRoles}
          goalTemplate={selectedGoalTemplate}
          outputDir={outputDir}
          templatesDir={templatesDir}
          onComplete={(result) => {
            setAssemblyResult(result);
            if (apiEnabled) {
              setStep(STEPS.PROVISION);
            } else {
              setStep(STEPS.DONE);
            }
          }}
          onError={handleError}
        />
      )}

      {step === STEPS.PROVISION && assemblyResult && (
        <StepProvision
          companyName={companyName}
          companyDir={assemblyResult.companyDir}
          goal={goal}
          project={project}
          allRoles={assemblyResult.allRoles}
          rolesData={rolesData}
          initialTasks={assemblyResult.initialTasks}
          goalTemplate={selectedGoalTemplate}
          apiBaseUrl={apiBaseUrl}
          apiEmail={apiEmail}
          apiPassword={apiPassword}
          apiWorkspaceRoot={apiWorkspaceRoot}
          model={model}
          startCeo={startCeo}
          onComplete={(result) => {
            setProvisionResult(result);
            setStep(STEPS.DONE);
          }}
          onError={(msg) => {
            setError(msg);
            setStep(STEPS.DONE);
          }}
        />
      )}

      {step === STEPS.DONE && assemblyResult && (
        <Box flexDirection="column" gap={1}>
          {error ? (
            <Box>
              <Text color="yellow">API provisioning failed: {error}</Text>
            </Box>
          ) : null}
          <StepDone
            companyDir={assemblyResult.companyDir}
            allRoles={assemblyResult.allRoles}
            provisioned={!!provisionResult}
            provisionResult={provisionResult}
          />
        </Box>
      )}

      {step === STEPS.ERROR && <Text color="red">Error: {error}</Text>}
    </Box>
  );
}
