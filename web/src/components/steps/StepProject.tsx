import { useWizard, useWizardDispatch, nextStep } from "@/context/WizardContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useCallback } from "react";

export function StepProject() {
  const state = useWizard();
  const dispatch = useWizardDispatch();

  const handleNext = useCallback(() => {
    // Default project name to company name if not provided
    if (!state.project.name && state.companyName) {
      dispatch({ type: "SET_PROJECT", project: { name: state.companyName } });
    }
    dispatch({ type: "GO_TO", step: nextStep(state) });
  }, [state, dispatch]);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-xl font-semibold tracking-tight">First project</h2>
        <p className="text-sm text-muted-foreground">
          The codebase your agents will work on.
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Project name</label>
          <Input
            placeholder={state.companyName || "e.g. MyApp, Backend API"}
            value={state.project.name}
            onChange={(e) => dispatch({ type: "SET_PROJECT", project: { name: e.target.value } })}
            onKeyDown={(e) => e.key === "Enter" && handleNext()}
            autoFocus
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">
            Repository URL <span className="text-muted-foreground font-normal">(optional)</span>
          </label>
          <Input
            placeholder="https://github.com/org/repo"
            value={state.project.repoUrl}
            onChange={(e) => dispatch({ type: "SET_PROJECT", project: { repoUrl: e.target.value } })}
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">
            Description <span className="text-muted-foreground font-normal">(optional)</span>
          </label>
          <textarea
            className="flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
            placeholder="What does this project do?"
            value={state.project.description}
            onChange={(e) => dispatch({ type: "SET_PROJECT", project: { description: e.target.value } })}
            style={{ fieldSizing: "content" } as React.CSSProperties}
          />
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={handleNext}>Skip</Button>
        <Button onClick={handleNext}>Continue</Button>
      </div>
    </div>
  );
}
