import { ThemeToggle } from "@/components/ThemeToggle";
import { EmptyState } from "@/components/EmptyState";

export function App() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Top bar */}
      <header className="sticky top-0 z-50 flex h-12 items-center border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <span className="text-base font-bold tracking-tight">FIXate</span>
        <span className="ml-2 text-xs text-muted-foreground font-mono">
          FIX protocol log browser
        </span>
        <div className="ml-auto">
          <ThemeToggle />
        </div>
      </header>

      {/* Main content */}
      <main className="flex flex-1 flex-col">
        <EmptyState />
      </main>
    </div>
  );
}
