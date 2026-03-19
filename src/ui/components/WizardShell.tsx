import { useEffect } from 'react';
import {
  useWizard,
  useWizardDispatch,
  prevStep,
  getUserStepIndex,
  getTotalSteps,
} from '../context/WizardContext';
import { StepOnboarding } from './steps/StepOnboarding';
import { StepName } from './steps/StepName';
import { StepGoal } from './steps/StepGoal';
import { StepPreset } from './steps/StepPreset';
import { StepModules } from './steps/StepModules';
import { StepRoles } from './steps/StepRoles';
import { StepSummary } from './steps/StepSummary';
import { StepAiWizard } from './steps/StepAiWizard';
import { StepProvision } from './steps/StepProvision';
import { StepDone } from './steps/StepDone';
import { Button } from './ui/button';

const STEP_COMPONENTS = {
  onboarding: StepOnboarding,
  name: StepName,
  goal: StepGoal,
  preset: StepPreset,
  modules: StepModules,
  roles: StepRoles,
  summary: StepSummary,
  'ai-wizard': StepAiWizard,
  provision: StepProvision,
  done: StepDone,
} as const;

function StepIndicator() {
  const state = useWizard();
  const current = getUserStepIndex(state);
  const total = getTotalSteps(state);

  if (
    current < 1 ||
    state.step === 'provision' ||
    state.step === 'done' ||
    state.step === 'ai-wizard'
  )
    return null;

  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className={`h-1.5 rounded-full transition-all duration-300 ${
            i + 1 <= current ? 'w-6 bg-foreground' : 'w-1.5 bg-muted-foreground/30'
          }`}
        />
      ))}
      <span className="ml-2 text-xs text-muted-foreground">
        {current}/{total}
      </span>
    </div>
  );
}

export function WizardShell() {
  const state = useWizard();
  const dispatch = useWizardDispatch();

  const StepComponent = STEP_COMPONENTS[state.step];

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [state.step]);

  return (
    <div className="flex flex-col">
      {/* Step indicator (compact, no standalone header) */}
      {getUserStepIndex(state) >= 1 && state.step !== 'provision' && state.step !== 'done' && (
        <div className="flex items-center justify-end px-6 py-3">
          <StepIndicator />
        </div>
      )}

      {/* Content */}
      <main className="flex-1 flex items-start justify-center p-6">
        <div className="w-full max-w-2xl">
          <StepComponent />
        </div>
      </main>

      {/* Error bar */}
      {state.error && (
        <div className="fixed bottom-0 inset-x-0 bg-destructive/10 border-t border-destructive/20 px-6 py-3 text-sm text-destructive flex items-center justify-between">
          <span>{state.error}</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => dispatch({ type: 'SET_ERROR', error: null })}
          >
            Dismiss
          </Button>
        </div>
      )}
    </div>
  );
}
