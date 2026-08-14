import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Search, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  EmptyState,
  ExpiryBadge,
  FieldError,
  LoadingRows,
  PageHeader,
  Panel,
  StatCard,
  TableWrap,
} from "@/components/pharmacy-ui";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import {
  ADJUSTMENT_REASONS,
  daysUntil,
  formatDate,
  getBatches,
  getSettings,
  medicineLabel,
  qk,
  toCsv,
  type Batch,
} from "@/lib/pharmacy";

export const Route = createFileRoute("/_authenticated/inventory")({
  head: () => ({
    meta: [
      { title: "Batch Inventory — MediStock Pharmacy" },
      {
        name: "description",
        content:
          "Batch-level pharmacy inventory with expiry tracking, FEFO ordering and audited stock adjustments.",
      },
      { property: "og:title", content: "Batch Inventory — MediStock Pharmacy" },
      {
        property: "og:description",
        content: "Track every medicine batch, its remaining quantity and expiry status.",
      },
    ],
  }),
  component: InventoryPage,
});

const adjustSchema = z.object({
  quantity: z.coerce.number().int("Whole units only").refine((n) => n !== 0, "Quantity cannot be zero"),
  reason: z.string().trim().min(1, "Select a reason"),
  notes: z.string().trim().max(300),
});

function InventoryPage() {
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const settings = useQuery({ queryKey: qk.settings, queryFn: getSettings });
  const batches = useQuery({ queryKey: qk.batches, queryFn: getBatches });

  const warnDays = settings.data?.expiry_warning_days ?? 90;
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [target, setTarget] = useState<Batch | null>(null);
  const [direction, setDirection] = useState<"decrease" | "increase">("decrease");
  const [quantity, setQuantity] = useState("1");
  const [reason, setReason] = useState<string>(ADJUSTMENT_REASONS[0]);
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (batches.data ?? []).filter((b) => {
      if (term) {
        const hay = `${b.medicines?.name ?? ""} ${b.batch_number} ${b.medicines?.code ?? ""}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      const d = daysUntil(b.expiry_date);
      if (filter === "expired" && d > 0) return false;
      if (filter === "expiring" && !(d > 0 && d <= warnDays)) return false;
      if (filter === "valid" && d <= warnDays) return false;
      if (filter === "instock" && b.current_quantity <= 0) return false;
      if (filter === "empty" && b.current_quantity > 0) return false;
      return true;
    });
  }, [batches.data, search, filter, warnDays]);

  const all = batches.data ?? [];
  const totalUnits = all.reduce((s, b) => s + b.current_quantity, 0);
  const expiredCount = all.filter((b) => daysUntil(b.expiry_date) <= 0 && b.current_quantity > 0).length;
  const expiringCount = all.filter((b) => {
    const d = daysUntil(b.expiry_date);
    return b.current_quantity > 0 && d > 0 && d <= warnDays;
  }).length;

  const openAdjust = (b: Batch) => {
    setTarget(b);
    setDirection("decrease");
    setQuantity("1");
    setReason(ADJUSTMENT_REASONS[0]);
    setNotes("");
    setErrors({});
  };

  const adjust = useMutation({
    mutationFn: async () => {
      const parsed = adjustSchema.safeParse({ quantity, reason, notes });
      if (!parsed.success) {
        const map: Record<string, string> = {};
        for (const issue of parsed.error.issues) map[String(issue.path[0])] = issue.message;
        setErrors(map);
        throw new Error("Please fix the highlighted fields");
      }
      if (!target) throw new Error("No batch selected");
      const magnitude = Math.abs(parsed.data.quantity);
      const delta = direction === "decrease" ? -magnitude : magnitude;
      if (delta < 0 && magnitude > target.current_quantity) {
        setErrors({ quantity: `Only ${target.current_quantity} units are in this batch` });
        throw new Error("Adjustment exceeds available stock");
      }
      setErrors({});
      const { error } = await supabase.rpc("adjust_stock", {
        p_batch_id: target.id,
        p_delta: delta,
        p_reason: parsed.data.reason,
        p_notes: parsed.data.notes,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: async () => {
      toast.success("Stock adjusted");
      setTarget(null);
      await queryClient.invalidateQueries({ queryKey: qk.batches });
      await queryClient.invalidateQueries({ queryKey: qk.transactions });
      await queryClient.invalidateQueries({ queryKey: qk.audit });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const exportCsv = () => {
    toCsv(
      rows.map((b) => ({
        medicine: medicineLabel(b.medicines),
        code: b.medicines?.code ?? "",
        batch: b.batch_number,
        received: b.quantity_received,
        remaining: b.current_quantity,
        expiry: b.expiry_date,
        days_left: daysUntil(b.expiry_date),
        supplier: b.suppliers?.name ?? "",
        location: b.storage_location ?? "",
      })),
      "inventory-batches.csv",
    );
  };

  return (
    <>
      <PageHeader
        title="Inventory"
        description="Every batch in the pharmacy, ordered by earliest expiry (FEFO)"
        actions={
          <Button size="sm" variant="outline" onClick={exportCsv} disabled={rows.length === 0}>
            <Download className="mr-1.5 size-3.5" /> Export CSV
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Batches" value={all.length} />
        <StatCard label="Units in Stock" value={totalUnits.toLocaleString()} tone="info" />
        <StatCard label="Expiring Soon" value={expiringCount} tone="warning" hint={`Within ${warnDays} days`} />
        <StatCard label="Expired Batches" value={expiredCount} tone="danger" />
      </div>

      <Panel title="Batches" description={`${rows.length} of ${all.length} batches shown`}>
        <div className="grid gap-3 border-b border-border p-4 sm:grid-cols-3">
          <div className="relative sm:col-span-2">
            <Search className="pointer-events-none absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by medicine or batch number"
              className="pl-8"
              aria-label="Search batches"
            />
          </div>
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger aria-label="Filter batches">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All batches</SelectItem>
              <SelectItem value="instock">With stock</SelectItem>
              <SelectItem value="empty">Empty batches</SelectItem>
              <SelectItem value="valid">Valid</SelectItem>
              <SelectItem value="expiring">Expiring soon</SelectItem>
              <SelectItem value="expired">Expired</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {batches.isLoading ? (
          <LoadingRows />
        ) : rows.length === 0 ? (
          <EmptyState title="No batches match your filters." />
        ) : (
          <TableWrap>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Medicine</TableHead>
                  <TableHead>Batch</TableHead>
                  <TableHead className="text-right">Received</TableHead>
                  <TableHead className="text-right">Remaining</TableHead>
                  <TableHead>Expiry</TableHead>
                  <TableHead className="text-right">Days Left</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell className="font-medium">
                      <Link
                        to="/medicines/$id"
                        params={{ id: b.medicine_id }}
                        className="hover:text-primary hover:underline"
                      >
                        {medicineLabel(b.medicines)}
                      </Link>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{b.batch_number}</TableCell>
                    <TableCell className="text-right tabular">{b.quantity_received}</TableCell>
                    <TableCell className="text-right tabular">{b.current_quantity}</TableCell>
                    <TableCell>{formatDate(b.expiry_date)}</TableCell>
                    <TableCell className="text-right tabular">{daysUntil(b.expiry_date)}</TableCell>
                    <TableCell>{b.suppliers?.name ?? "—"}</TableCell>
                    <TableCell>{b.storage_location ?? "—"}</TableCell>
                    <TableCell>
                      <ExpiryBadge days={daysUntil(b.expiry_date)} warnDays={warnDays} />
                    </TableCell>
                    <TableCell className="text-right">
                      {can("adjustStock") ? (
                        <Button size="sm" variant="outline" onClick={() => openAdjust(b)}>
                          <SlidersHorizontal className="mr-1.5 size-3.5" /> Adjust
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">View only</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableWrap>
        )}
      </Panel>

      <Dialog open={target !== null} onOpenChange={(o) => (o ? null : setTarget(null))}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Adjust stock</DialogTitle>
            <DialogDescription>
              {target
                ? `${medicineLabel(target.medicines)} · batch ${target.batch_number} · ${target.current_quantity} units on hand`
                : ""}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3">
            <div>
              <Label>Direction</Label>
              <Select
                value={direction}
                onValueChange={(v) => setDirection(v as "decrease" | "increase")}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="decrease">Remove from stock</SelectItem>
                  <SelectItem value="increase">Add to stock</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="qty">Quantity *</Label>
              <Input
                id="qty"
                type="number"
                min={1}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="mt-1"
              />
              <FieldError message={errors["quantity"]} />
            </div>
            <div>
              <Label>Reason *</Label>
              <Select value={reason} onValueChange={setReason}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ADJUSTMENT_REASONS.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError message={errors["reason"]} />
            </div>
            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="mt-1"
                rows={3}
                placeholder="Optional detail recorded in the audit log"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Adjustments over 20 units require a pharmacist or admin. Every adjustment is written to
              the stock transaction history and audit log.
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setTarget(null)}>
              Cancel
            </Button>
            <Button onClick={() => adjust.mutate()} disabled={adjust.isPending}>
              Save adjustment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
