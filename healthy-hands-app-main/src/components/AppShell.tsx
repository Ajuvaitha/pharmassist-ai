import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, FileClock, Stethoscope } from "lucide-react";
import type { ReactNode } from "react";
import { useApp } from "@/lib/store";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/prescribe", label: "Prescribe", icon: Stethoscope },
  { to: "/history", label: "History", icon: FileClock },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const { doctor } = useApp();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="min-h-screen page-wash pb-24 sm:pb-10">
      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/85 backdrop-blur-xl no-print">
        <div className="w-full grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 py-3 sm:px-6">
          <Link to="/dashboard" className="flex min-w-0 items-center gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground">
              <Stethoscope className="h-5 w-5" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-base font-extrabold tracking-tight">
                Smart e-Prescription
              </span>
              <span className="block truncate text-xs text-muted-foreground">{doctor.clinic}</span>
            </span>
          </Link>

          <div className="flex items-center gap-2">
            <nav className="hidden items-center gap-1 sm:flex">
              {NAV.map(({ to, label, icon: Icon }) => (
                <Link
                  key={to}
                  to={to}
                  className={cn(
                    "flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors",
                    pathname === to
                      ? "bg-secondary text-secondary-foreground"
                      : "text-muted-foreground hover:bg-muted",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </Link>
              ))}
            </nav>
            <div className="ml-1 flex items-center gap-2">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent text-sm font-bold text-accent-foreground">
                {doctor.initials}
              </span>
              <span className="hidden min-w-0 sm:block">
                <span className="block truncate text-sm font-bold">{doctor.name}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {doctor.specialty}
                </span>
              </span>
            </div>
          </div>

        </div>
      </header>

      <main className="w-full px-4 py-6 sm:px-6 sm:py-8">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 backdrop-blur-xl sm:hidden no-print">
        <div className="grid grid-cols-3">
          {NAV.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className={cn(
                "flex flex-col items-center gap-1 py-3 text-xs font-semibold",
                pathname === to ? "text-primary" : "text-muted-foreground",
              )}
            >
              <Icon className="h-5 w-5" />
              {label}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
