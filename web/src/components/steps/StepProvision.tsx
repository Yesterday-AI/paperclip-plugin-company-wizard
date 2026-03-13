import { useEffect, useRef } from "react";
import { useWizard, useWizardDispatch, getAllRoles } from "@/context/WizardContext";
import { Loader2 } from "lucide-react";

export function StepProvision() {
  const state = useWizard();
  const dispatch = useWizardDispatch();
  const started = useRef(false);
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [state.provisionLog]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    runProvision();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function runProvision() {
    dispatch({ type: "SET_PROVISIONING", value: true });
    const log = (msg: string) => dispatch({ type: "ADD_PROVISION_LOG", line: msg });

    try {
      const allRoles = getAllRoles(state);

      log("Starting provisioning...");
      log("");

      const response = await fetch("/api/provision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: state.companyName,
          goal: state.goal.title ? state.goal : undefined,
          project: state.project.name ? state.project : undefined,
          presetName: state.presetName,
          selectedModules: state.selectedModules,
          selectedRoles: state.selectedRoles,
          allRoles,
        }),
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response stream");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Parse SSE events from buffer
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        let eventType = "";
        for (const line of lines) {
          if (line.startsWith("event: ")) {
            eventType = line.slice(7);
          } else if (line.startsWith("data: ")) {
            const data = JSON.parse(line.slice(6));

            if (eventType === "log") {
              log(data.message);
            } else if (eventType === "result") {
              log("");
              log("All done!");
              dispatch({ type: "SET_PROVISION_RESULT", result: data });
              // Let the user see the success log before advancing
              setTimeout(() => dispatch({ type: "GO_TO", step: "done" }), 2000);
            } else if (eventType === "error") {
              throw new Error(data.message);
            }
            eventType = "";
          }
        }
      }
    } catch (err) {
      dispatch({
        type: "SET_ERROR",
        error: err instanceof Error ? err.message : "Provisioning failed",
      });
    }
  }

  const isDone = !state.provisioning && state.provisionResult;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-xl font-semibold tracking-tight flex items-center gap-2">
          {state.provisioning && <Loader2 className="h-5 w-5 animate-spin" />}
          {state.provisioning
            ? "Provisioning..."
            : state.error
              ? "Error"
              : "Provisioned"}
        </h2>
        {isDone && (
          <p className="text-sm text-muted-foreground">
            Company assembled and registered with Paperclip. Redirecting...
          </p>
        )}
        {state.error && (
          <p className="text-sm text-destructive">{state.error}</p>
        )}
      </div>

      <div className="rounded-lg border bg-card p-4 font-mono text-xs max-h-[400px] overflow-y-auto">
        {state.provisionLog.map((line, i) => (
          <div
            key={i}
            className={
              line.startsWith("✓")
                ? "text-green-600 py-0.5"
                : line.startsWith("!")
                  ? "text-yellow-600 py-0.5"
                  : line.startsWith("Error")
                    ? "text-destructive py-0.5"
                    : line.startsWith("+") || line.startsWith("  ")
                      ? "text-foreground pl-2 py-0.5 bg-muted/50 rounded my-0.5"
                      : "text-muted-foreground py-0.5"
            }
          >
            {line || "\u00A0"}
          </div>
        ))}
        <div ref={logEndRef} />
      </div>
    </div>
  );
}
