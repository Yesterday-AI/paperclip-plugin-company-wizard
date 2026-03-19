import { useWizard, useWizardDispatch, nextStep } from '../../context/WizardContext';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { cn } from '../../lib/utils';
import { Check, Zap, Shield, Rocket, FlaskConical, Atom, Settings } from 'lucide-react';

const PRESET_ICONS: Record<string, React.ElementType> = {
  fast: Zap,
  quality: Shield,
  startup: Rocket,
  research: FlaskConical,
  rad: Atom,
  full: Settings,
};

export function StepPreset() {
  const state = useWizard();
  const dispatch = useWizardDispatch();

  const handleSelect = (name: string) => {
    dispatch({ type: 'SET_PRESET', name });
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-xl font-semibold tracking-tight">Team preset</h2>
        <p className="text-sm text-muted-foreground">
          Choose a pre-configured team setup, or go custom.
        </p>
      </div>

      <div className="grid gap-3 max-h-[60vh] overflow-y-auto pr-1">
        {state.presets.map((preset) => {
          const Icon = PRESET_ICONS[preset.name] || Settings;
          const selected = state.presetName === preset.name;
          return (
            <button
              key={preset.name}
              onClick={() => handleSelect(preset.name)}
              className={cn(
                'flex items-start gap-4 rounded-lg border p-4 text-left transition-all duration-150',
                selected
                  ? 'border-foreground/30 bg-accent'
                  : 'border-border hover:border-foreground/15 hover:bg-accent/50',
              )}
            >
              <div
                className={cn(
                  'mt-0.5 h-8 w-8 rounded-md flex items-center justify-center shrink-0',
                  selected ? 'bg-foreground text-background' : 'bg-secondary',
                )}
              >
                {selected ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm capitalize">{preset.name}</span>
                  {preset.modules && (
                    <Badge variant="secondary" className="text-[10px]">
                      {preset.modules.length} modules
                    </Badge>
                  )}
                  {preset.roles && preset.roles.length > 0 && (
                    <Badge variant="secondary" className="text-[10px]">
                      +{preset.roles.length} roles
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">{preset.description}</p>
                {preset.constraints && preset.constraints.length > 0 && (
                  <p className="text-xs text-muted-foreground/70 mt-1">
                    {preset.constraints.join(' · ')}
                  </p>
                )}
              </div>
            </button>
          );
        })}

        {/* Custom option */}
        <button
          onClick={() => handleSelect('custom')}
          className={cn(
            'flex items-start gap-4 rounded-lg border border-dashed p-4 text-left transition-all duration-150',
            state.presetName === 'custom'
              ? 'border-foreground/30 bg-accent'
              : 'border-border hover:border-foreground/15 hover:bg-accent/50',
          )}
        >
          <div
            className={cn(
              'mt-0.5 h-8 w-8 rounded-md flex items-center justify-center shrink-0',
              state.presetName === 'custom' ? 'bg-foreground text-background' : 'bg-secondary',
            )}
          >
            {state.presetName === 'custom' ? (
              <Check className="h-4 w-4" />
            ) : (
              <Settings className="h-4 w-4" />
            )}
          </div>
          <div>
            <span className="font-medium text-sm">Custom</span>
            <p className="text-sm text-muted-foreground mt-0.5">Pick modules and roles manually</p>
          </div>
        </button>
      </div>

      <div className="flex justify-end">
        <Button
          onClick={() => dispatch({ type: 'GO_TO', step: nextStep(state) })}
          disabled={!state.presetName}
        >
          Continue
        </Button>
      </div>
    </div>
  );
}
