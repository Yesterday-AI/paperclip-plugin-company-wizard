import { useEffect, useRef } from 'react';
import { useWizard, useWizardDispatch, getAllRoles } from '../../context/WizardContext';
import { usePluginAction } from '@paperclipai/plugin-sdk/ui';
import { Loader2, Settings, AlertTriangle, RotateCcw } from 'lucide-react';
import { Button } from '../ui/button';
import { getPluginSettingsUrl } from '../../lib/utils';

function isConfigError(error: string): boolean {
  return /authenticat|PAPERCLIP_EMAIL|PAPERCLIP_PASSWORD|paperclipEmail|paperclipPassword|credentials|unauthorized|forbidden/i.test(
    error,
  );
}

export function StepProvision() {
  const state = useWizard();
  const dispatch = useWizardDispatch();
  const started = useRef(false);
  const logEndRef = useRef<HTMLDivElement>(null);
  const startProvision = usePluginAction('start-provision');

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [state.provisionLog]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    dispatch({ type: 'SET_PROVISIONING', value: true });
    dispatch({ type: 'ADD_PROVISION_LOG', line: 'Starting provisioning...' });
    dispatch({ type: 'ADD_PROVISION_LOG', line: '' });

    const allRoles = getAllRoles(state);

    startProvision({
      companyName: state.companyName,
      companyDescription: state.companyDescription || undefined,
      goals: state.goals.length > 0 ? state.goals : undefined,
      projects: state.projects.length > 0 ? state.projects : undefined,
      ceoAdapter: state.ceoAdapter,
      presetName: state.presetName,
      selectedModules: state.selectedModules,
      selectedRoles: state.selectedRoles,
      allRoles,
      fileOverrides: Object.keys(state.fileOverrides).length > 0 ? state.fileOverrides : undefined,
      existingCompanyId: state.existingCompanyId.trim() || undefined,
    })
      .then((result: any) => {
        // Action returns result directly with logs
        if (result?.logs) {
          for (const line of result.logs) {
            dispatch({ type: 'ADD_PROVISION_LOG', line });
          }
        }
        // Graceful error return — action no longer throws, check result.error
        if (result?.error) {
          dispatch({ type: 'SET_PROVISIONING', value: false });
          dispatch({ type: 'SET_ERROR', error: result.error });
          return;
        }
        dispatch({ type: 'ADD_PROVISION_LOG', line: '' });
        dispatch({ type: 'ADD_PROVISION_LOG', line: 'All done!' });
        dispatch({ type: 'SET_PROVISION_RESULT', result });
        setTimeout(() => dispatch({ type: 'GO_TO', step: 'done' }), 2000);
      })
      .catch((err: unknown) => {
        // Fallback — should rarely fire now that the worker returns errors gracefully
        const message =
          err instanceof Error
            ? err.message
            : typeof err === 'object' && err !== null && 'message' in err
              ? String((err as { message: unknown }).message)
              : 'Provisioning failed';
        dispatch({ type: 'SET_PROVISIONING', value: false });
        dispatch({ type: 'SET_ERROR', error: message });
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isDone = !state.provisioning && state.provisionResult;
  const showConfigHint = state.error && isConfigError(state.error);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-xl font-semibold tracking-tight flex items-center gap-2">
          {state.provisioning && <Loader2 className="h-5 w-5 animate-spin" />}
          {state.provisioning ? 'Provisioning...' : state.error ? 'Error' : 'Provisioned'}
        </h2>
        {isDone && (
          <p className="text-sm text-muted-foreground">
            Company created. CEO will bootstrap the team on first heartbeat.
          </p>
        )}
      </div>

      {/* Config error with actionable hint */}
      {showConfigHint && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 dark:bg-amber-500/5 p-4 space-y-3">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-500 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-medium">Authentication required</p>
              <p className="text-sm text-muted-foreground">
                This Paperclip instance requires credentials. Configure{' '}
                <span className="font-medium">paperclipEmail</span> and{' '}
                <span className="font-medium">paperclipPassword</span> in the plugin settings.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 pl-8">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                window.location.href = getPluginSettingsUrl();
              }}
            >
              <Settings className="h-3.5 w-3.5 mr-1.5" />
              Plugin Settings
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                dispatch({ type: 'SET_ERROR', error: null });
                started.current = false;
                dispatch({ type: 'SET_PROVISIONING', value: false });
                dispatch({ type: 'GO_TO', step: state.path === 'ai' ? 'ai-wizard' : 'summary' });
              }}
            >
              <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
              Back to Summary
            </Button>
          </div>
        </div>
      )}

      {/* Generic error (non-config) */}
      {state.error && !showConfigHint && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 space-y-3">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-medium">Provisioning failed</p>
              <p className="text-sm text-muted-foreground">{state.error}</p>
            </div>
          </div>
          <div className="pl-8">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                dispatch({ type: 'SET_ERROR', error: null });
                started.current = false;
                dispatch({ type: 'SET_PROVISIONING', value: false });
                dispatch({ type: 'GO_TO', step: state.path === 'ai' ? 'ai-wizard' : 'summary' });
              }}
            >
              <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
              Back to Summary
            </Button>
          </div>
        </div>
      )}

      <div className="rounded-lg border bg-card p-4 font-mono text-xs max-h-[400px] overflow-y-auto">
        {state.provisionLog.map((line, i) => (
          <div
            key={i}
            className={
              line.startsWith('✓')
                ? 'text-green-600 py-0.5'
                : line.startsWith('!')
                  ? 'text-yellow-600 py-0.5'
                  : line.startsWith('Error')
                    ? 'text-destructive py-0.5'
                    : line.startsWith('+') || line.startsWith('  ')
                      ? 'text-foreground pl-2 py-0.5 bg-muted/50 rounded my-0.5'
                      : 'text-muted-foreground py-0.5'
            }
          >
            {line || '\u00A0'}
          </div>
        ))}
        <div ref={logEndRef} />
      </div>
    </div>
  );
}
