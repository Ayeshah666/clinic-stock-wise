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
  StatusBadge,
  TableWrap,
} from "@/components/pharmacy-ui";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import {
  daysUntil,
  fefoBatches,
  formatDate,
  formatDateTime,
  getBatches,
  getDispensings,
  getMedicines,
  getPatients,
  getPrescriptions,
  medicineLabel,
  qk,
  type Batch,
} from "@/lib/pharmacy";

export const Route = createFileRoute("/_authenticated/dispensing")({
  head: () => ({
    meta: [
      { title: "Dispense Medicines — MediStock Pharmacy" },
      {
        name: "description",
        content:
          "Dispense medicines to patients using first-expiry-first-out batch selection with automatic stock deduction.",
      },
      { property: "og:title", content: "Dispense Medicines — MediStock Pharmacy" },
      {
        property: "og:description",
        content: "FEFO dispensing with automatic stock deduction and full traceability.",
      },
    ],
  }),
  component: DispensingPage;
});

type LineItem = {
  key: string;
  medicine_id: string;
  batch_id: string;
  quantity: string;
};

const newLine = (): LineItem => ({
  key: Math.random().toString(36).slice(2),
  medicine_id: "",
  batch_id: "",
  quantity: "",
});

const lineSchema = z.object({
  medicine_id: z.string().uuid("Select a medicine"),
  batch_id: z.string().uuid("Select a batch"),
  quantity: z.coerce.number().int("Whole units only").positive("Quantity must be greater than zero"),
});

type PatientRow = { id: string; name: string; code: string; is_active: boolean };
type PrescriptionRow = {
  id: string;
  code: string;
  patient_id: string;
  doctor_name: string;
  prescription_date: string;
  patients?: { id: string; name: string; code: string } | null;
  prescription_items?: {
    id: string;
    medicine_id: string;
    prescribed_quantity: number;
    dosage_instructions: string | null;
    medicines?: { name: string; strength: string | null; unit: string } | null;
  }[];
};
type DispensingRow = {
  id: string;
  code: string;
  dispensed_at: string;
  dispensed_by_name: string | null;
  notes: string | null;
  patients?: { name: string; code: string } | null;
  prescriptions?: { code: string; doctor_name: string } | null;
  dispensing_items?: {
    id: string;
    quantity: number;
    batch_number: string;
    medicines?: { name: string; strength: string | null; unit: string } | null;
  }[];
};

function DispensingPage() {
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const dispensings = useQuery({ queryKey: qk.dispensings, queryFn: getDispensings });
  const medicines = useQuery({ queryKey: qk.medicines, queryFn: getMedicines });
  const batches = useQuery({ queryKey: qk.batches, queryFn: getBatches });
  const patients = useQuery({ queryKey: qk.patients, queryFn: getPatients });
  const prescriptions = useQuery({ queryKey: qk.prescriptions, queryFn: getPrescriptions });

  const [open, setOpen] = useState(false);
  const [patientId, setPatientId] = useState("none");
  const [prescriptionId, setPrescriptionId] = useState("none");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<LineItem[]>([newLine()]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [expanded, setExpanded] = useState<string | null>(null);

  const allBatches = batches.data ?? [];
  const records = (dispensings.data ?? []) as DispensingRow[];
  const patientRows = (patients.data ?? []) as PatientRow[];
  const rxRows = (prescriptions.data ?? []) as PrescriptionRow[];

  const dispensableMedicines = useMemo(() => {
    const withStock = new Set(fefoBatches(allBatches).map((b) => b.medicine_id));
    return (medicines.data ?? []).filter((m) => m.is_active && withStock.has(m.id));
  }, [medicines.data, allBatches]);

  const batchesFor = (medicineId: string): Batch[] =>
    fefoBatches(allBatches.filter((b) => b.medicine_id === medicineId));

  const updateLine = (key: string, patch: Partial<LineItem>) =>
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const selectMedicine = (key: string, medicineId: string) => {
    const fefo = batchesFor(medicineId);
    updateLine(key, { medicine_id: medicineId, batch_id: fefo[0]?.id ?? "" });
  };

  const resetForm = () => {
    setPatientId("none");
    setPrescriptionId("none");
    setNotes("");
    setLines([newLine()]);
    setErrors({});
  };

  const loadPrescription = (id: string) => {
    setPrescriptionId(id);
    if (id === "none") return;
    const rx = rxRows.find((r) => r.id === id);
    if (!rx) return;
    setPatientId(rx.patient_id);
    const nextLines = (rx.prescription_items ?? []).map((item) => {
      const fefo = batchesFor(item.medicine_id);
      return {
        key: Math.random().toString(36).slice(2),
        medicine_id: item.medicine_id,
        batch_id: fefo[0]?.id ?? "",
        quantity: String(item.prescribed_quantity),
      };
    });
    setLines(nextLines.length > 0 ? nextLines : [newLine()]);
  };

  const submit = useMutation({
    mutationFn: async () => {
      const fieldErrors: Record<string, string> = {};
      const payload: Record<string, string | number>[] = [];
      lines.forEach((line, idx) => {
        const parsed = lineSchema.safeParse(line);
        if (!parsed.success) {
          fieldErrors[`line-${idx}`] = parsed.error.issues[0]?.message ?? "Invalid item";
          return;
        }
        const batch = allBatches.find((b) => b.id === parsed.data.batch_id);
        if (!batch) {
          fieldErrors[`line-${idx}`] = "Selected batch no longer exists";
          return;
        }
        if (daysUntil(batch.expiry_date) <= 0) {
          fieldErrors[`line-${idx}`] = "This batch is expired and cannot be dispensed";
          return;
        }
        if (parsed.data.quantity > batch.current_quantity) {
          fieldErrors[`line-${idx}`] = `Only ${batch.current_quantity} units available in batch ${batch.batch_number}`;
          return;
        }
        payload.push({ batch_id: parsed.data.batch_id, quantity: parsed.data.quantity });
      });
      if (Object.keys(fieldErrors).length > 0) {
        setErrors(fieldErrors);
        throw new Error("Please fix the highlighted fields");
      }
      setErrors({});
      const { error } = await supabase.rpc("record_dispensing", {
        p_patient_id: patientId === "none" ? null : patientId,
        p_prescription_id: prescriptionId === "none" ? null : prescriptionId,
        p_notes: notes,
        p_items: payload,
      } as never);
      if (error) throw new Error(error.message);
    },
    onSuccess: async () => {
      toast.success("Medicines dispensed and stock updated");
      setOpen(false);
      resetForm();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: qk.dispensings }),
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
        title="Dispensing"
        description="Dispense medicines to patients — batches are suggested first-expiry-first-out"
        actions={
          can("dispense") ? (
            <Button
              size="sm"
              onClick={() => {
                resetForm();
                setOpen(true);
              }}
            >
              <Plus className="mr-1.5 size-3.5" /> Dispense Medicine
            </Button>
          ) : null
        }
      />

      <Panel title="Dispensing history" description={`${records.length} dispensing records`}>
        {dispensings.isLoading ? (
          <LoadingRows />
        ) : records.length === 0 ? (
          <EmptyState
            title="Nothing has been dispensed yet."
            description="Records appear here as soon as you dispense medicines."
          />
        ) : (
          <TableWrap>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reference</TableHead>
                  <TableHead>Date / Time</TableHead>
                  <TableHead>Patient</TableHead>
                  <TableHead>Prescription</TableHead>
                  <TableHead className="text-right">Items</TableHead>
                  <TableHead className="text-right">Units</TableHead>
                  <TableHead>Dispensed by</TableHead>
                  <TableHead className="text-right">Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((d) => {
                  const items = d.dispensing_items ?? [];
                  const units = items.reduce((s, i) => s + i.quantity, 0);
                  const isOpen = expanded === d.id;
                  return [
                    <TableRow key={d.id}>
                      <TableCell className="font-mono text-xs">{d.code}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        {formatDateTime(d.dispensed_at)}
                      </TableCell>
                      <TableCell className="font-medium">
                        {d.patients ? `${d.patients.name} (${d.patients.code})` : "Walk-in"}
                      </TableCell>
                      <TableCell>
                        {d.prescriptions ? (
                          <StatusBadge tone="info">{d.prescriptions.code}</StatusBadge>
                        ) : (
                          <span className="text-muted-foreground">Over the counter</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular">{items.length}</TableCell>
                      <TableCell className="text-right tabular">{units}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {d.dispensed_by_name ?? "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setExpanded(isOpen ? null : d.id)}
                        >
                          {isOpen ? "Hide" : "View"}
                        </Button>
                      </TableCell>
                    </TableRow>,
                    isOpen ? (
                      <TableRow key={`${d.id}-detail`} className="bg-muted/40">
                        <TableCell colSpan={8}>
                          <ul className="space-y-1 py-1 text-sm">
                            {items.map((i) => (
                              <li key={i.id} className="flex flex-wrap gap-x-3">
                                <span className="font-medium">{medicineLabel(i.medicines)}</span>
                                <span className="text-muted-foreground">batch {i.batch_number}</span>
                                <span className="tabular">
                                  {i.quantity} {i.medicines?.unit ?? "units"}
                                </span>
                              </li>
                            ))}
                            {d.prescriptions ? (
                              <li className="text-muted-foreground">
                                Doctor: {d.prescriptions.doctor_name}
                              </li>
                            ) : null}
                            {d.notes ? (
                              <li className="text-muted-foreground">Notes: {d.notes}</li>
                            ) : null}
                          </ul>
                        </TableCell>
                      </TableRow>
                    ) : null,
                  ];
                })}
              </TableBody>
            </Table>
          </TableWrap>
        )}
      </Panel>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Dispense medicine</DialogTitle>
            <DialogDescription>
              The earliest-expiring valid batch is selected automatically. Expired batches are never
              offered.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Prescription</Label>
              <Select value={prescriptionId} onValueChange={loadPrescription}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Optional" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No prescription (OTC)</SelectItem>
                  {rxRows.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.code} · {r.patients?.name ?? "Unknown"} · {formatDate(r.prescription_date)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Patient</Label>
              <Select value={patientId} onValueChange={setPatientId}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Walk-in" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Walk-in / unnamed</SelectItem>
                  {patientRows
                    .filter((p) => p.is_active)
                    .map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} · {p.code}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-3">
            {lines.map((line, idx) => {
              const options = line.medicine_id ? batchesFor(line.medicine_id) : [];
              const selected = options.find((b) => b.id === line.batch_id);
              return (
                <div key={line.key} className="rounded-md border border-border p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                      Item {idx + 1}
                    </span>
                    {lines.length > 1 ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setLines(lines.filter((l) => l.key !== line.key))}
                      >
                        <Trash2 className="size-3.5" />
                        <span className="sr-only">Remove item {idx + 1}</span>
                      </Button>
                    ) : null}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div>
                      <Label>Medicine *</Label>
                      <Select
                        value={line.medicine_id}
                        onValueChange={(v) => selectMedicine(line.key, v)}
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Select medicine" />
                        </SelectTrigger>
                        <SelectContent>
                          {dispensableMedicines.map((m) => (
                            <SelectItem key={m.id} value={m.id}>
                              {medicineLabel(m)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Batch (FEFO) *</Label>
                      <Select
                        value={line.batch_id}
                        onValueChange={(v) => updateLine(line.key, { batch_id: v })}
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Select batch" />
                        </SelectTrigger>
                        <SelectContent>
                          {options.map((b, i) => (
                            <SelectItem key={b.id} value={b.id}>
                              {b.batch_number} · exp {formatDate(b.expiry_date)} · {b.current_quantity} left
                              {i === 0 ? " · FEFO" : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Quantity *</Label>
                      <Input
                        type="number"
                        min={1}
                        value={line.quantity}
                        onChange={(e) => updateLine(line.key, { quantity: e.target.value })}
                        className="mt-1"
                      />
                    </div>
                  </div>
                  {selected ? (
                    <p className="mt-2 text-xs text-muted-foreground">
                      {selected.current_quantity} units available · expires{" "}
                      {formatDate(selected.expiry_date)} ({daysUntil(selected.expiry_date)} days left)
                    </p>
                  ) : null}
                  <FieldError message={errors[`line-${idx}`]} />
                </div>
              );
            })}
            <Button variant="outline" size="sm" onClick={() => setLines([...lines, newLine()])}>
              <Plus className="mr-1.5 size-3.5" /> Add another medicine
            </Button>
          </div>

          <div>
            <Label htmlFor="dnotes">Notes</Label>
            <Textarea
              id="dnotes"
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
              Confirm dispensing
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
