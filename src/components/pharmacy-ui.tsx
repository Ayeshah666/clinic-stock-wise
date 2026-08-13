import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-xl font-semibold text-foreground sm:text-2xl">{title}</h1>
        {description ? (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function Panel({
  title,
  description,
  actions,
  children,
  className,
  bodyClassName,
}: {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn("rounded-md border border-border bg-card shadow-xs", className)}>
      {title ? (
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-foreground">{title}</h2>
            {description ? (
              <p className="text-xs text-muted-foreground">{description}</p>
            ) : null}
          </div>
          {actions}
        </header>
      ) : null}
      <div className={cn(bodyClassName)}>{children}</div>
    </section>
  );
}

export function TableWrap({ children }: { children: ReactNode }) {
  return <div className="w-full overflow-x-auto">{children}</div>;
}

type Tone = "neutral" | "info" | "success" | "warning" | "danger";

const TONE_CLASS: Record<Tone, string> = {
  neutral: "bg-muted text-muted-foreground border-border",
  info: "bg-primary-soft text-primary border-primary/20",
  success: "bg-success-soft text-success border-success/25",
  warning: "bg-warning-soft text-warning border-warning/30",
  danger: "bg-danger-soft text-destructive border-destructive/25",
};

export function StatusBadge({
  tone = "neutral",
  children,
  className,
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-sm border px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        TONE_CLASS[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function StockBadge({ quantity, reorderLevel }: { quantity: number; reorderLevel: number }) {
  if (quantity <= 0) return <StatusBadge tone="danger">Out of Stock</StatusBadge>;
  if (quantity <= reorderLevel) return <StatusBadge tone="warning">Low Stock</StatusBadge>;
  return <StatusBadge tone="success">In Stock</StatusBadge>;
}

export function ExpiryBadge({ days, warnDays }: { days: number; warnDays: number }) {
  if (days <= 0) return <StatusBadge tone="danger">Expired</StatusBadge>;
  if (days <= warnDays) return <StatusBadge tone="warning">Expiring Soon</StatusBadge>;
  return <StatusBadge tone="success">Valid</StatusBadge>;
}

export function StatCard({
  label,
  value,
  hint,
  tone = "neutral",
  icon,
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: Tone;
  icon?: ReactNode;
}) {
  const accent: Record<Tone, string> = {
    neutral: "text-foreground",
    info: "text-primary",
    success: "text-success",
    warning: "text-warning",
    danger: "text-destructive",
  };
  return (
    <div className="rounded-md border border-border bg-card px-4 py-3 shadow-xs">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
        {icon ? <span className={cn("shrink-0", accent[tone])}>{icon}</span> : null}
      </div>
      <p className={cn("mt-2 text-2xl font-semibold tabular", accent[tone])}>{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description ? <p className="max-w-sm text-sm text-muted-foreground">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

export function LoadingRows({ label = "Loading…" }: { label?: string }) {
  return <div className="px-4 py-10 text-center text-sm text-muted-foreground">{label}</div>;
}

export function ErrorNote({ message }: { message: string }) {
  return (
    <div className="m-4 rounded-md border border-destructive/25 bg-danger-soft px-3 py-2 text-sm text-destructive">
      {message}
    </div>
  );
}

export function FieldError({ message }: { message?: string | null | undefined }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-destructive">{message}</p>;
}
