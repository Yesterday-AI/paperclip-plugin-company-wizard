import { useWizard, useWizardDispatch, nextStep } from "@/context/WizardContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Check, Lock } from "lucide-react";

export function StepModules() {
  const state = useWizard();
  const dispatch = useWizardDispatch();

  // Build dependency map
  const requiredBy = new Map<string, string[]>();
  for (const m of state.modules) {
    for (const dep of m.requires ?? []) {
      const list = requiredBy.get(dep) || [];
      list.push(m.name);
      requiredBy.set(dep, list);
    }
  }

  const selected = new Set(state.selectedModules);

  const toggle = (name: string) => {
    const mod = state.modules.find((m) => m.name === name);
    if (!mod) return;

    const next = new Set(selected);
    if (next.has(name)) {
      // Check if anything depends on this
      const dependents = requiredBy.get(name) || [];
      const activeDeps = dependents.filter((d) => next.has(d));
      if (activeDeps.length > 0) return; // blocked
      next.delete(name);
    } else {
      next.add(name);
      // Auto-add dependencies
      for (const dep of mod.requires ?? []) {
        next.add(dep);
      }
    }
    dispatch({ type: "SET_MODULES", modules: [...next] });
  };

  const isLocked = (name: string) => {
    const dependents = requiredBy.get(name) || [];
    return dependents.some((d) => selected.has(d));
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-xl font-semibold tracking-tight">Modules</h2>
        <p className="text-sm text-muted-foreground">
          Capabilities to enable. Dependencies are auto-selected.
        </p>
      </div>

      <div className="grid gap-2 max-h-[480px] overflow-y-auto pr-1">
        {state.modules.map((mod) => {
          const isSelected = selected.has(mod.name);
          const locked = isLocked(mod.name);
          const capCount = mod.capabilities?.length ?? 0;
          return (
            <button
              key={mod.name}
              onClick={() => toggle(mod.name)}
              disabled={locked && isSelected}
              className={cn(
                "flex items-center gap-3 rounded-lg border p-3 text-left transition-all duration-150",
                isSelected
                  ? "border-foreground/20 bg-accent"
                  : "border-border hover:border-foreground/10 hover:bg-accent/30",
                locked && isSelected && "opacity-80"
              )}
            >
              <div
                className={cn(
                  "h-5 w-5 rounded flex items-center justify-center shrink-0 border mt-0.5",
                  isSelected
                    ? "bg-foreground border-foreground text-background"
                    : "border-input"
                )}
              >
                {isSelected &&
                  (locked ? (
                    <Lock className="h-3 w-3" />
                  ) : (
                    <Check className="h-3 w-3" />
                  ))}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium">{mod.name}</span>
                  {mod.activatesWithRoles && mod.activatesWithRoles.length > 0 && (
                    <Badge variant="outline" className="text-[10px]">
                      needs {mod.activatesWithRoles.join("/")}
                    </Badge>
                  )}
                  {mod.tasks && mod.tasks.length > 0 && (
                    <Badge variant="secondary" className="text-[10px]">
                      {mod.tasks.length} tasks
                    </Badge>
                  )}
                  {capCount > 0 && (
                    <Badge variant="secondary" className="text-[10px]">
                      {capCount} {capCount === 1 ? "capability" : "capabilities"}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {mod.description}
                </p>
                {capCount > 0 && (
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                    {mod.capabilities!.map((cap) => (
                      <span key={cap.skill} className="text-[11px] text-muted-foreground/70">
                        {cap.skill} <span className="text-muted-foreground/40">→ {cap.owners.join(", ")}</span>
                      </span>
                    ))}
                  </div>
                )}
                {mod.requires && mod.requires.length > 0 && (
                  <p className="text-[11px] text-muted-foreground/60 mt-0.5">
                    requires {mod.requires.join(", ")}
                  </p>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {selected.size} of {state.modules.length} selected
        </p>
        <Button onClick={() => dispatch({ type: "GO_TO", step: nextStep(state) })}>
          Continue
        </Button>
      </div>
    </div>
  );
}
