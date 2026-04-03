import { useState } from "react";
import { Markdown } from "@/components/ui/markdown";
import { EmptyState } from "@/components/ui/empty-state";
import { Collapsible } from "@/components/ui/collapsible";

interface TaskPlanProps {
  plan: string | null;
}

export function TaskPlan({ plan }: TaskPlanProps) {
  const [expanded, setExpanded] = useState(false);

  if (!plan) {
    return <EmptyState message="No plan generated yet" />;
  }

  return (
    <Collapsible
      open={expanded}
      onOpenChange={setExpanded}
      trigger={expanded ? "Hide plan" : "Show plan"}
      className="space-y-3"
    >
      <Markdown content={plan} className="text-sm text-foreground/90" />
    </Collapsible>
  );
}
