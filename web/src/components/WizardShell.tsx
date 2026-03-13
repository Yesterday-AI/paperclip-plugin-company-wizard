import { useWizard, useWizardDispatch, prevStep, getUserStepIndex, getTotalSteps } from "@/context/WizardContext";
import { StepOnboarding } from "./steps/StepOnboarding";
import { StepName } from "./steps/StepName";
import { StepGoal } from "./steps/StepGoal";
import { StepProject } from "./steps/StepProject";
import { StepPreset } from "./steps/StepPreset";
import { StepModules } from "./steps/StepModules";
import { StepRoles } from "./steps/StepRoles";
import { StepSummary } from "./steps/StepSummary";
import { StepAiWizard } from "./steps/StepAiWizard";
import { StepProvision } from "./steps/StepProvision";
import { StepDone } from "./steps/StepDone";
import { ArrowLeft, Paperclip, Sun, Moon } from "lucide-react";
import { Button } from "./ui/button";

const STEP_COMPONENTS = {
  onboarding: StepOnboarding,
  name: StepName,
  goal: StepGoal,
  project: StepProject,
  preset: StepPreset,
  modules: StepModules,
  roles: StepRoles,
  summary: StepSummary,
  "ai-wizard": StepAiWizard,
  provision: StepProvision,
  done: StepDone,
} as const;

function StepIndicator() {
  const state = useWizard();
  const current = getUserStepIndex(state);
  const total = getTotalSteps(state);

  if (current < 1 || state.step === "provision" || state.step === "done") return null;

  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className={`h-1.5 rounded-full transition-all duration-300 ${
            i + 1 <= current
              ? "w-6 bg-foreground"
              : "w-1.5 bg-muted-foreground/30"
          }`}
        />
      ))}
      <span className="ml-2 text-xs text-muted-foreground">
        {current}/{total}
      </span>
    </div>
  );
}

function ThemeToggle() {
  const toggle = () => {
    const isDark = document.documentElement.classList.toggle("dark");
    localStorage.setItem("theme", isDark ? "dark" : "light");
  };

  return (
    <Button variant="ghost" size="icon" onClick={toggle} className="h-8 w-8">
      <Sun className="h-4 w-4 dark:hidden" />
      <Moon className="hidden h-4 w-4 dark:block" />
    </Button>
  );
}

export function WizardShell() {
  const state = useWizard();
  const dispatch = useWizardDispatch();

  const StepComponent = STEP_COMPONENTS[state.step];
  const showBack = state.step !== "onboarding" && state.step !== "ai-wizard" && state.step !== "provision" && state.step !== "done";

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {showBack && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => dispatch({ type: "GO_TO", step: prevStep(state) })}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
          <div className="flex items-center gap-2">
            <Paperclip className="h-5 w-5" />
            <span className="font-semibold text-sm">Clipper</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <StepIndicator />
          <ThemeToggle />
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 flex items-start justify-center p-6 md:p-12">
        <div className="w-full max-w-2xl">
          <StepComponent />
        </div>
      </main>

      {/* Error bar */}
      {state.error && (
        <div className="fixed bottom-0 inset-x-0 bg-destructive/10 border-t border-destructive/20 px-6 py-3 text-sm text-destructive flex items-center justify-between">
          <span>{state.error}</span>
          <Button variant="ghost" size="sm" onClick={() => dispatch({ type: "SET_ERROR", error: null })}>
            Dismiss
          </Button>
        </div>
      )}
    </div>
  );
}
