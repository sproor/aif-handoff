import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import type { PlanChangeMode } from "./useTaskDetailActions";

const MODE_TITLES: Record<PlanChangeMode, string> = {
  replanning: "Request Replanning",
  fast_fix: "Fast Fix",
  request_changes: "Request Changes",
};

const MODE_DESCRIPTIONS: Record<PlanChangeMode, string> = {
  replanning:
    "Explain what should change in the plan. Your message and file metadata will be added to task comments.",
  fast_fix:
    "Describe a small change to the current plan. Your message and file metadata will be added to task comments.",
  request_changes:
    "Describe what should be changed in the implementation. Your message and file metadata will be added to task comments.",
};

const MODE_PLACEHOLDERS: Record<PlanChangeMode, string> = {
  replanning: "Describe what needs to be changed in the plan...",
  fast_fix: "Describe the quick plan fix...",
  request_changes: "Describe what needs to be changed...",
};

const MODE_SUBMIT_LABELS: Record<PlanChangeMode, string> = {
  replanning: "Send",
  fast_fix: "Apply fast fix",
  request_changes: "Request changes",
};

const MODE_LOADING_LABELS: Record<PlanChangeMode, string> = {
  replanning: "Submitting replanning request...",
  fast_fix: "Applying fast fix to current plan...",
  request_changes: "Submitting request changes...",
};

interface PlanChangeDialogProps {
  open: boolean;
  mode: PlanChangeMode;
  comment: string;
  onCommentChange: (value: string) => void;
  files: File[];
  onFilesChange: (files: File[]) => void;
  isSubmitting: boolean;
  error: string | null;
  onSubmit: () => void;
  onCancel: () => void;
}

export function PlanChangeDialog({
  open,
  mode,
  comment,
  onCommentChange,
  files,
  onFilesChange,
  isSubmitting,
  error,
  onSubmit,
  onCancel,
}: PlanChangeDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (isSubmitting) return;
        if (!nextOpen) onCancel();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{MODE_TITLES[mode]}</DialogTitle>
        </DialogHeader>
        <p className="mb-3 text-sm text-muted-foreground">{MODE_DESCRIPTIONS[mode]}</p>
        <div className="space-y-3">
          <Textarea
            value={comment}
            onChange={(e) => onCommentChange(e.target.value)}
            disabled={isSubmitting}
            placeholder={MODE_PLACEHOLDERS[mode]}
            rows={6}
          />
          <div className="space-y-2">
            <input
              type="file"
              multiple
              disabled={isSubmitting}
              onChange={(e) => onFilesChange(Array.from(e.target.files ?? []))}
              className="block w-full text-xs text-muted-foreground file:mr-3 file:border file:border-border file:bg-secondary/40 file:px-3 file:py-1.5 file:text-xs"
            />
            {files.length > 0 && (
              <ul className="space-y-1 text-xs text-muted-foreground">
                {files.map((file) => (
                  <li key={`${file.name}-${file.size}`}>
                    {file.name} ({file.size} bytes)
                  </li>
                ))}
              </ul>
            )}
          </div>
          {isSubmitting && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Spinner size="sm" />
              {MODE_LOADING_LABELS[mode]}
            </div>
          )}
          {error && (
            <div className="border border-destructive/40 bg-destructive/10 px-2 py-1.5 text-xs text-destructive">
              {error}
            </div>
          )}
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button size="sm" onClick={onSubmit} disabled={!comment.trim() || isSubmitting}>
            {isSubmitting ? (
              <>
                <Spinner size="sm" className="mr-1" />
                Sending...
              </>
            ) : (
              MODE_SUBMIT_LABELS[mode]
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
