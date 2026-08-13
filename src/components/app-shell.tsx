import { useState, type ReactNode } from "react";
import { Link, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  Boxes,
  ClipboardList,
  FileBarChart2,
  LayoutDashboard,
  LogOut,
  Menu,
  Pill,
  Settings as SettingsIcon,
  ShieldCheck,
  Stethoscope,
  Truck,
  TriangleAlert,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, type Permission } from "@/hooks/use-auth";
import { getSettings, qk, ROLE_LABELS } from "@/lib/pharmacy";
import { cn } from "@/lib/utils";

interface NavItem {
  to: string;
  label: string;
  icon: typeof Pill;
  permission?: Permission;
}

const NAV: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/medicines", label: "Medicines", icon: Pill },
  { to: "/inventory", label: "Inventory", icon: Boxes },
  { to: "/purchases", label: "Purchases", icon: Truck },
  { to: "/dispensing", label: "Dispensing", icon: Stethoscope },
  { to: "/suppliers", label: "Suppliers", icon: ClipboardList },
  { to: "/patients", label: "Patients / Prescriptions", icon: Users },
  { to: "/alerts", label: "Alerts", icon: TriangleAlert },
  { to: "/reports", label: "Reports", icon: FileBarChart2 },
  { to: "/users", label: "Users", icon: ShieldCheck, permission: "manageUsers" },
  { to: "/audit-log", label: "Audit Log", icon: Activity, permission: "viewAudit" },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
];

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const { role, can } = useAuth();
  return (
    <nav className="flex flex-col gap-0.5 px-2 py-3">
      {NAV.filter((item) => !item.permission || can(item.permission)).map((item) => (
        <Link
          key={item.to}
          to={item.to}
          onClick={onNavigate}
          className="flex items-center gap-2.5 rounded-sm px-3 py-2 text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          activeProps={{
            className:
              "bg-sidebar-accent text-sidebar-accent-foreground font-medium border-l-2 border-sidebar-primary",
          }}
          activeOptions={{ exact: false }}
        >
          <item.icon className="size-4 shrink-0" strokeWidth={1.75} />
          <span className="truncate">{item.label}</span>
        </Link>
      ))}
      {role ? (
        <p className="mt-3 px-3 text-xs text-sidebar-foreground/60">
          Signed in as {ROLE_LABELS[role]}
        </p>
      ) : null}
    </nav>
  );
}

function Brand({ name }: { name: string }) {
  return (
    <div className="flex items-center gap-2.5 border-b border-sidebar-border px-4 py-3.5">
      <span className="flex size-8 items-center justify-center rounded-sm bg-sidebar-primary text-sidebar-primary-foreground">
        <Pill className="size-4.5" strokeWidth={2} />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold text-sidebar-accent-foreground">
          {name}
        </span>
        <span className="block text-xs text-sidebar-foreground/70">Pharmacy Inventory</span>
      </span>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const { fullName, role } = useAuth();
  const router = useRouter();
  const { data: settings } = useQuery({ queryKey: qk.settings, queryFn: getSettings });
  const pharmacyName = settings?.pharmacy_name ?? "Clinic Pharmacy";

  const signOut = async () => {
    await supabase.auth.signOut();
    await router.navigate({ to: "/auth" });
  };

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden w-64 shrink-0 flex-col bg-sidebar lg:flex">
        <Brand name={pharmacyName} />
        <div className="flex-1 overflow-y-auto">
          <NavLinks />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-border bg-card px-4 py-2.5">
          <div className="flex items-center gap-2">
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" className="lg:hidden" aria-label="Open menu">
                  <Menu className="size-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 bg-sidebar p-0">
                <SheetTitle className="sr-only">Navigation</SheetTitle>
                <Brand name={pharmacyName} />
                <NavLinks onNavigate={() => setOpen(false)} />
              </SheetContent>
            </Sheet>
            <span className="truncate text-sm font-medium text-foreground lg:hidden">
              {pharmacyName}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium text-foreground">{fullName}</p>
              <p className="text-xs text-muted-foreground">
                {role ? ROLE_LABELS[role] : "No role assigned"}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={signOut}>
              <LogOut className="mr-1.5 size-3.5" /> Sign out
            </Button>
          </div>
        </header>

        <main className={cn("min-w-0 flex-1 space-y-5 p-4 sm:p-6")}>{children}</main>
      </div>
    </div>
  );
}
