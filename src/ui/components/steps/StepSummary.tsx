import { useEffect, useRef, useState } from 'react';
import { useWizard, useWizardDispatch } from '../../context/WizardContext';
import { usePluginAction } from '@paperclipai/plugin-sdk/ui';
import { Button } from '../ui/button';
import { ConfigReview } from '../ConfigReview';
import { AlertTriangle, Settings } from 'lucide-react';
import { getPluginSettingsUrl } from '../../lib/utils';

export function StepSummary() {
  const state = useWizard();
  const dispatch = useWizardDispatch();
  const checkAuth = usePluginAction('check-auth');
  const [authError, setAuthError] = useState<string | null>(null);
  const checked = useRef(false);

  useEffect(() => {
    if (checked.current) return;
    checked.current = true;
    checkAuth({})
      .then((result: any) => {
        if (!result?.ok) setAuthError(result?.error || 'Authentication failed');
      })
      .catch((err: any) => {
        setAuthError(err?.message || 'Could not verify API connection');
      });
  }, []);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-xl font-semibold tracking-tight">Review</h2>
        <p className="text-sm text-muted-foreground">
          Confirm your company configuration before creating. Click any field to edit.
        </p>
      </div>

      <ConfigReview />

      {authError && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
          <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
          <div className="space-y-2 flex-1 min-w-0">
            <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
              API connection failed
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-300 wrap-break-word">
              {authError}
            </p>
            <Button
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={() => {
                window.location.href = getPluginSettingsUrl();
              }}
            >
              <Settings className="h-3 w-3 mr-1.5" />
              Plugin Settings
            </Button>
          </div>
        </div>
      )}

      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={() => dispatch({ type: 'GO_TO', step: 'roles' })}>
          Back
        </Button>
        <Button onClick={() => dispatch({ type: 'GO_TO', step: 'provision' })}>
          Create Company
        </Button>
      </div>
    </div>
  );
}
