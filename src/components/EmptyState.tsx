import { FileText } from "lucide-react";

export function EmptyState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
        <FileText className="h-8 w-8 text-muted-foreground" />
      </div>
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">No messages loaded</h2>
        <p className="max-w-sm text-sm text-muted-foreground">
          Paste a FIX message or drop a log file to get started.
          All parsing happens in your browser — nothing is uploaded.
        </p>
      </div>
    </div>
  );
}
