import { useState, useRef, useEffect } from 'react';
import { usePluginAction } from '@paperclipai/plugin-sdk/ui';
import { useWizard, useWizardDispatch } from '../../context/WizardContext';
import { Button } from '../ui/button';
import { ConfigReview } from '../ConfigReview';
import { cn } from '../../lib/utils';
import {
  Sparkles,
  Loader2,
  Send,
  User,
  RotateCcw,
  Zap,
  MessageSquare,
  Settings2,
  ClipboardCheck,
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
} from 'lucide-react';
import interviewSystemPrompt from '../../prompts/interview-system.md?raw';
import singleShotSystemPrompt from '../../prompts/single-shot-system.md?raw';
import promptMessages from '../../prompts/messages.json';
import EXAMPLE_PROMPTS from '../../prompts/examples.json';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

type InterviewPhase = 'describe' | 'interview' | 'configuring' | 'review';

const LOADING_MESSAGES = [
  'Understanding your vision...',
  'Analyzing requirements...',
  'Thinking about team structure...',
  'Considering the best approach...',
  'Evaluating module combinations...',
];

const CONFIG_STEPS = [
  'Selecting strategy preset',
  'Choosing capability modules',
  'Assembling agent team',
  'Defining company goal',
  'Finalizing configuration',
];

function PhaseIndicator({
  phase,
  questionCount,
}: {
  phase: InterviewPhase;
  questionCount: number;
}) {
  const phases = [
    { key: 'describe', icon: Zap, label: 'Describe' },
    { key: 'interview', icon: MessageSquare, label: 'Interview' },
    { key: 'configuring', icon: Settings2, label: 'Configure' },
    { key: 'review', icon: ClipboardCheck, label: 'Review' },
  ] as const;

  const phaseKeys = phases.map((p) => p.key);
  const activeIdx = phaseKeys.indexOf(phase);

  return (
    <div className="flex items-center gap-1">
      {phases.map((p, i) => {
        const Icon = p.icon;
        const isActive = i === activeIdx;
        const isDone = i < activeIdx;
        return (
          <div key={p.key} className="flex items-center gap-1">
            {i > 0 && <div className={cn('w-6 h-px', isDone ? 'bg-foreground' : 'bg-border')} />}
            <div
              className={cn(
                'flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium transition-all duration-300',
                isActive && 'bg-foreground text-background',
                isDone && 'bg-foreground/10 text-foreground',
                !isActive && !isDone && 'text-muted-foreground',
              )}
            >
              {isDone ? (
                <CheckCircle2 className="h-3 w-3" />
              ) : (
                <Icon className={cn('h-3 w-3', isActive && 'animate-pulse')} />
              )}
              <span className="hidden sm:inline">{p.label}</span>
              {p.key === 'interview' && isActive && questionCount > 0 && (
                <span className="text-[10px] opacity-70">{questionCount}/3</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ConfiguringAnimation({ ready, onDone }: { ready: boolean; onDone: () => void }) {
  const [step, setStep] = useState(0);
  const [animDone, setAnimDone] = useState(false);

  useEffect(() => {
    if (step < CONFIG_STEPS.length) {
      const timer = setTimeout(() => setStep((s) => s + 1), 600);
      return () => clearTimeout(timer);
    } else {
      setAnimDone(true);
    }
  }, [step]);

  // Proceed when both animation is done AND config is ready
  useEffect(() => {
    if (animDone && ready) {
      const timer = setTimeout(onDone, 300);
      return () => clearTimeout(timer);
    }
  }, [animDone, ready, onDone]);

  const allStepsDone = step >= CONFIG_STEPS.length;

  return (
    <div className="flex flex-col items-center justify-center py-12 space-y-6">
      <div className="relative">
        <div className="h-12 w-12 rounded-full bg-foreground/5 flex items-center justify-center">
          <Sparkles className="h-6 w-6 text-foreground animate-pulse" />
        </div>
        <div className="absolute inset-0 rounded-full border-2 border-foreground/20 animate-ping" />
      </div>
      <div className="space-y-2 w-full max-w-xs">
        {CONFIG_STEPS.map((label, i) => (
          <div
            key={label}
            className={cn(
              'flex items-center gap-2.5 text-sm transition-all duration-300',
              i < step && 'text-foreground',
              i === step && 'text-foreground',
              i > step && 'text-muted-foreground/40',
            )}
          >
            <div className="w-4 flex justify-center">
              {i < step ? (
                <CheckCircle2 className="h-3.5 w-3.5" />
              ) : i === step ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <div className="h-1.5 w-1.5 rounded-full bg-current" />
              )}
            </div>
            {label}
          </div>
        ))}
      </div>
      {allStepsDone && !ready && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Waiting for AI response...
        </div>
      )}
    </div>
  );
}

export function StepAiWizard() {
  const state = useWizard();
  const dispatch = useWizardDispatch();
  const aiChat = usePluginAction('ai-chat');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState<InterviewPhase>('describe');
  const [questionCount, setQuestionCount] = useState(0);
  const [loadingMsg, setLoadingMsg] = useState(LOADING_MESSAGES[0]);
  const [configReady, setConfigReady] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const pendingConfigRef = useRef<Record<string, unknown> | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

  useEffect(() => {
    if (!loading && phase === 'interview') {
      inputRef.current?.focus();
    }
  }, [loading, phase]);

  useEffect(() => {
    if (!loading) return;
    const interval = setInterval(() => {
      setLoadingMsg(LOADING_MESSAGES[Math.floor(Math.random() * LOADING_MESSAGES.length)]);
    }, 2000);
    return () => clearInterval(interval);
  }, [loading]);

  const buildCatalog = () => {
    return [
      '## Available Presets',
      ...state.presets.map(
        (p) => `- **${p.name}**: ${p.description} (modules: ${p.modules?.join(', ')})`,
      ),
      '',
      '## Available Modules',
      ...state.modules.map((m) => `- **${m.name}**: ${m.description}`),
      '',
      '## Available Extra Roles',
      ...state.roles
        .filter((r) => !r._base)
        .map((r) => `- **${r.name}** (${r.title}): ${r.description}`),
      '',
      '## Base Roles (always included)',
      ...state.roles
        .filter((r) => r._base)
        .map((r) => `- **${r.name}** (${r.title}): ${r.description}`),
    ].join('\n');
  };

  const systemPrompt = interviewSystemPrompt
    .replace('{{CATALOG}}', buildCatalog())
    .replace('{{CONFIG_FORMAT}}', promptMessages.configFormat);

  const singleShotPrompt = singleShotSystemPrompt
    .replace('{{CATALOG}}', buildCatalog())
    .replace('{{CONFIG_FORMAT}}', promptMessages.configFormat);

  const callApi = async (allMessages: Message[], system?: string): Promise<string> => {
    const result = (await aiChat({
      messages: allMessages.map((m) => ({ role: m.role, content: m.content })),
      system: system || systemPrompt,
    })) as { text: string };
    return result.text;
  };

  const tryExtractConfig = (text: string) => {
    // Extract all top-level JSON objects by tracking brace depth
    const candidates: string[] = [];
    let depth = 0;
    let start = -1;
    for (let i = 0; i < text.length; i++) {
      if (text[i] === '{') {
        if (depth === 0) start = i;
        depth++;
      } else if (text[i] === '}') {
        depth--;
        if (depth === 0 && start !== -1) {
          candidates.push(text.slice(start, i + 1));
          start = -1;
        }
      }
    }
    for (const candidate of candidates) {
      try {
        const config = JSON.parse(candidate);
        if (config.name && config.preset) return config;
      } catch {
        // not valid JSON, try next
      }
    }
    return null;
  };

  const startInterview = async (description?: string) => {
    const desc = description || state.aiDescription;
    if (!desc.trim()) return;

    if (description) {
      dispatch({ type: 'SET_AI_DESCRIPTION', value: description });
    }
    dispatch({ type: 'SET_ERROR', error: null });

    setPhase('interview');
    setLoading(true);

    try {
      const startMessages: Message[] = [
        { role: 'user', content: promptMessages.interviewStart.replace('{{DESCRIPTION}}', desc) },
      ];
      const reply = await callApi(startMessages);
      setMessages([startMessages[0], { role: 'assistant', content: reply }]);
      setQuestionCount(1);
    } catch (err) {
      dispatch({
        type: 'SET_ERROR',
        error: err instanceof Error ? err.message : 'AI wizard failed',
      });
      setPhase('describe');
    } finally {
      setLoading(false);
    }
  };

  const quickGenerate = async (description?: string) => {
    const desc = description || state.aiDescription;
    if (!desc.trim()) return;

    if (description) {
      dispatch({ type: 'SET_AI_DESCRIPTION', value: description });
    }
    dispatch({ type: 'SET_ERROR', error: null });

    setConfigReady(false);
    setPhase('configuring');

    try {
      const reply = await callApi(
        [{ role: 'user', content: promptMessages.singleShot.replace('{{DESCRIPTION}}', desc) }],
        singleShotPrompt,
      );
      const config = tryExtractConfig(reply);
      if (config) {
        pendingConfigRef.current = config;
        setConfigReady(true);
      } else {
        throw new Error('Could not parse configuration from AI response');
      }
    } catch (err) {
      dispatch({
        type: 'SET_ERROR',
        error: err instanceof Error ? err.message : 'AI wizard failed',
      });
      setPhase('describe');
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMsg: Message = { role: 'user', content: input };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    try {
      const reply = await callApi(newMessages);
      const allMessages = [...newMessages, { role: 'assistant' as const, content: reply }];
      setMessages(allMessages);
      setQuestionCount((c) => c + 1);

      const config = tryExtractConfig(reply);
      if (config) {
        pendingConfigRef.current = config;
        setConfigReady(true);
        setPhase('configuring');
      }
    } catch (err) {
      dispatch({
        type: 'SET_ERROR',
        error: err instanceof Error ? err.message : 'AI wizard failed',
      });
    } finally {
      setLoading(false);
    }
  };

  const requestConfig = async () => {
    // Immediately show the configuring animation — API call runs behind it
    setConfigReady(false);
    setPhase('configuring');

    const apiMessages: Message[] = [
      ...messages,
      { role: 'user', content: promptMessages.generateConfig },
    ];

    try {
      const reply = await callApi(apiMessages);
      const config = tryExtractConfig(reply);
      if (config) {
        pendingConfigRef.current = config;
        setConfigReady(true);
      } else {
        throw new Error('Could not parse configuration from AI response');
      }
    } catch (err) {
      dispatch({
        type: 'SET_ERROR',
        error: err instanceof Error ? err.message : 'AI wizard failed',
      });
      setPhase('interview');
    }
  };

  const applyConfigToState = () => {
    const config = pendingConfigRef.current;
    if (!config) return;

    const validModules = ((config.modules as string[]) || []).filter((m: string) =>
      state.modules.some((mod) => mod.name === m),
    );
    const validRoles = ((config.roles as string[]) || []).filter((r: string) =>
      state.roles.some((role) => role.name === r),
    );

    // Apply config to wizard state but stay on ai-wizard step
    dispatch({
      type: 'APPLY_AI_RESULT',
      result: {
        companyName: (config.name as string) || state.aiDescription.slice(0, 30),
        goal: {
          title: (config.goal as string) || '',
          description: (config.goalDescription as string) || '',
        },
        presetName: state.presets.some((p) => p.name === config.preset)
          ? (config.preset as string)
          : 'custom',
        selectedModules: validModules,
        selectedRoles: validRoles,
        aiExplanation: (config.explanation as string) || (config.reasoning as string) || '',
        step: 'ai-wizard' as const,
      },
    });
    setPhase('review');
  };

  const resetInterview = () => {
    setMessages([]);
    setPhase('describe');
    setQuestionCount(0);
    setInput('');
    setConfigReady(false);
    pendingConfigRef.current = null;
  };

  // --- Describe phase ---
  if (phase === 'describe') {
    return (
      <div className="space-y-6">
        <div className="space-y-3">
          <PhaseIndicator phase={phase} questionCount={questionCount} />
          <div>
            <h2 className="text-xl font-semibold tracking-tight">What are you building?</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Describe your company or idea. Our AI will interview you and assemble the perfect
              agent team.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <textarea
            className="flex min-h-[120px] w-full rounded-lg border border-input bg-transparent px-3 py-2.5 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
            placeholder="Describe your company, product, or idea..."
            value={state.aiDescription}
            onChange={(e) => dispatch({ type: 'SET_AI_DESCRIPTION', value: e.target.value })}
            autoFocus
          />

          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground">Try an example:</p>
            <div className="flex flex-wrap gap-1.5">
              {EXAMPLE_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => {
                    dispatch({ type: 'SET_AI_DESCRIPTION', value: prompt });
                    startInterview(prompt);
                  }}
                  className="text-xs px-2.5 py-1 rounded-full border border-border hover:border-foreground/20 hover:bg-accent/50 text-muted-foreground hover:text-foreground transition-colors text-left"
                >
                  {prompt.length > 60 ? prompt.slice(0, 57) + '...' : prompt}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => dispatch({ type: 'GO_TO', step: 'onboarding' })}>
            Back
          </Button>
          <Button
            variant="outline"
            onClick={() => quickGenerate()}
            disabled={!state.aiDescription.trim()}
          >
            <Zap className="h-4 w-4" />
            Quick generate
          </Button>
          <Button onClick={() => startInterview()} disabled={!state.aiDescription.trim()}>
            <MessageSquare className="h-4 w-4" />
            Interview
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    );
  }

  // --- Configuring animation ---
  if (phase === 'configuring') {
    return (
      <div className="space-y-6">
        <PhaseIndicator phase={phase} questionCount={questionCount} />
        <ConfiguringAnimation ready={configReady} onDone={applyConfigToState} />
      </div>
    );
  }

  // --- Review phase (inline, stays in AI wizard) ---
  if (phase === 'review') {
    return (
      <div className="space-y-6">
        <div className="space-y-3">
          <PhaseIndicator phase={phase} questionCount={questionCount} />
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Review configuration</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Here's what the AI assembled. Adjust anything, then create your company.
            </p>
          </div>
        </div>

        {state.aiExplanation && (
          <div className="rounded-lg border border-foreground/10 bg-accent/50 px-4 py-3">
            <p className="text-sm text-foreground/80 leading-relaxed">{state.aiExplanation}</p>
          </div>
        )}

        <ConfigReview />

        <div className="flex justify-between">
          <Button
            variant="outline"
            onClick={() => setPhase(messages.length > 0 ? 'interview' : 'describe')}
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            {messages.length > 0 ? 'Back to interview' : 'Back'}
          </Button>
          <Button onClick={() => dispatch({ type: 'GO_TO', step: 'provision' })}>
            <Sparkles className="h-4 w-4" />
            Create Company
          </Button>
        </div>
      </div>
    );
  }

  // --- Interview chat phase ---
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <PhaseIndicator phase={phase} questionCount={questionCount} />
        <Button
          variant="ghost"
          size="sm"
          onClick={resetInterview}
          className="text-muted-foreground"
        >
          <RotateCcw className="h-3 w-3" />
          Reset
        </Button>
      </div>

      {/* Chat messages */}
      <div
        ref={scrollRef}
        className="space-y-4 max-h-[420px] overflow-y-auto rounded-lg border bg-accent/20 p-4"
      >
        {messages.map((msg, i) => (
          <div
            key={i}
            className={cn('flex gap-2.5 items-start', msg.role === 'user' && 'flex-row-reverse')}
          >
            <div
              className={cn(
                'h-7 w-7 rounded-full flex items-center justify-center shrink-0',
                msg.role === 'user'
                  ? 'bg-foreground text-background'
                  : 'bg-background border border-border',
              )}
            >
              {msg.role === 'user' ? (
                <User className="h-3.5 w-3.5" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
            </div>
            <div
              className={cn(
                'rounded-lg px-3 py-2 max-w-[85%]',
                msg.role === 'user'
                  ? 'bg-foreground text-background'
                  : 'bg-background border border-border',
              )}
            >
              <div className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</div>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex gap-2.5 items-start">
            <div className="h-7 w-7 rounded-full flex items-center justify-center shrink-0 bg-background border border-border">
              <Sparkles className="h-3.5 w-3.5 animate-pulse" />
            </div>
            <div className="rounded-lg px-3 py-2 bg-background border border-border">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {loadingMsg}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Generate CTA — always visible, emphasized after 3 questions */}
      {!loading && (
        <button
          onClick={requestConfig}
          className={cn(
            'w-full flex items-center justify-center gap-2 rounded-lg border-2 border-dashed py-3 text-sm font-medium transition-colors',
            questionCount >= 3
              ? 'border-foreground/30 hover:border-foreground/50 hover:bg-accent/50'
              : 'border-border hover:border-foreground/20 hover:bg-accent/30 text-muted-foreground',
          )}
        >
          <Sparkles className="h-4 w-4" />
          {questionCount >= 3 ? 'Generate configuration' : 'Skip — generate now'}
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      )}

      {/* Input area */}
      <div className="flex gap-2">
        <input
          ref={inputRef}
          type="text"
          className="flex h-9 flex-1 rounded-lg border border-input bg-transparent px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          placeholder="Type your answer..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
          disabled={loading}
          autoFocus
        />
        <Button
          size="sm"
          onClick={sendMessage}
          disabled={!input.trim() || loading}
          className="rounded-lg"
        >
          <Send className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
