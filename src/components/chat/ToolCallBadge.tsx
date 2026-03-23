import { Loader2 } from "lucide-react";

interface ToolCallBadgeProps {
  toolName: string;
  args: Record<string, unknown>;
  state: string;
}

function getLabel(toolName: string, args: Record<string, unknown>): string {
  const path = typeof args.path === "string" ? args.path : "";
  const basename = path.split("/").filter(Boolean).pop() ?? path;
  const command = args.command;

  if (toolName === "str_replace_editor") {
    switch (command) {
      case "create":    return `Creating ${basename}`;
      case "str_replace": return `Editing ${basename}`;
      case "insert":    return `Editing ${basename}`;
      case "view":      return `Reading ${basename}`;
      case "undo_edit": return `Reverting ${basename}`;
    }
  }

  if (toolName === "file_manager") {
    switch (command) {
      case "rename": return `Renaming ${basename}`;
      case "delete": return `Deleting ${basename}`;
    }
  }

  return toolName;
}

export function ToolCallBadge({ toolName, args, state }: ToolCallBadgeProps) {
  const isDone = state === "result";
  const label = getLabel(toolName, args);

  return (
    <div className="inline-flex items-center gap-2 mt-2 px-3 py-1.5 bg-neutral-50 rounded-lg text-xs font-mono border border-neutral-200">
      {isDone ? (
        <div className="w-2 h-2 rounded-full bg-emerald-500" />
      ) : (
        <Loader2 className="w-3 h-3 animate-spin text-blue-600" />
      )}
      <span className="text-neutral-700">{label}</span>
    </div>
  );
}
