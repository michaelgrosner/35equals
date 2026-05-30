import type { ReactNode } from "react";
import { useTheme } from "next-themes";
import { Sun, Moon, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";

const THEMES = ["light", "dark", "system"] as const;
type Theme = (typeof THEMES)[number];

const ICONS: Record<Theme, ReactNode> = {
  light: <Sun className="h-4 w-4" />,
  dark: <Moon className="h-4 w-4" />,
  system: <Monitor className="h-4 w-4" />,
};

const LABELS: Record<Theme, string> = {
  light: "Switch to dark mode",
  dark: "Switch to system theme",
  system: "Switch to light mode",
};

function isTheme(value: string | undefined): value is Theme {
  return THEMES.includes(value as Theme);
}

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  const current: Theme = isTheme(theme) ? theme : "system";

  function cycle() {
    const idx = THEMES.indexOf(current);
    const next = THEMES[(idx + 1) % THEMES.length] ?? "system";
    setTheme(next);
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={cycle}
      aria-label={LABELS[current]}
      title={LABELS[current]}
    >
      {ICONS[current]}
    </Button>
  );
}
