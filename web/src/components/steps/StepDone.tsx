import { useWizard, useWizardDispatch, getAllRoles } from "@/context/WizardContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, RotateCcw, ExternalLink } from "lucide-react";

export function StepDone() {
  const state = useWizard();
  const dispatch = useWizardDispatch();
  const allRoles = getAllRoles(state);
  const result = state.provisionResult;

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <CheckCircle2 className="h-6 w-6 text-green-600 shrink-0 mt-0.5" />
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Company provisioned</h2>
          <p className="text-sm text-muted-foreground mt-1">
            <strong>{state.companyName}</strong> has been assembled and registered with Paperclip.
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-4">
          {state.goal.title && (
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
                Goal
              </p>
              <p className="text-sm">{state.goal.title}</p>
            </div>
          )}

          {state.project.name && (
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
                Project
              </p>
              <p className="text-sm">{state.project.name}</p>
            </div>
          )}

          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
              Team ({allRoles.length} agents)
            </p>
            <div className="flex flex-wrap gap-1.5">
              {allRoles.map((r) => {
                const role = state.roles.find((ro) => ro.name === r);
                return (
                  <Badge key={r} variant="outline" className="text-xs">
                    {role?.title || r}
                  </Badge>
                );
              })}
            </div>
          </div>

          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
              Modules ({state.selectedModules.length})
            </p>
            <div className="flex flex-wrap gap-1.5">
              {state.selectedModules.map((m) => (
                <Badge key={m} variant="secondary" className="text-xs">
                  {m}
                </Badge>
              ))}
            </div>
          </div>

          {result?.issueIds && result.issueIds.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
                Issues
              </p>
              <p className="text-sm">{result.issueIds.length} issues provisioned</p>
            </div>
          )}

          {state.presetName && (
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
                Preset
              </p>
              <p className="text-sm capitalize">{state.presetName}</p>
            </div>
          )}

          {result?.companyId && (
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
                Company ID
              </p>
              <p className="font-mono text-xs">{result.companyId}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Button variant="outline" onClick={() => dispatch({ type: "RESET" })}>
          <RotateCcw className="h-4 w-4" />
          Create another
        </Button>
        <Button asChild>
          <a href="http://localhost:3100" target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-4 w-4" />
            Open Paperclip
          </a>
        </Button>
      </div>
    </div>
  );
}
