import { useWizardDispatch } from "@/context/WizardContext";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Building2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

function PathCard({
  icon: Icon,
  title,
  description,
  details,
  onClick,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  details: string[];
  onClick: () => void;
}) {
  return (
    <Card
      className={cn(
        "cursor-pointer transition-all duration-200",
        "hover:border-foreground/20 hover:shadow-md",
        "active:scale-[0.98]"
      )}
      onClick={onClick}
    >
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-secondary flex items-center justify-center">
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-base">{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ul className="space-y-1.5">
          {details.map((d, i) => (
            <li key={i} className="text-sm text-muted-foreground flex items-baseline gap-2">
              <span className="text-foreground/40 shrink-0">-</span>
              {d}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

export function StepOnboarding() {
  const dispatch = useWizardDispatch();

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Create a company</h1>
        <p className="text-muted-foreground">
          Choose how you'd like to set up your AI agent organization.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <PathCard
          icon={Building2}
          title="Setup my own org"
          description="Configure step by step"
          details={[
            "Choose team preset or go custom",
            "Pick modules and roles",
            "Define goal and first project",
            "Full control over every detail",
          ]}
          onClick={() => dispatch({ type: "SET_PATH", path: "manual" })}
        />
        <PathCard
          icon={Sparkles}
          title="Autonomous from idea"
          description="Describe it, we'll configure it"
          details={[
            "Describe your company in plain English",
            "AI selects optimal team and modules",
            "Review and adjust before creating",
            "Fastest way to get started",
          ]}
          onClick={() => dispatch({ type: "SET_PATH", path: "ai" })}
        />
      </div>
    </div>
  );
}
