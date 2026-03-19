import { useWizard, useWizardDispatch, nextStep } from '../../context/WizardContext';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { toPascalCase } from '../../lib/utils';
import { useCallback, useState } from 'react';
import { ChevronDown, ChevronRight, Settings2 } from 'lucide-react';

const ADAPTER_TYPES = [
  { value: 'claude_local', label: 'Claude Code', desc: 'Local Claude agent' },
  { value: 'codex_local', label: 'Codex', desc: 'Local Codex agent' },
  { value: 'opencode_local', label: 'OpenCode', desc: 'Local OpenCode agent' },
  { value: 'cursor', label: 'Cursor', desc: 'Cursor IDE agent' },
  { value: 'openclaw_gateway', label: 'OpenClaw', desc: 'OpenClaw gateway' },
  { value: 'hermes_local', label: 'Hermes', desc: 'Local Hermes agent' },
];

export function StepName() {
  const state = useWizard();
  const dispatch = useWizardDispatch();
  const [showCeoSetup, setShowCeoSetup] = useState(false);

  const handleNext = useCallback(() => {
    if (state.companyName.trim()) {
      dispatch({ type: 'GO_TO', step: nextStep(state) });
    }
  }, [state, dispatch]);

  const dirName = state.companyName.trim() ? toPascalCase(state.companyName) : 'YourCompany';

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-xl font-semibold tracking-tight">Company name</h2>
        <p className="text-sm text-muted-foreground">What should your AI company be called?</p>
      </div>

      <div className="space-y-3">
        <Input
          placeholder="e.g. Acme Corp, Black Mesa, Initech"
          value={state.companyName}
          onChange={(e) => dispatch({ type: 'SET_COMPANY_NAME', value: e.target.value })}
          onKeyDown={(e) => e.key === 'Enter' && handleNext()}
          autoFocus
          className="text-base h-11"
        />
        <p className="text-xs text-muted-foreground">
          Workspace directory: <code className="bg-muted px-1.5 py-0.5 rounded">{dirName}/</code>
        </p>
      </div>

      {/* CEO Setup — collapsible, default collapsed */}
      <div className="rounded-lg border">
        <button
          onClick={() => setShowCeoSetup((v) => !v)}
          className="w-full flex items-center gap-2 px-4 py-3 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <Settings2 className="h-4 w-4" />
          CEO Agent Setup
          {showCeoSetup ? (
            <ChevronDown className="h-3.5 w-3.5 ml-auto" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 ml-auto" />
          )}
          {!showCeoSetup && (
            <span className="text-xs text-muted-foreground/60 ml-1">
              {ADAPTER_TYPES.find((a) => a.value === state.ceoAdapter.type)?.label ||
                state.ceoAdapter.type}
              {state.ceoAdapter.cwd ? ` · ${state.ceoAdapter.cwd}` : ''}
              {state.ceoAdapter.model ? ` · ${state.ceoAdapter.model}` : ''}
            </span>
          )}
        </button>

        {showCeoSetup && (
          <div className="px-4 pb-4 space-y-4 border-t pt-4">
            <p className="text-xs text-muted-foreground">
              These defaults apply to all generated agents. You can override per agent in the review
              step.
            </p>

            {/* Adapter type */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Adapter type</label>
              <div className="grid grid-cols-3 gap-2">
                {ADAPTER_TYPES.map((adapter) => (
                  <button
                    key={adapter.value}
                    onClick={() =>
                      dispatch({ type: 'SET_CEO_ADAPTER', adapter: { type: adapter.value } })
                    }
                    className={`flex flex-col items-center gap-1 rounded-lg border p-3 text-center transition-all duration-150 ${
                      state.ceoAdapter.type === adapter.value
                        ? 'border-foreground/30 bg-accent'
                        : 'border-border hover:border-foreground/15 hover:bg-accent/50'
                    }`}
                  >
                    <span className="text-xs font-medium">{adapter.label}</span>
                    <span className="text-[10px] text-muted-foreground">{adapter.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Working directory */}
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Working directory{' '}
                <span className="text-muted-foreground font-normal">(optional)</span>
              </label>
              <Input
                placeholder="/path/to/project"
                value={state.ceoAdapter.cwd}
                onChange={(e) =>
                  dispatch({ type: 'SET_CEO_ADAPTER', adapter: { cwd: e.target.value } })
                }
              />
              <p className="text-xs text-muted-foreground">
                Where generated agent files will be written. Leave empty to use the default
                Paperclip workspace.
              </p>
            </div>

            {/* Model */}
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Model <span className="text-muted-foreground font-normal">(optional)</span>
              </label>
              <Input
                placeholder="Default"
                value={state.ceoAdapter.model}
                onChange={(e) =>
                  dispatch({ type: 'SET_CEO_ADAPTER', adapter: { model: e.target.value } })
                }
              />
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-end">
        <Button onClick={handleNext} disabled={!state.companyName.trim()}>
          Continue
        </Button>
      </div>
    </div>
  );
}
