/**
 * AI Wizard — analyze a natural language company description
 * and select the best Clipper configuration via Claude.
 *
 * Two modes:
 * - Single-shot: `aiWizard({ description: "..." })` — one API call
 * - Interview: `aiWizardInterview({ ... })` — guided Q&A with summary + recommendation
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createInterface } from "node:readline";

// ── Prompt loading ──────────────────────────────────────────────────

function loadPromptFile(templatesDir, filename) {
  return readFileSync(join(templatesDir, "ai-wizard", filename), "utf-8").trim();
}

function loadMessages(templatesDir) {
  return JSON.parse(
    readFileSync(join(templatesDir, "ai-wizard", "messages.json"), "utf-8")
  );
}

function renderTemplate(template, vars) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? "");
}

// ── Shared ──────────────────────────────────────────────────────────

function buildCatalog(presets, modules, roles) {
  const presetCatalog = presets
    .map(
      (p) =>
        `- **${p.name}**: ${p.description}` +
        (p.modules?.length ? `\n  Modules: ${p.modules.join(", ")}` : "") +
        (p.roles?.length ? `\n  Roles: ${p.roles.join(", ")}` : "") +
        (p.constraints?.length
          ? `\n  Constraints: ${p.constraints.join("; ")}`
          : "")
    )
    .join("\n");

  const moduleCatalog = modules
    .map((m) => `- **${m.name}**: ${m.description || "(no description)"}`)
    .join("\n");

  const roleCatalog = roles
    .map((r) => `- **${r.name}** (${r.title}): ${r.description}`)
    .join("\n");

  return { presetCatalog, moduleCatalog, roleCatalog };
}

function getApiKey(opts) {
  const apiKey = opts.apiKey || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY environment variable is required for --ai mode.\n" +
        "Set it with: export ANTHROPIC_API_KEY=sk-ant-..."
    );
  }
  return apiKey;
}

async function callClaude({ apiKey, model, system, messages, maxTokens = 1024 }) {
  let response;
  try {
    response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        messages,
        system,
      }),
    });
  } catch (err) {
    throw new Error(`Network error: ${err.message}`);
  }

  if (!response.ok) {
    const body = await response.text();
    let detail = body;
    try {
      const parsed = JSON.parse(body);
      detail = parsed.error?.message || body;
    } catch {}
    if (response.status === 401) {
      throw new Error("Invalid API key. Check your ANTHROPIC_API_KEY.");
    }
    if (response.status === 429) {
      throw new Error("Rate limited by Anthropic API. Wait a moment and try again.");
    }
    if (response.status === 529) {
      throw new Error("Anthropic API is overloaded. Try again shortly.");
    }
    throw new Error(`Anthropic API error (${response.status}): ${detail}`);
  }

  const data = await response.json();

  if (data.stop_reason === "refusal") {
    throw new Error(
      "Claude declined to respond — your description may have triggered a safety filter. Try rephrasing."
    );
  }

  const text = data.content?.[0]?.text;
  if (!text) {
    const reason = data.stop_reason || "unknown";
    throw new Error(
      `Empty response from Anthropic API (stop_reason: ${reason}, model: ${model})`
    );
  }
  return text;
}

const RETRYABLE = /network error|rate limited|overloaded/i;

async function callClaudeWithRetry(opts, { log, retries = 2, delay = 3000 } = {}) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await callClaude(opts);
    } catch (err) {
      if (attempt < retries && RETRYABLE.test(err.message)) {
        if (log) log(`  ${DIM}⚠ ${err.message} — retrying in ${delay / 1000}s...${RESET}`);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      throw err;
    }
  }
}

/**
 * Wraps callClaudeWithRetry for interactive use — on failure, shows the error
 * and lets the user edit their last message or quit. Returns null if user quits.
 */
async function callClaudeInteractive(claudeOpts, { log, rl, messages }) {
  while (true) {
    try {
      return await callClaudeWithRetry(claudeOpts, { log });
    } catch (err) {
      log("");
      log(`  ${"\x1b[31m"}✗${RESET} ${err.message}`);
      log("");

      // Let user revise their last input or quit
      const lastUserIdx = messages.findLastIndex((m) => m.role === "user");
      if (lastUserIdx >= 0) {
        log(`  ${DIM}Revise your last answer, or type "q" to quit.${RESET}`);
        log("");
        const revised = await ask(rl, "  → ");
        if (revised.toLowerCase() === "q" || revised.toLowerCase() === "quit") {
          return null;
        }
        messages[lastUserIdx].content = revised;
        continue;
      }
      // No user message to revise — rethrow
      throw err;
    }
  }
}

function parseConfigJson(text) {
  // Extract JSON from text that may contain prose before/after
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error(`No JSON object found in AI response: ${text}`);
  }
  const cleaned = jsonMatch[0].trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    throw new Error(`Failed to parse AI response as JSON: ${cleaned}`);
  }
}

function normalizeResult(result) {
  return {
    name: result.name || "NewCompany",
    goal: result.goal || "",
    goalDescription: result.goalDescription || "",
    preset: result.preset || "fast",
    modules: result.extraModules || [],
    roles: result.extraRoles || [],
    reasoning: result.reasoning || "",
  };
}

// ── Single-shot mode ────────────────────────────────────────────────

/**
 * @param {object} opts
 * @param {string} opts.description - Natural language company description
 * @param {object[]} opts.presets
 * @param {object[]} opts.modules
 * @param {object[]} opts.roles - Non-base roles only
 * @param {string} opts.templatesDir
 * @param {string} [opts.apiKey]
 * @param {string} [opts.model]
 */
export async function aiWizard(opts) {
  const apiKey = getApiKey(opts);
  const model = opts.model || "claude-opus-4-6";
  const { presetCatalog, moduleCatalog, roleCatalog } = buildCatalog(
    opts.presets, opts.modules, opts.roles
  );

  const configFormat = loadPromptFile(opts.templatesDir, "config-format.md");
  const systemTemplate = loadPromptFile(opts.templatesDir, "single-shot-system.md");

  const system = renderTemplate(systemTemplate, {
    PRESET_CATALOG: presetCatalog,
    MODULE_CATALOG: moduleCatalog,
    ROLE_CATALOG: roleCatalog,
    CONFIG_FORMAT: configFormat,
  });

  printHeader(console.log);
  printSpinner(console.log, "Analyzing your description...");
  console.log("");

  const text = await callClaudeWithRetry({
    apiKey,
    model,
    system,
    messages: [{ role: "user", content: opts.description }],
  }, { log: console.log });

  return normalizeResult(parseConfigJson(text));
}

// ── Interview mode ──────────────────────────────────────────────────

const MAGENTA = "\x1b[35m";
const CYAN = "\x1b[36m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const BG_HIGHLIGHT = "\x1b[48;5;236m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const RESET = "\x1b[0m";
const CLEAR_LINE = "\x1b[2K";

function printHeader(log) {
  log("");
  log(`  ${BOLD}${MAGENTA}Clipper${RESET} ${DIM}— Bootstrap a Paperclip company${RESET}`);
  log("");
}

function printSpinner(log, text) {
  log(`  ${DIM}◌${RESET} ${text}`);
}

function printDone(log, text) {
  log(`  ${GREEN}●${RESET} ${text}`);
}

function renderMarkdown(text) {
  return text
    .replace(/\*\*(.+?)\*\*/g, `${BOLD}$1${RESET}`)
    .replace(/\*(.+?)\*/g, `\x1b[3m$1${RESET}`)
    .replace(/`(.+?)`/g, `${CYAN}$1${RESET}`);
}

function ask(rl, question) {
  return new Promise((resolve) => {
    // BG_HIGHLIGHT on the prompt line for live highlighting.
    // The trailing RESET stops the background from bleeding into wrapped lines.
    rl.question(`${BG_HIGHLIGHT}${CLEAR_LINE}${DIM}${question}${RESET}${BG_HIGHLIGHT}${BOLD}`, (answer) => {
      // Reset background immediately so it doesn't bleed further
      process.stdout.write(RESET);
      // Strip any control chars / rich-text artifacts from pasted input
      const cleanAnswer = answer.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, "");
      const cols = process.stdout.columns || 80;
      const fullText = `${question}${cleanAnswer}`;

      // How many visual lines did the input + prompt occupy?
      const inputLines = Math.ceil(fullText.length / cols) || 1;

      // Move up over all lines, clear them
      let redraw = "";
      for (let l = 0; l < inputLines; l++) {
        redraw += `\x1b[A${CLEAR_LINE}`;
      }

      // Redraw with background fill on every visual line
      for (let offset = 0; offset < fullText.length; offset += cols) {
        if (offset === 0) {
          // First line: dim prompt + bold answer
          const answerStart = cleanAnswer.slice(0, cols - question.length);
          const pad = " ".repeat(Math.max(0, cols - question.length - answerStart.length));
          redraw += `${BG_HIGHLIGHT}${DIM}${question}${RESET}${BG_HIGHLIGHT}${BOLD}${answerStart}${pad}${RESET}\n`;
        } else {
          const answerChunk = fullText.slice(offset, offset + cols);
          const chunkPad = " ".repeat(Math.max(0, cols - answerChunk.length));
          redraw += `${BG_HIGHLIGHT}${BOLD}${answerChunk}${chunkPad}${RESET}\n`;
        }
      }

      // Clear the leftover Enter line, then move back up
      redraw += `${CLEAR_LINE}\x1b[A\n`;
      process.stdout.write(redraw);
      resolve(cleanAnswer.trim());
    });
  });
}

function buildInterviewSystem(templatesDir, presetCatalog, moduleCatalog, roleCatalog) {
  const configFormat = loadPromptFile(templatesDir, "config-format.md");
  const systemTemplate = loadPromptFile(templatesDir, "interview-system.md");

  return renderTemplate(systemTemplate, {
    PRESET_CATALOG: presetCatalog,
    MODULE_CATALOG: moduleCatalog,
    ROLE_CATALOG: roleCatalog,
    CONFIG_FORMAT: configFormat,
  });
}

/**
 * @param {object} opts
 * @param {object[]} opts.presets
 * @param {object[]} opts.modules
 * @param {object[]} opts.roles - Non-base roles only
 * @param {string} opts.templatesDir
 * @param {string} [opts.apiKey]
 * @param {string} [opts.model]
 * @param {(msg: string) => void} [opts.log] - Output function
 * @returns {Promise<{name, goal, goalDescription, preset, modules, roles, reasoning} | null>}
 *   null if user exits without confirming
 */
export async function aiWizardInterview(opts) {
  const apiKey = getApiKey(opts);
  const model = opts.model || "claude-opus-4-6";
  const log = opts.log || console.log;
  const { presetCatalog, moduleCatalog, roleCatalog } = buildCatalog(
    opts.presets, opts.modules, opts.roles
  );

  const system = buildInterviewSystem(opts.templatesDir, presetCatalog, moduleCatalog, roleCatalog);
  const msgs = loadMessages(opts.templatesDir);

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const messages = [];

  try {
    // ── Header ─────────────────────────────────────────────────────
    printHeader(log);
    log(`  ${CYAN}${BOLD}AI Wizard${RESET} ${DIM}— guided setup${RESET}`);
    log(`  ${DIM}Answer a few questions, then review the AI's recommendation.${RESET}`);
    log(`  ${DIM}Tip: override any choice with flags (--name, --preset, --modules)${RESET}`);

    // ── Main loop: questions → summary → recommendation → decision
    let round = 1;
    let needQuestions = true;

    while (true) {
      // ── Phase 1: Question rounds ────────────────────────────────
      if (needQuestions) {
        log("");
        if (round > 1) {
          log(`  ${YELLOW}↻${RESET} ${DIM}Round ${round} — let's refine...${RESET}`);
        }

        for (let i = 0; i < 3; i++) {
          const questionNum = (round - 1) * 3 + i + 1;

          if (messages.length === 0) {
            messages.push({
              role: "user",
              content: msgs.interviewStart,
            });
          }

          const question = await callClaudeInteractive({
            apiKey,
            model,
            system,
            messages,
            maxTokens: 256,
          }, { log, rl, messages });

          if (question === null) return null;
          messages.push({ role: "assistant", content: question });

          log("");
          log(`  ${CYAN}${questionNum}.${RESET} ${renderMarkdown(question)}`);
          log("");

          const answer = await ask(rl, "  → ");
          messages.push({ role: "user", content: answer });
        }

        // ── Phase 2: Summary ────────────────────────────────────
        messages.push({
          role: "user",
          content: msgs.summaryRequest,
        });

        const lastAnswer = messages[messages.length - 2].content;
        messages.pop();
        messages.pop();
        messages.push({
          role: "user",
          content: `${lastAnswer}\n\n---\n${msgs.summaryRequest}`,
        });

        log("");
        printSpinner(log, "Summarizing...");

        const summary = await callClaudeInteractive({
          apiKey,
          model,
          system,
          messages,
          maxTokens: 512,
        }, { log, rl, messages });

        if (summary === null) return null;
        messages.push({ role: "assistant", content: summary });

        log("");
        for (const line of renderMarkdown(summary).split("\n")) {
          log(`  ${line}`);
        }
        log("");

        const confirm = await ask(rl, "  Correct? (y/n) → ");

        if (!confirm.toLowerCase().startsWith("y")) {
          messages.push({
            role: "user",
            content: msgs.iterateRequest,
          });
          round++;
          continue;
        }
      }

      needQuestions = true; // reset for next iteration

      // ── Phase 3: Recommendation ─────────────────────────────────
      messages.push({
        role: "user",
        content: `${msgs.recommendationRequest}\n\n${loadPromptFile(opts.templatesDir, "config-format.md")}`,
      });

      log("");
      printSpinner(log, "Generating recommendation...");

      const recommendationText = await callClaudeInteractive({
        apiKey,
        model,
        system,
        messages,
        maxTokens: 2048,
      }, { log, rl, messages });

      if (recommendationText === null) return null;
      messages.push({ role: "assistant", content: recommendationText });

      const jsonStart = recommendationText.indexOf("{");
      const prose = jsonStart > 0
        ? renderMarkdown(recommendationText.slice(0, jsonStart).trim())
        : "";

      if (prose) {
        log("");
        for (const line of prose.split("\n")) {
          log(`  ${line}`);
        }
      }

      const result = normalizeResult(parseConfigJson(recommendationText));

      // Show the parsed config with dynamic width
      const rows = [
        [`${BOLD}Company${RESET}`, result.name],
        [`${BOLD}Preset${RESET}`, result.preset],
      ];
      if (result.modules.length) {
        rows.push([`${CYAN}Modules${RESET}`, result.modules.join(", ")]);
      }
      if (result.roles.length) {
        rows.push([`${CYAN}Roles${RESET}`, result.roles.join(", ")]);
      }
      rows.push([`${DIM}Goal${RESET}`, result.goal]);

      const stripAnsi = (s) => s.replace(/\x1b\[[0-9;]*m/g, "");
      const labelWidth = 10;
      const maxValueLen = Math.max(...rows.map(([, v]) => v.length));
      const W = Math.max(labelWidth + maxValueLen + 4, 30);

      log("");
      log(`  ${DIM}┌${"─".repeat(W)}┐${RESET}`);
      for (const [label, value] of rows) {
        const visualLen = stripAnsi(label).length;
        const pad = " ".repeat(labelWidth - visualLen);
        log(`  ${DIM}│${RESET}  ${label}${pad}${value.padEnd(W - labelWidth - 2)}${DIM}│${RESET}`);
      }
      log(`  ${DIM}└${"─".repeat(W)}┘${RESET}`);
      log("");

      // ── Phase 4: Decision ───────────────────────────────────────
      log(`  ${DIM}c${RESET} continue  ${DIM}│${RESET}  ${DIM}i${RESET} iterate  ${DIM}│${RESET}  ${DIM}r${RESET} restart  ${DIM}│${RESET}  ${DIM}q${RESET} quit`);
      log("");
      const decision = await ask(rl, "  → ");
      const choice = decision.toLowerCase();

      if (choice === "q" || choice === "quit") {
        log("");
        log(`  ${DIM}Aborted — no files were created.${RESET}`);
        return null;
      }

      if (choice === "r" || choice === "restart") {
        messages.length = 0;
        round = 1;
        log("");
        log(`  ${YELLOW}↻${RESET} Starting over...`);
        continue;
      }

      if (choice === "i" || choice === "iterate") {
        messages.push({
          role: "user",
          content: msgs.iterateRequest,
        });
        round++;
        continue;
      }

      // Default: continue (c, enter, or anything else)
      log("");
      printDone(log, "Configuration accepted");

      return result;
    }
  } finally {
    rl.close();
  }
}
