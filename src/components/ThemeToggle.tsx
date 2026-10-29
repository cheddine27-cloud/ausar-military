import { Moon, Sun } from "lucide-react";
import { useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useScopedTheme } from "@/lib/scopedTheme";
import { cn } from "@/lib/utils";

interface ThemeToggleProps {
  className?: string;
}

export function ThemeToggle({ className }: ThemeToggleProps) {
  const { isDark, toggleTheme } = useScopedTheme();
  const label = isDark ? "تفعيل الوضع النهاري" : "تفعيل الوضع الليلي";

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      className={cn(
        "relative h-10 w-10 rounded-lg border border-slate-200 bg-white/90 text-slate-700 shadow-sm backdrop-blur transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-100 dark:hover:bg-slate-800",
        className
      )}
      aria-label={label}
      title={label}
    >
      <Moon className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <Sun className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
      <span className="sr-only">{label}</span>
    </Button>
  );
}

export function FloatingThemeToggle() {
  const { pathname } = useLocation();
  // Hide the floating toggle inside any admin/teacher dashboard. Each dashboard
  // already has its own theme toggle in the top bar, so we don't want a
  // duplicate floating button.
  const hasDashboardHeader =
    pathname === "/panel-sk2025x/dashboard" ||
    pathname === "/panel-sk2025x/super-admin" ||
    pathname === "/panel-sk2025x/institution" ||
    pathname === "/panel-sk2025x/access-denied" ||
    pathname === "/panel-sk2025x/login";

  if (hasDashboardHeader) {
    return null;
  }

  return <ThemeToggle className="fixed right-4 top-24 z-[70] h-11 w-11 rounded-full shadow-lg" />;
}
