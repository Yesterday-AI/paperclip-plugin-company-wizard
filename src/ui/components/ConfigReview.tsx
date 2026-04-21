import { useState, useCallback } from 'react';
import {
  useWizard,
  useWizardDispatch,
  getAllRoles,
  getActiveModules,
} from '../context/WizardContext';
import { usePluginAction } from '@paperclipai/plugin-sdk/ui';
import type { ModuleData, RoleData } from '../types';
import { Badge } from './ui/badge';
import { Card, CardContent } from './ui/card';
import { cn, toPascalCase } from '../lib/utils';
import {
  HoverCardRoot,
  HoverCardTrigger,
  HoverCardContent,
  HoverCardPortal,
} from './ui/hover-card';
import {
  Building2,
  Target,
  Blocks,
  Users,
  AlertTriangle,
  Pencil,
  Check,
  X,
  ChevronDown,
  ChevronRight,
  Cpu,
  ListChecks,
  Workflow,
  ArrowUpRight,
  Crown,
  Wrench,
  Shield,
  Layers,
  FileText,
  Loader2,
  RefreshCw,
  RotateCcw,
} from 'lucide-react';

// --- Shared helpers ---

function SummaryRow({
  icon: Icon,
  label,
  onEdit,
  children,
}: {
  icon: React.ElementType;
  label: string;
  onEdit?: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="group flex items-start gap-3 py-3">
      <Icon className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            {label}
          </p>
          {onEdit && (
            <button
              onClick={onEdit}
              className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
            >
              <Pencil className="h-3 w-3" />
            </button>
          )}
        </div>
        <div className="text-sm">{children}</div>
      </div>
    </div>
  );
}

function InlineEdit({
  value,
  onSave,
  onCancel,
  multiline,
  placeholder,
}: {
  value: string;
  onSave: (v: string) => void;
  onCancel: () => void;
  multiline?: boolean;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState(value);
  const InputTag = multiline ? 'textarea' : 'input';

  return (
    <div className="flex gap-1.5 items-start">
      <InputTag
        className={cn(
          'flex w-full rounded-md border border-input bg-transparent px-2 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
          multiline && 'min-h-[60px] resize-none',
        )}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder={placeholder}
        autoFocus
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey && !multiline) {
            e.preventDefault();
            onSave(draft);
          }
          if (e.key === 'Escape') onCancel();
        }}
      />
      <button
        onClick={() => onSave(draft)}
        className="h-7 w-7 rounded flex items-center justify-center border hover:bg-accent shrink-0"
      >
        <Check className="h-3.5 w-3.5" />
      </button>
      <button
        onClick={onCancel}
        className="h-7 w-7 rounded flex items-center justify-center border hover:bg-accent shrink-0"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// --- Detailed view components ---

function ModuleDetail({ mod, allRoleNames }: { mod: ModuleData; allRoleNames: Set<string> }) {
  const hasCapabilities = mod.capabilities && mod.capabilities.length > 0;
  const hasTasks = mod.tasks && mod.tasks.length > 0;
  const hasRequires = mod.requires && mod.requires.length > 0;
  const hasRoleGating = mod.activatesWithRoles && mod.activatesWithRoles.length > 0;
  const isGated = hasRoleGating && !mod.activatesWithRoles!.some((r) => allRoleNames.has(r));

  return (
    <div className={cn('rounded-lg border p-3 space-y-2.5', isGated && 'opacity-50')}>
      <div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{mod.name}</span>
          {isGated && (
            <Badge
              variant="outline"
              className="text-[10px] border-amber-500/40 text-amber-700 dark:text-amber-400"
            >
              inactive
            </Badge>
          )}
        </div>
        {mod.description && (
          <p className="text-xs text-muted-foreground mt-0.5">{mod.description}</p>
        )}
      </div>

      {hasRequires && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Layers className="h-3 w-3 shrink-0" />
          <span>Requires: {mod.requires!.join(', ')}</span>
        </div>
      )}

      {hasRoleGating && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Shield className="h-3 w-3 shrink-0" />
          <span>Activates with: {mod.activatesWithRoles!.join(', ')}</span>
        </div>
      )}

      {hasCapabilities && (
        <div className="space-y-1">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
            <Workflow className="h-3 w-3" /> Capabilities
          </p>
          <div className="space-y-1">
            {mod.capabilities!.map((cap) => (
              <div
                key={cap.skill}
                className="flex items-start gap-2 rounded bg-accent/50 px-2 py-1.5"
              >
                <Wrench className="h-3 w-3 mt-0.5 text-muted-foreground shrink-0" />
                <div className="text-xs">
                  <span className="font-medium">{cap.skill}</span>
                  <span className="text-muted-foreground ml-1.5">{cap.owners.join(' → ')}</span>
                  {cap.fallbackSkill && (
                    <span className="text-muted-foreground ml-1">
                      (fallback: {cap.fallbackSkill})
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {hasTasks && (
        <div className="space-y-1">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
            <ListChecks className="h-3 w-3" /> Initial tasks
          </p>
          <div className="space-y-1">
            {mod.tasks!.map((task) => (
              <div
                key={task.title}
                className="flex items-start gap-2 rounded bg-accent/50 px-2 py-1.5"
              >
                <ChevronRight className="h-3 w-3 mt-0.5 text-muted-foreground shrink-0" />
                <div className="text-xs">
                  <span className="font-medium">{task.title}</span>
                  <span className="text-muted-foreground ml-1.5">→ {task.assignTo}</span>
                  {task.description && (
                    <p className="text-muted-foreground mt-0.5">{task.description}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function RoleDetail({ role }: { role: RoleData }) {
  const adapter = role.adapter as { model?: string; effort?: string } | undefined;

  return (
    <div className="rounded-lg border p-3 space-y-2">
      <div>
        <div className="flex items-center gap-2">
          {role._base && <Crown className="h-3.5 w-3.5 text-muted-foreground" />}
          <span className="text-sm font-medium">{role.title}</span>
          <span className="text-xs text-muted-foreground">{role.name}</span>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">{role.description}</p>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {role.paperclipRole && (
          <span className="flex items-center gap-1">
            <Cpu className="h-3 w-3" />
            {role.paperclipRole}
          </span>
        )}
        {role.reportsTo && (
          <span className="flex items-center gap-1">
            <ArrowUpRight className="h-3 w-3" />
            reports to {role.reportsTo}
          </span>
        )}
        {adapter?.model && (
          <span className="flex items-center gap-1">
            <Wrench className="h-3 w-3" />
            {adapter.model}
            {adapter.effort && ` (${adapter.effort})`}
          </span>
        )}
      </div>

      {role.enhances && role.enhances.length > 0 && (
        <div className="space-y-1">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
            Enhances
          </p>
          <ul className="space-y-0.5">
            {role.enhances.map((e, i) => (
              <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                <span className="text-foreground/30 mt-px">·</span>
                {e}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// --- File preview section ---

/** Groups flat file paths by their first-level directory prefix. */
function groupFiles(files: Record<string, string>): Array<{ group: string; paths: string[] }> {
  const map = new Map<string, string[]>();
  for (const p of Object.keys(files).sort()) {
    // For agents/, group by agents/<role>/ (two levels deep)
    const parts = p.split('/');
    let group: string;
    if (parts.length >= 3 && parts[0] === 'agents') {
      group = `${parts[0]}/${parts[1]}`;
    } else {
      group = parts.length > 1 ? parts[0] : '';
    }
    if (!map.has(group)) map.set(group, []);
    map.get(group)!.push(p);
  }
  // Sort: root files first, then alphabetical groups
  const result: Array<{ group: string; paths: string[] }> = [];
  if (map.has('')) result.push({ group: '', paths: map.get('')! });
  for (const [group, paths] of map) {
    if (group !== '') result.push({ group, paths });
  }
  return result;
}

function FileEntry({
  filePath,
  content,
  override,
  onSaveOverride,
  onResetOverride,
}: {
  filePath: string;
  content: string;
  override: string | undefined;
  onSaveOverride: (content: string) => void;
  onResetOverride: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(override ?? content);
  // Show filename relative to group: for "agents/ceo/skills/foo.md" under group "agents/ceo", show "skills/foo.md"
  const parts = filePath.split('/');
  const fileName =
    parts.length >= 3 && parts[0] === 'agents' ? parts.slice(2).join('/') : parts.pop()!;
  const hasOverride = override !== undefined;

  const handleEdit = () => {
    setDraft(override ?? content);
    setEditing(true);
    setExpanded(true);
  };

  const handleSave = () => {
    onSaveOverride(draft);
    setEditing(false);
  };

  const handleCancel = () => {
    setDraft(override ?? content);
    setEditing(false);
  };

  const handleReset = () => {
    setDraft(content);
    onResetOverride();
    setEditing(false);
  };

  const displayContent = override ?? content;

  return (
    <div
      className={cn('rounded border', hasOverride && 'border-blue-400/60 dark:border-blue-500/50')}
    >
      <button
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-accent/50 transition-colors"
        onClick={() => {
          if (!editing) setExpanded((v) => !v);
        }}
      >
        <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <span className="text-xs font-medium flex-1 min-w-0 truncate">
          {fileName}
          {hasOverride && (
            <span className="ml-1.5 text-[10px] text-blue-600 dark:text-blue-400 font-normal">
              edited
            </span>
          )}
        </span>
        {!editing && (
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              handleEdit();
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.stopPropagation();
                handleEdit();
              }
            }}
            className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground p-0.5 rounded"
          >
            <Pencil className="h-3 w-3" />
          </span>
        )}
        {!editing &&
          (expanded ? (
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          ))}
      </button>

      {(expanded || editing) && (
        <div className="border-t">
          {editing ? (
            <div className="p-2 space-y-1.5">
              <textarea
                className="w-full font-mono text-xs rounded border border-input bg-transparent px-2 py-1.5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-y"
                style={{ minHeight: '200px' }}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                autoFocus
              />
              <div className="flex items-center gap-1.5">
                <button
                  onClick={handleSave}
                  className="flex items-center gap-1 text-xs px-2 py-1 rounded border hover:bg-accent"
                >
                  <Check className="h-3 w-3" /> Save
                </button>
                <button
                  onClick={handleCancel}
                  className="flex items-center gap-1 text-xs px-2 py-1 rounded border hover:bg-accent"
                >
                  <X className="h-3 w-3" /> Cancel
                </button>
                {hasOverride && (
                  <button
                    onClick={handleReset}
                    className="flex items-center gap-1 text-xs px-2 py-1 rounded border hover:bg-accent text-muted-foreground ml-auto"
                  >
                    <RotateCcw className="h-3 w-3" /> Reset to default
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="group relative">
              <pre className="p-3 font-mono text-xs overflow-x-auto whitespace-pre-wrap wrap-break-word text-muted-foreground max-h-[400px] overflow-y-auto">
                {displayContent}
              </pre>
              <button
                onClick={handleEdit}
                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 text-xs px-1.5 py-0.5 rounded border bg-background hover:bg-accent"
              >
                <Pencil className="h-3 w-3" /> Edit
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// --- Main component ---

type EditingField = 'name' | 'goal' | 'goalDesc' | 'existingCompanyId' | null;

export function ConfigReview() {
  const state = useWizard();
  const dispatch = useWizardDispatch();
  const [editing, setEditing] = useState<EditingField>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [showFiles, setShowFiles] = useState(false);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [previewFiles, setPreviewFiles] = useState<Record<string, string> | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const previewFilesAction = usePluginAction('preview-files');

  const loadPreview = useCallback(async () => {
    setLoadingFiles(true);
    setPreviewError(null);
    try {
      const result = (await previewFilesAction({
        companyName: state.companyName || 'Preview',
        presetName: state.presetName,
        selectedModules: state.selectedModules,
        selectedRoles: state.selectedRoles,
        goals: state.goals.length > 0 ? state.goals : undefined,
        projects: state.projects.length > 0 ? state.projects : undefined,
      })) as { files: Record<string, string>; error?: string };
      if (result.error) {
        setPreviewError(result.error);
        return;
      }
      setPreviewFiles(result.files);
    } catch (e) {
      setPreviewError(e instanceof Error ? e.message : 'Failed to load preview');
    } finally {
      setLoadingFiles(false);
    }
  }, [
    state.companyName,
    state.presetName,
    state.selectedModules,
    state.selectedRoles,
    state.goals,
    state.projects,
    previewFilesAction,
  ]);

  const allRoles = getAllRoles(state);
  const allRoleNames = new Set(allRoles);
  const activeModules = getActiveModules(state);
  const skippedModules = state.selectedModules.filter(
    (name) => !activeModules.some((m) => m.name === name),
  );
  const totalTasks = activeModules.reduce((sum, m) => sum + (m.tasks?.length ?? 0), 0);

  const selectedModSet = new Set(state.selectedModules);
  const selectedRoleSet = new Set(state.selectedRoles);
  const baseRoleNames = state.roles.filter((r) => r._base).map((r) => r.name);

  const activeRoleData = state.roles.filter((r) => r._base || selectedRoleSet.has(r.name));
  const selectedModuleData = state.modules.filter((m) => selectedModSet.has(m.name));

  const totalCapabilities = selectedModuleData.reduce(
    (sum, m) => sum + (m.capabilities?.length ?? 0),
    0,
  );

  const toggleModule = (name: string) => {
    const next = new Set(selectedModSet);
    if (next.has(name)) {
      const dependents = state.modules.filter(
        (m) => m.requires?.includes(name) && next.has(m.name),
      );
      if (dependents.length > 0) return;
      next.delete(name);
    } else {
      next.add(name);
      const mod = state.modules.find((m) => m.name === name);
      for (const dep of mod?.requires ?? []) next.add(dep);
    }
    dispatch({ type: 'SET_MODULES', modules: [...next] });
  };

  const toggleRole = (name: string) => {
    if (baseRoleNames.includes(name)) return;
    const next = new Set(selectedRoleSet);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    dispatch({ type: 'SET_ROLES', roles: [...next] });
  };

  return (
    <>
      <Card>
        <CardContent className="divide-y p-0">
          {/* Company name */}
          <div className="px-4">
            <SummaryRow icon={Building2} label="Company" onEdit={() => setEditing('name')}>
              {editing === 'name' ? (
                <InlineEdit
                  value={state.companyName}
                  onSave={(v) => {
                    dispatch({ type: 'SET_COMPANY_NAME', value: v });
                    setEditing(null);
                  }}
                  onCancel={() => setEditing(null)}
                  placeholder="Company name"
                />
              ) : (
                <>
                  <span className="font-medium">{state.companyName || '(unnamed)'}</span>
                  <span className="text-muted-foreground ml-2">
                    → {toPascalCase(state.companyName || 'Company')}/
                  </span>
                </>
              )}
            </SummaryRow>
          </div>

          {/* Target company */}
          <div className="px-4">
            <SummaryRow
              icon={ArrowUpRight}
              label="Target"
              onEdit={() => setEditing('existingCompanyId')}
            >
              {editing === 'existingCompanyId' ? (
                <InlineEdit
                  value={state.existingCompanyId}
                  onSave={(v) => {
                    dispatch({ type: 'SET_EXISTING_COMPANY_ID', value: v.trim() });
                    setEditing(null);
                  }}
                  onCancel={() => setEditing(null)}
                  placeholder="Leave empty to create a new company, or paste existing company ID"
                />
              ) : state.existingCompanyId ? (
                <>
                  <span className="font-medium">Existing company</span>
                  <span className="text-muted-foreground ml-2 font-mono text-xs">
                    {state.existingCompanyId}
                  </span>
                </>
              ) : (
                <span className="text-muted-foreground">Create a new company</span>
              )}
            </SummaryRow>
          </div>

          {/* Goals */}
          <div className="px-4">
            <SummaryRow icon={Target} label="Goal" onEdit={() => setEditing('goal')}>
              {editing === 'goal' ? (
                <InlineEdit
                  value={state.goals[0]?.title || ''}
                  onSave={(v) => {
                    const updated = [...state.goals];
                    if (updated.length === 0) updated.push({ title: '', description: '' });
                    updated[0] = { ...updated[0], title: v };
                    dispatch({ type: 'SET_GOALS', goals: updated });
                    setEditing('goalDesc');
                  }}
                  onCancel={() => setEditing(null)}
                  placeholder="Goal title"
                />
              ) : editing === 'goalDesc' ? (
                <div className="space-y-1">
                  <span>{state.goals[0]?.title || '(no goal)'}</span>
                  <InlineEdit
                    value={state.goals[0]?.description || ''}
                    onSave={(v) => {
                      const updated = [...state.goals];
                      if (updated.length === 0) updated.push({ title: '', description: '' });
                      updated[0] = { ...updated[0], description: v };
                      dispatch({ type: 'SET_GOALS', goals: updated });
                      setEditing(null);
                    }}
                    onCancel={() => setEditing(null)}
                    placeholder="Goal description (optional)"
                    multiline
                  />
                </div>
              ) : (
                <>
                  <span>{state.goals[0]?.title || '(no goal)'}</span>
                  {state.goals[0]?.description && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {state.goals[0].description}
                    </p>
                  )}
                  {state.goals.length > 1 && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      + {state.goals.length - 1} sub-goal{state.goals.length > 2 ? 's' : ''}
                    </p>
                  )}
                </>
              )}
            </SummaryRow>
          </div>

          {/* Modules */}
          <div className="px-4">
            <SummaryRow icon={Blocks} label={`Modules (${activeModules.length})`}>
              <div className="flex flex-wrap gap-1.5">
                {state.modules.map((m) => {
                  const isActive = selectedModSet.has(m.name);
                  return (
                    <HoverCardRoot key={m.name} openDelay={200} closeDelay={100}>
                      <HoverCardTrigger asChild>
                        <button onClick={() => toggleModule(m.name)}>
                          <Badge
                            variant={isActive ? 'secondary' : 'outline'}
                            className={cn(
                              'text-xs cursor-pointer transition-colors',
                              !isActive && 'opacity-40',
                            )}
                          >
                            {m.name}
                          </Badge>
                        </button>
                      </HoverCardTrigger>
                      <HoverCardPortal>
                        <HoverCardContent
                          side="top"
                          align="center"
                          sideOffset={6}
                          className="z-50 w-80 rounded-lg border bg-popover p-0 shadow-md animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95"
                        >
                          <ModuleDetail mod={m} allRoleNames={allRoleNames} />
                        </HoverCardContent>
                      </HoverCardPortal>
                    </HoverCardRoot>
                  );
                })}
              </div>
              {(totalTasks > 0 || totalCapabilities > 0) && (
                <p className="text-xs text-muted-foreground mt-1.5">
                  {[
                    totalTasks > 0 && `${totalTasks} initial tasks`,
                    totalCapabilities > 0 && `${totalCapabilities} capabilities`,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              )}
            </SummaryRow>
          </div>

          {/* Roles */}
          <div className="px-4">
            <SummaryRow icon={Users} label={`Team (${allRoles.length} agents)`}>
              <div className="flex flex-wrap gap-1.5">
                {state.roles.map((role) => {
                  const isBase = role._base;
                  const isActive = isBase || selectedRoleSet.has(role.name);
                  return (
                    <HoverCardRoot key={role.name} openDelay={200} closeDelay={100}>
                      <HoverCardTrigger asChild>
                        <button onClick={() => toggleRole(role.name)} disabled={isBase}>
                          <Badge
                            variant={isActive ? 'outline' : 'secondary'}
                            className={cn(
                              'text-xs transition-colors',
                              isBase && 'cursor-default',
                              !isBase && 'cursor-pointer',
                              !isActive && 'opacity-40',
                            )}
                          >
                            {role.title}
                          </Badge>
                        </button>
                      </HoverCardTrigger>
                      <HoverCardPortal>
                        <HoverCardContent
                          side="top"
                          align="center"
                          sideOffset={6}
                          className="z-50 w-80 rounded-lg border bg-popover p-0 shadow-md animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95"
                        >
                          <RoleDetail role={role} />
                        </HoverCardContent>
                      </HoverCardPortal>
                    </HoverCardRoot>
                  );
                })}
              </div>
            </SummaryRow>
          </div>
        </CardContent>
      </Card>

      {skippedModules.length > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
          <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-amber-800 dark:text-amber-200">
              {skippedModules.length} module(s) will be skipped
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
              {skippedModules.join(', ')} — missing required roles
            </p>
          </div>
        </div>
      )}

      {/* Detailed configuration toggle */}
      <button
        onClick={() => setShowDetails((v) => !v)}
        className="w-full flex items-center justify-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors py-2"
      >
        {showDetails ? (
          <ChevronDown className="h-3.5 w-3.5" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5" />
        )}
        {showDetails ? 'Hide' : 'Show'} detailed configuration
        <span className="text-muted-foreground/60">
          ({activeRoleData.length} roles · {selectedModuleData.length} modules · {totalCapabilities}{' '}
          capabilities)
        </span>
      </button>

      {/* Generated files preview */}
      <button
        onClick={() => {
          const next = !showFiles;
          setShowFiles(next);
          if (next && !previewFiles && !loadingFiles) loadPreview();
        }}
        className="w-full flex items-center justify-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors py-2"
      >
        {showFiles ? (
          <ChevronDown className="h-3.5 w-3.5" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5" />
        )}
        {showFiles ? 'Hide' : 'Preview'} generated files
        {previewFiles && (
          <span className="text-muted-foreground/60">
            ({Object.keys(previewFiles).length} files
            {Object.keys(state.fileOverrides).length > 0 &&
              ` · ${Object.keys(state.fileOverrides).length} edited`}
            )
          </span>
        )}
      </button>

      {showFiles && (
        <div className="space-y-3">
          {loadingFiles && (
            <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Assembling preview...
            </div>
          )}

          {previewError && !loadingFiles && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
              <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Preview failed</p>
                <p className="text-xs text-muted-foreground mt-0.5">{previewError}</p>
              </div>
            </div>
          )}

          {previewFiles && !loadingFiles && (
            <>
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  Click a file to expand. Use the edit button to override its content before
                  provisioning.
                </p>
                <button
                  onClick={loadPreview}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <RefreshCw className="h-3 w-3" />
                  Refresh
                </button>
              </div>

              {groupFiles(previewFiles).map(({ group, paths }) => (
                <div key={group || '_root'} className="space-y-1">
                  {group && (
                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-0.5">
                      {group}/
                    </p>
                  )}
                  <div className="space-y-1">
                    {paths.map((filePath) => (
                      <FileEntry
                        key={filePath}
                        filePath={filePath}
                        content={previewFiles[filePath]}
                        override={state.fileOverrides[filePath]}
                        onSaveOverride={(content) =>
                          dispatch({ type: 'SET_FILE_OVERRIDE', path: filePath, content })
                        }
                        onResetOverride={() =>
                          dispatch({ type: 'DELETE_FILE_OVERRIDE', path: filePath })
                        }
                      />
                    ))}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {showDetails && (
        <div className="space-y-6">
          {/* Preset info */}
          {state.presetName &&
            state.presetName !== 'custom' &&
            (() => {
              const preset = state.presets.find((p) => p.name === state.presetName);
              if (!preset) return null;
              return (
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                    Preset
                  </p>
                  <Card>
                    <CardContent className="p-3 space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium capitalize">{preset.name}</span>
                        {preset.base && (
                          <Badge variant="outline" className="text-[10px]">
                            extends {preset.base}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{preset.description}</p>
                      {preset.constraints && preset.constraints.length > 0 && (
                        <div className="flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-300 mt-1">
                          <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" />
                          <span>{preset.constraints.join(' · ')}</span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              );
            })()}

          {/* Detailed roles */}
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
              Team — {activeRoleData.length} agents
            </p>
            <div className="grid gap-2">
              {activeRoleData.map((role) => (
                <RoleDetail key={role.name} role={role} />
              ))}
            </div>
          </div>

          {/* Detailed modules */}
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
              Modules — {selectedModuleData.length} active
            </p>
            <div className="grid gap-2">
              {selectedModuleData.map((mod) => (
                <ModuleDetail key={mod.name} mod={mod} allRoleNames={allRoleNames} />
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
