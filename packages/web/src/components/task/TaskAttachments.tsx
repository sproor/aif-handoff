import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { TaskCommentAttachment } from "@aif/shared/browser";
import { Button } from "@/components/ui/button";

interface TaskAttachmentsProps {
  attachments: TaskCommentAttachment[];
  onFilesSelected: (files: FileList | null) => void;
  onRemove: (index: number) => void;
}

export function TaskAttachments({ attachments, onFilesSelected, onRemove }: TaskAttachmentsProps) {
  const [expanded, setExpanded] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragOver(false);
    onFilesSelected(event.dataTransfer.files);
  };

  return (
    <div className="space-y-3">
      <button
        type="button"
        className="inline-flex items-center gap-1 border border-border bg-background/60 px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
        onClick={() => setExpanded((prev) => !prev)}
      >
        {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        {expanded ? "Hide attachments" : `Show attachments (${attachments.length})`}
      </button>

      {expanded && (
        <>
          <div
            className={`border border-dashed p-3 text-center text-xs transition-colors ${
              dragOver
                ? "border-primary/60 bg-primary/10 text-primary"
                : "border-border bg-secondary/20 text-muted-foreground"
            }`}
            onDragOver={(event) => {
              event.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
          >
            Drag files here to attach
          </div>
          <input
            type="file"
            multiple
            onChange={(e) => {
              onFilesSelected(e.target.files);
              e.currentTarget.value = "";
            }}
            className="block w-full text-xs text-muted-foreground file:mr-3 file:border file:border-border file:bg-secondary/40 file:px-3 file:py-1.5 file:text-xs"
          />
          {attachments.length === 0 ? (
            <p className="text-xs text-muted-foreground">No files attached to this task.</p>
          ) : (
            <ul className="space-y-1 text-xs text-foreground/85">
              {attachments.map((file, index) => (
                <li
                  key={`${file.name}-${index}`}
                  className="flex items-center justify-between gap-3 border border-border bg-secondary/30 px-2 py-1.5"
                >
                  <span className="truncate">
                    {file.name} ({file.mimeType || "unknown"}, {file.size} bytes)
                    {file.content == null && (
                      <span className="ml-1 text-[10px] text-muted-foreground">
                        (metadata only)
                      </span>
                    )}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-[10px]"
                    onClick={() => onRemove(index)}
                  >
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
