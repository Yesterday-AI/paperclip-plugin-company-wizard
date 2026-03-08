import React, { useState, useEffect } from "react";
import { Box, Text, useApp } from "ink";
import Header from "./components/Header.jsx";
import StepName from "./components/StepName.jsx";
import StepPreset from "./components/StepPreset.jsx";
import StepModules from "./components/StepModules.jsx";
import StepRoles from "./components/StepRoles.jsx";
import StepSummary from "./components/StepSummary.jsx";
import StepAssemble from "./components/StepAssemble.jsx";
import StepProvision from "./components/StepProvision.jsx";
import StepDone from "./components/StepDone.jsx";
import { loadPresets, loadModules, loadRoles } from "./logic/load-templates.js";
import {
  resolveCapabilities,
  buildAllRoles,
} from "./logic/resolve.js";

const STEPS = {
  LOADING: "loading",
  NAME: "name",
  PRESET: "preset",
  MODULES: "modules",
  ROLES: "roles",
  SUMMARY: "summary",
  ASSEMBLE: "assemble",
  PROVISION: "provision",
  DONE: "done",
  ERROR: "error",
};

export default function App({ outputDir, templatesDir, apiEnabled, apiBaseUrl }) {
  const { exit } = useApp();

  const [step, setStep] = useState(STEPS.LOADING);
  const [error, setError] = useState(null);

  // Template data (loaded once)
  const [presets, setPresets] = useState([]);
  const [modules, setModules] = useState([]);
  const [availableRoles, setAvailableRoles] = useState([]);

  // User selections
  const [companyName, setCompanyName] = useState("");
  const [baseName, setBaseName] = useState("base");
  const [selectedModules, setSelectedModules] = useState([]);
  const [preselectedModules, setPreselectedModules] = useState([]);
  const [selectedRoles, setSelectedRoles] = useState([]);
  const [preselectedRoles, setPreselectedRoles] = useState([]);

  // Results
  const [assemblyResult, setAssemblyResult] = useState(null);
  const [provisionResult, setProvisionResult] = useState(null);

  // Load template data on mount
  useEffect(() => {
    Promise.all([
      loadPresets(templatesDir),
      loadModules(templatesDir),
      loadRoles(templatesDir),
    ])
      .then(([p, m, r]) => {
        setPresets(p);
        setModules(m);
        setAvailableRoles(r);
        setStep(STEPS.NAME);
      })
      .catch((err) => {
        setError(err.message);
        setStep(STEPS.ERROR);
      });
  }, []);

  // Derived state
  const allRolesSet = buildAllRoles(["ceo", "engineer"], selectedRoles);
  const capabilities = resolveCapabilities(
    modules,
    selectedModules,
    allRolesSet
  );

  const rolesData = new Map();
  for (const r of availableRoles) {
    rolesData.set(r.name, r);
  }

  const handleError = (msg) => {
    setError(msg);
    setStep(STEPS.ERROR);
  };

  return (
    <Box flexDirection="column">
      <Header />

      {step === STEPS.LOADING && <Text dimColor>Loading templates...</Text>}

      {step === STEPS.NAME && (
        <StepName
          onComplete={(name) => {
            setCompanyName(name);
            setStep(STEPS.PRESET);
          }}
        />
      )}

      {step === STEPS.PRESET && (
        <StepPreset
          presets={presets}
          onComplete={(preset) => {
            if (preset.name === "custom") {
              setBaseName("base");
              setPreselectedModules([]);
              setPreselectedRoles([]);
            } else {
              setBaseName(preset.base);
              setPreselectedModules(preset.modules || []);
              setSelectedModules(preset.modules || []);
              setPreselectedRoles(preset.roles || []);
              setSelectedRoles(preset.roles || []);
            }
            setStep(STEPS.MODULES);
          }}
        />
      )}

      {step === STEPS.MODULES && (
        <StepModules
          modules={modules}
          preselected={preselectedModules}
          onComplete={(mods) => {
            setSelectedModules(mods);
            setStep(STEPS.ROLES);
          }}
        />
      )}

      {step === STEPS.ROLES && (
        <StepRoles
          roles={availableRoles}
          preselected={preselectedRoles}
          onComplete={(roles) => {
            setSelectedRoles(roles);
            setStep(STEPS.SUMMARY);
          }}
        />
      )}

      {step === STEPS.SUMMARY && (
        <StepSummary
          companyName={companyName}
          baseName={baseName}
          moduleNames={selectedModules}
          roleNames={selectedRoles}
          capabilities={capabilities}
          outputDir={`${outputDir}/${companyName}/`}
          apiEnabled={apiEnabled}
          onConfirm={() => setStep(STEPS.ASSEMBLE)}
          onCancel={() => {
            exit();
          }}
        />
      )}

      {step === STEPS.ASSEMBLE && (
        <StepAssemble
          companyName={companyName}
          baseName={baseName}
          moduleNames={selectedModules}
          extraRoleNames={selectedRoles}
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
          allRoles={assemblyResult.allRoles}
          rolesData={rolesData}
          initialTasks={assemblyResult.initialTasks}
          apiBaseUrl={apiBaseUrl}
          onComplete={(result) => {
            setProvisionResult(result);
            setStep(STEPS.DONE);
          }}
          onError={(msg) => {
            // API error is non-fatal — files are already assembled
            setError(msg);
            setStep(STEPS.DONE);
          }}
        />
      )}

      {step === STEPS.DONE && assemblyResult && (
        <Box flexDirection="column" gap={1}>
          {error ? (
            <Box>
              <Text color="yellow">
                API provisioning failed: {error}
              </Text>
            </Box>
          ) : null}
          <StepDone
            companyDir={assemblyResult.companyDir}
            allRoles={assemblyResult.allRoles}
            provisioned={!!provisionResult}
            companyId={provisionResult?.companyId}
          />
        </Box>
      )}

      {step === STEPS.ERROR && (
        <Text color="red">Error: {error}</Text>
      )}
    </Box>
  );
}
