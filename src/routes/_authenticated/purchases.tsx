import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
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
  FieldError,
  LoadingRows,
  PageHeader,
  Panel,
  TableWrap,
} from "@/components/pharmacy-ui";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import {
  formatDate,
  getMedicines,
  getPurchases,
  getSuppliers,
  medicineLabel,
  qk,
} from "@/lib/pharmacy";

export const Route = createFileRoute("/_authenticated/purchases")({
  head: () => ({
    meta: [
      { title: "Stock Receiving & Purchases — MediStock Pharmacy" },
      {
        name: "description",
        content:
          "Record supplier deliveries, create medicine batches with expiry dates and review purchase history.",
      },
      { property: "og:title", content: "Stock Receiving & Purchases — MediStock Pharmacy" },
      {
        property: "og:description",
        content: "Receive supplier stock into batches and review the full purchase history.",
      },
    ],
  }),
  component: PurchasesPage,
});

type ItemRow = {
  key: string;
  medicine_id: string;
  batch_number: string;
  quantity: string;
  manufacturing_date: string;
  expiry_date: string;
  purchase_price: string;
  storage_location: string;
};

const newRow = (): ItemRow => ({
  key: Math.random().toString(36).slice(2),
  medicine_id: "",
  batch_number: "",
  quantity: "",
  manufacturing_date: "",
  expiry_date: "",
  purchase_price: "",
  storage_location: "",
});

const itemSchema = z.object({
  medicine_id: z.string().uuid("Select a medicine"),
  batch_number: z.string().trim().min(1, "Batch number is required").max(60),
  quantity: z.coerce.number().int("Whole units only").positive("Quantity must be greater than zero"),
  expiry_date: z.string().min(1, "Expiry date is required"),
  manufacturing_date: z.string(),
  purchase_price: z.string(),
});

type PurchaseRecord = {
  id: string;
  reference: string;
  invoice_number: string | null;
  purchase_date: string;
  received_by_name: string | null;
  notes: string | null;
  suppliers?: { name: string } | null;
  purchase_items?: {
    id: string;
    quantity: number;
    batch_number: string;
    purchase_price: number | null;
    expiry_date: string;
    medicines?: { name: string; strength: string | null; unit: string } | null;
  }[];
};

function PurchasesPage() {
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const purchases = useQuery({ queryKey: qk.purchases, queryFn: getPurchases });
  const medicines = useQuery({ queryKey: qk.medicines, queryFn: getMedicines });
  const suppliers = useQuery({ queryKey: qk.suppliers, queryFn: getSuppliers });

  const [open, setOpen] = useState(false);
  const [supplierId, setSupplierId] = useState("");
  const [invoice, setInvoice] = useState("");
  const [purchaseDate, setPurchaseDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<ItemRow[]>([newRow()]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [expanded, setExpanded] = useState<string | null>(null);

  const activeMedicines = useMemo(
    () => (medicines.data ?? []).filter((m) => m.is_active),
    [medicines.data],
  );
  const activeSuppliers = useMemo(
    () => (suppliers.data ?? []).filter((s) => s.is_active),
    [suppliers.data],
  );

  const records = (purchases.data ?? []) as PurchaseRecord[];

  const resetForm = () => {
    setSupplierId("");
    setInvoice("");
    setPurchaseDate(new Date().toISOString().slice(0, 10));
    setNotes("");
    setItems([newRow()]);
    setErrors({});
  };

  const updateItem = (key: string, patch: Partial<ItemRow>) =>
    setItems((prev) => prev.map((it) => (it.key === key ? { ...it, ...patch } : it)));

  const submit = useMutation({
    mutationFn: async () => {
      const fieldErrors: Record<string, string> = {};
      if (!supplierId) fieldErrors["supplier"] = "Select a supplier";
      const payload: Record<string, string | number>[] = [];
      items.forEach((it, idx) => {
        const parsed = itemSchema.safeParse(it);
        if (!parsed.success) {
          fieldErrors[`item-${idx}`] = parsed.error.issues[0]?.message ?? "Invalid item";
          return;
        }
        if (
          parsed.data.manufacturing_date &&
          parsed.data.expiry_date <= parsed.data.manufacturing_date
        ) {
          fieldErrors[`item-${idx}`] = "Expiry date must be after the manufacturing date";
          return;
        }
        if (parsed.data.expiry_date <= new Date().toISOString().slice(0, 10)) {
          fieldErrors[`item-${idx}`] = "Cannot receive stock that is already expired";
          return;
        }
        payload.push({
          medicine_id: parsed.data.medicine_id,
          batch_number: parsed.data.batch_number,
          quantity: parsed.data.quantity,
          expiry_date: parsed.data.expiry_date,
          manufacturing_date: parsed.data.manufacturing_date,
          purchase_price: parsed.data.purchase_price,
          storage_location: it.storage_location,
        });
      });
      if (Object.keys(fieldErrors).length > 0) {
        setErrors(fieldErrors);
        throw new Error("Please fix the highlighted fields");
      }
      setErrors({});
      const { error } = await supabase.rpc("record_purchase", {
        p_supplier_id: supplierId,
        p_invoice_number: invoice,
        p_purchase_date: purchaseDate,
        p_notes: notes,
        p_items: payload,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: async () => {
      toast.success("Stock received and batches updated");
      setOpen(false);
      resetForm();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: qk.purchases }),
        queryClient.invalidateQueries({ queryKey: qk.batches }),
        queryClient.invalidateQueries({ queryKey: qk.transactions }),
        queryClient.invalidateQueries({ queryKey: qk.audit }),
      ]);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <>
      <PageHeader
        title="Purchases & Stock Receiving"
        description="Record supplier deliveries — each item creates or tops up a medicine batch"
        actions={
          can("receiveStock") ? (
            <Button
              size="sm"
              onClick={() => {
                resetForm();
                setOpen(true);
              }}
            >
              <Plus className="mr-1.5 size-3.5" /> Receive Stock
            </Button>
          ) : null
        }
      />

      <Panel title="Purchase history" description={`${records.length} recorded deliveries`}>
        {purchases.isLoading ? (
          <LoadingRows />
        ) : records.length === 0 ? (
          <EmptyState
            title="No stock deliveries recorded yet."
            description="Use Receive Stock to log your first supplier delivery."
          />
        ) : (
          <TableWrap>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reference</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Invoice</TableHead>
                  <TableHead className="text-right">Items</TableHead>
                  <TableHead className="text-right">Units</TableHead>
                  <TableHead>Received by</TableHead>
                  <TableHead className="text-right">Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((p) => {
                  const lineItems = p.purchase_items ?? [];
                  const units = lineItems.reduce((s, i) => s + i.quantity, 0);
                  return (
                    <>
                      <TableRow key={p.id}>
                        <TableCell className="font-mono text-xs">{p.reference}</TableCell>
                        <TableCell>{formatDate(p.purchase_date)}</TableCell>
                        <TableCell className="font-medium">{p.suppliers?.name ?? "—"}</TableCell>
                        <TableCell>{p.invoice_number ?? "—"}</TableCell>
                        <TableCell className="text-right tabular">{lineItems.length}</TableCell>
                        <TableCell className="text-right tabular">{units}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {p.received_by_name ?? "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setExpanded(expanded === p.id ? null : p.id)}
                          >
                            {expanded === p.id ? "Hide" : "View"}
                          </Button>
                        </TableCell>
                      </TableRow>
                      {expanded === p.id ? (
                        <TableRow key={`${p.id}-detail`} className="bg-muted/40">
                          <TableCell colSpan={8}>
                            <ul className="space-y-1 py-1 text-sm">
                              {lineItems.map((i) => (
                                <li key={i.id} className="flex flex-wrap gap-x-3 text-foreground">
                                  <span className="font-medium">{medicineLabel(i.medicines)}</span>
                                  <span className="text-muted-foreground">
                                    batch {i.batch_number}
                                  </span>
                                  <span className="tabular">{i.quantity} units</span>
                                  <span className="text-muted-foreground">
                                    expires {formatDate(i.expiry_date)}
                                  </span>
                                  {i.purchase_price != null ? (
                                    <span className="text-muted-foreground tabular">
                                      @ {i.purchase_price}
                                    </span>
                                  ) : null}
                                </li>
                              ))}
                              {p.notes ? (
                                <li className="pt-1 text-muted-foreground">Notes: {p.notes}</li>
                              ) : null}
                            </ul>
                          </TableCell>
                        </TableRow>
                      ) : null}
                    </>
                  );
                })}
              </TableBody>
            </Table>
          </TableWrap>
        )}
      </Panel>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Receive stock</DialogTitle>
            <DialogDescription>
              Each line creates a new batch, or adds to an existing batch with the same number.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label>Supplier *</Label>
              <Select value={supplierId} onValueChange={setSupplierId}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select supplier" />
                </SelectTrigger>
                <SelectContent>
                  {activeSuppliers.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError message={errors["supplier"]} />
            </div>
            <div>
              <Label htmlFor="invoice">Invoice number</Label>
              <Input
                id="invoice"
                value={invoice}
                onChange={(e) => setInvoice(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="pdate">Purchase date *</Label>
              <Input
                id="pdate"
                type="date"
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>

          <div className="space-y-3">
            {items.map((it, idx) => (
              <div key={it.key} className="rounded-md border border-border p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                    Item {idx + 1}
                  </span>
                  {items.length > 1 ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setItems(items.filter((r) => r.key !== it.key))}
                    >
                      <Trash2 className="size-3.5" />
                      <span className="sr-only">Remove item {idx + 1}</span>
                    </Button>
                  ) : null}
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="sm:col-span-2">
                    <Label>Medicine *</Label>
                    <Select
                      value={it.medicine_id}
                      onValueChange={(v) => updateItem(it.key, { medicine_id: v })}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select medicine" />
                      </SelectTrigger>
                      <SelectContent>
                        {activeMedicines.map((m) => (
                          <SelectItem key={m.id} value={m.id}>
                            {medicineLabel(m)} · {m.code}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Batch number *</Label>
                    <Input
                      value={it.batch_number}
                      onChange={(e) => updateItem(it.key, { batch_number: e.target.value })}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>Quantity *</Label>
                    <Input
                      type="number"
                      min={1}
                      value={it.quantity}
                      onChange={(e) => updateItem(it.key, { quantity: e.target.value })}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>Manufacturing date</Label>
                    <Input
                      type="date"
                      value={it.manufacturing_date}
                      onChange={(e) => updateItem(it.key, { manufacturing_date: e.target.value })}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>Expiry date *</Label>
                    <Input
                      type="date"
                      value={it.expiry_date}
                      onChange={(e) => updateItem(it.key, { expiry_date: e.target.value })}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>Purchase price / unit</Label>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={it.purchase_price}
                      onChange={(e) => updateItem(it.key, { purchase_price: e.target.value })}
                      className="mt-1"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Label>Storage location</Label>
                    <Input
                      value={it.storage_location}
                      onChange={(e) => updateItem(it.key, { storage_location: e.target.value })}
                      placeholder="Shelf B1"
                      className="mt-1"
                    />
                  </div>
                </div>
                <FieldError message={errors[`item-${idx}`]} />
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => setItems([...items, newRow()])}>
              <Plus className="mr-1.5 size-3.5" /> Add another item
            </Button>
          </div>

          <div>
            <Label htmlFor="pnotes">Notes</Label>
            <Textarea
              id="pnotes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="mt-1"
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => submit.mutate()} disabled={submit.isPending}>
              Receive stock
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
