import { useWizard, useWizardDispatch, nextStep } from '../../context/WizardContext';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { cn } from '../../lib/utils';
import { Check, Crown } from 'lucide-react';

export function StepRoles() {
  const state = useWizard();
  const dispatch = useWizardDispatch();

  const baseRoles = state.roles.filter((r) => r._base);
  const extraRoles = state.roles.filter((r) => !r._base);
  const selected = new Set(state.selectedRoles);

  const toggle = (name: string) => {
    const next = new Set(selected);
    if (next.has(name)) {
      next.delete(name);
    } else {
      next.add(name);
    }
    dispatch({ type: 'SET_ROLES', roles: [...next] });
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-xl font-semibold tracking-tight">Team roles</h2>
        <p className="text-sm text-muted-foreground">
          Base roles are always included. Add specialists as needed.
        </p>
      </div>

      <div className="max-h-[60vh] overflow-y-auto pr-1 space-y-4">
        {/* Base roles (locked) */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Base team
          </p>
          <div className="grid gap-2">
            {baseRoles.map((role) => (
              <div
                key={role.name}
                className="flex items-start gap-3 rounded-lg border border-foreground/10 bg-accent/50 p-3"
              >
                <div className="h-5 w-5 rounded flex items-center justify-center shrink-0 bg-foreground text-background mt-0.5">
                  <Crown className="h-3 w-3" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{role.title}</span>
                    {role.division && (
                      <Badge variant="outline" className="text-[10px]">
                        {role.division}
                      </Badge>
                    )}
                    <Badge variant="secondary" className="ml-auto text-[10px]">
                      required
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{role.description}</p>
                  {role.tagline && (
                    <p className="text-[11px] text-muted-foreground/60 mt-0.5 italic">
                      {role.tagline}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Extra roles (toggleable) */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Specialists
          </p>
          <div className="grid gap-2">
            {extraRoles.map((role) => {
              const isSelected = selected.has(role.name);
              return (
                <button
                  key={role.name}
                  onClick={() => toggle(role.name)}
                  className={cn(
                    'flex items-start gap-3 rounded-lg border p-3 text-left transition-all duration-150',
                    isSelected
                      ? 'border-foreground/20 bg-accent'
                      : 'border-border hover:border-foreground/10 hover:bg-accent/30',
                  )}
                >
                  <div
                    className={cn(
                      'h-5 w-5 rounded flex items-center justify-center shrink-0 border mt-0.5',
                      isSelected
                        ? 'bg-foreground border-foreground text-background'
                        : 'border-input',
                    )}
                  >
                    {isSelected && <Check className="h-3 w-3" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">{role.title}</span>
                      {role.division && (
                        <Badge variant="outline" className="text-[10px]">
                          {role.division}
                        </Badge>
                      )}
                      {role.reportsTo && (
                        <span className="text-[10px] text-muted-foreground">
                          reports to {role.reportsTo}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{role.description}</p>
                    {role.tagline && (
                      <p className="text-[11px] text-muted-foreground/60 mt-0.5 italic">
                        {role.tagline}
                      </p>
                    )}
                    {isSelected && role.enhances && role.enhances.length > 0 && (
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                        {role.enhances.map((e, i) => (
                          <span key={i} className="text-[11px] text-muted-foreground/70">
                            + {e}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {baseRoles.length + selected.size} total agents
        </p>
        <Button onClick={() => dispatch({ type: 'GO_TO', step: nextStep(state) })}>Continue</Button>
      </div>
    </div>
  );
}
