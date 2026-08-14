import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
  StockBadge,
  TableWrap,
} from "@/components/pharmacy-ui";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import {
  DOSAGE_FORMS,
  daysUntil,
  getBatches,
  getCategories,
  getMedicines,
  getSettings,
  logAudit,
  medicineLabel,
  qk,
  type Medicine,
} from "@/lib/pharmacy";

export const Route = createFileRoute("/_authenticated/medicines/")({
  head: () => ({
    meta: [
      { title: "Medicine Catalogue — MediStock Pharmacy" },
      {
        name: "description",
        content:
          "Browse, search and manage the clinic pharmacy medicine catalogue with stock levels and reorder thresholds.",
      },
      { property: "og:title", content: "Medicine Catalogue — MediStock Pharmacy" },
      {
        property: "og:description",
        content: "Manage medicines, categories, units and reorder levels for the clinic pharmacy.",
      },
    ],
  }),
  component: MedicinesPage,
});

const medicineSchema = z.object({
  name: z.string().trim().min(2, "Medicine name is required").max(120),
  generic_name: z.string().trim().max(120),
  brand: z.string().trim().max(120),
  dosage_form: z.string().trim().min(1, "Select a dosage form"),
  strength: z.string().trim().max(60),
  unit: z.string().trim().min(1, "Unit is required").max(40),
  reorder_level: z.coerce.number().int("Whole numbers only").min(0, "Cannot be negative").max(100000),
  storage_location: z.string().trim().max(120),
});

type FormState = {
  name: string;
  generic_name: string;
  brand: string;
  category_id: string;
  dosage_form: string;
  strength: string;
  unit: string;
  reorder_level: string;
  storage_location: string;
  prescription_required: boolean;
  is_active: boolean;
};

const emptyForm = (defaultReorder: number): FormState => ({
  name: "",
  generic_name: "",
  brand: "",
  category_id: "none",
  dosage_form: "Tablet",
  strength: "",
  unit: "Tablets",
  reorder_level: String(defaultReorder),
  storage_location: "",
  prescription_required: false,
  is_active: true,
});

function MedicinesPage() {
  const { can, fullName, user } = useAuth();
  const queryClient = useQueryClient();
  const settings = useQuery({ queryKey: qk.settings, queryFn: getSettings });
  const medicines = useQuery({ queryKey: qk.medicines, queryFn: getMedicines });
  const categories = useQuery({ queryKey: qk.categories, queryFn: getCategories });
  const batches = useQuery({ queryKey: qk.batches, queryFn: getBatches });

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [stockFilter, setStockFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Medicine | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm(50));
  const [errors, setErrors] = useState<Record<string, string>>({});

  const stockMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const b of batches.data ?? []) {
      if (daysUntil(b.expiry_date) <= 0) continue;
      map.set(b.medicine_id, (map.get(b.medicine_id) ?? 0) + b.current_quantity);
    }
    return map;
  }, [batches.data]);

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (medicines.data ?? [])
      .map((m) => ({ medicine: m, quantity: stockMap.get(m.id) ?? 0 }))
      .filter(({ medicine: m, quantity }) => {
        if (term) {
          const haystack = `${m.name} ${m.generic_name ?? ""} ${m.brand ?? ""} ${m.code}`.toLowerCase();
          if (!haystack.includes(term)) return false;
        }
        if (categoryFilter !== "all" && m.category_id !== categoryFilter) return false;
        if (stockFilter === "low" && quantity > m.reorder_level) return false;
        if (stockFilter === "out" && quantity > 0) return false;
        if (stockFilter === "ok" && quantity <= m.reorder_level) return false;
        return true;
      });
  }, [medicines.data, stockMap, search, categoryFilter, stockFilter]);

  const openCreate = () => {
    setEditing(null);
    setErrors({});
    setForm(emptyForm(settings.data?.default_reorder_level ?? 50));
    setOpen(true);
  };

  const openEdit = (m: Medicine) => {
    setEditing(m);
    setErrors({});
    setForm({
      name: m.name,
      generic_name: m.generic_name ?? "",
      brand: m.brand ?? "",
      category_id: m.category_id ?? "none",
      dosage_form: m.dosage_form,
      strength: m.strength ?? "",
      unit: m.unit,
      reorder_level: String(m.reorder_level),
      storage_location: m.storage_location ?? "",
      prescription_required: m.prescription_required,
      is_active: m.is_active,
    });
    setOpen(true);
  };

  const save = useMutation({
    mutationFn: async () => {
      const parsed = medicineSchema.safeParse(form);
      if (!parsed.success) {
        const map: Record<string, string> = {};
        for (const issue of parsed.error.issues) map[String(issue.path[0])] = issue.message;
        setErrors(map);
        throw new Error("Please fix the highlighted fields");
      }
      setErrors({});
      const payload = {
        name: parsed.data.name,
        generic_name: parsed.data.generic_name || null,
        brand: parsed.data.brand || null,
        category_id: form.category_id === "none" ? null : form.category_id,
        dosage_form: parsed.data.dosage_form,
        strength: parsed.data.strength || null,
        unit: parsed.data.unit,
        reorder_level: parsed.data.reorder_level,
        storage_location: parsed.data.storage_location || null,
        prescription_required: form.prescription_required,
        is_active: form.is_active,
      };
      if (editing) {
        const { error } = await supabase.from("medicines").update(payload).eq("id", editing.id);
        if (error) throw new Error(error.message);
        await logAudit({
          action: "Updated medicine",
          module: "Medicines",
          record_ref: editing.code,
          description: `${fullName || "A user"} updated medicine ${payload.name}`,
          user_name: fullName || null,
          user_id: user?.id ?? null,
        });
      } else {
        const { data, error } = await supabase
          .from("medicines")
          .insert(payload)
          .select("code")
          .single();
        if (error) throw new Error(error.message);
        await logAudit({
          action: "Created medicine",
          module: "Medicines",
          record_ref: data?.code ?? null,
          description: `${fullName || "A user"} added medicine ${payload.name}`,
          user_name: fullName || null,
          user_id: user?.id ?? null,
        });
      }
    },
    onSuccess: async () => {
      toast.success(editing ? "Medicine updated" : "Medicine added");
      setOpen(false);
      await queryClient.invalidateQueries({ queryKey: qk.medicines });
      await queryClient.invalidateQueries({ queryKey: qk.audit });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <>
      <PageHeader
        title="Medicines"
        description="Master catalogue of all medicines stocked by the pharmacy"
        actions={
          can("manageMedicines") ? (
            <Button size="sm" onClick={openCreate}>
              <Plus className="mr-1.5 size-3.5" /> Add Medicine
            </Button>
          ) : null
        }
      />

      <Panel
        title="Catalogue"
        description={`${rows.length} of ${(medicines.data ?? []).length} medicines`}
      >
        <div className="grid gap-3 border-b border-border p-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="relative sm:col-span-2">
            <Search className="pointer-events-none absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, generic name, brand or code"
              className="pl-8"
              aria-label="Search medicines"
            />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger aria-label="Filter by category">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {(categories.data ?? []).map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={stockFilter} onValueChange={setStockFilter}>
            <SelectTrigger aria-label="Filter by stock status">
              <SelectValue placeholder="Stock status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All stock levels</SelectItem>
              <SelectItem value="ok">In stock</SelectItem>
              <SelectItem value="low">Low stock</SelectItem>
              <SelectItem value="out">Out of stock</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {medicines.isLoading ? (
          <LoadingRows />
        ) : rows.length === 0 ? (
          <EmptyState
            title="No medicines match your filters."
            description="Try a different search term or add a new medicine to the catalogue."
          />
        ) : (
          <TableWrap>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Medicine</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Form</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead className="text-right">Stock</TableHead>
                  <TableHead className="text-right">Reorder</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(({ medicine: m, quantity }) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-mono text-xs">{m.code}</TableCell>
                    <TableCell>
                      <Link
                        to="/medicines/$id"
                        params={{ id: m.id }}
                        className="font-medium hover:text-primary hover:underline"
                      >
                        {medicineLabel(m)}
                      </Link>
                      <span className="block text-xs text-muted-foreground">
                        {m.generic_name ?? "—"}
                        {m.brand ? ` · ${m.brand}` : ""}
                        {m.prescription_required ? " · Rx" : ""}
                      </span>
                    </TableCell>
                    <TableCell>{m.medicine_categories?.name ?? "—"}</TableCell>
                    <TableCell>{m.dosage_form}</TableCell>
                    <TableCell>{m.unit}</TableCell>
                    <TableCell className="text-right tabular">{quantity}</TableCell>
                    <TableCell className="text-right tabular">{m.reorder_level}</TableCell>
                    <TableCell>
                      {m.is_active ? (
                        <StockBadge quantity={quantity} reorderLevel={m.reorder_level} />
                      ) : (
                        <StatusBadge tone="neutral">Inactive</StatusBadge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button asChild size="sm" variant="ghost">
                          <Link to="/medicines/$id" params={{ id: m.id }}>
                            View
                          </Link>
                        </Button>
                        {can("manageMedicines") ? (
                          <Button size="sm" variant="outline" onClick={() => openEdit(m)}>
                            <Pencil className="size-3.5" />
                            <span className="sr-only">Edit {m.name}</span>
                          </Button>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableWrap>
        )}
      </Panel>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit medicine" : "Add medicine"}</DialogTitle>
            <DialogDescription>
              Medicine codes are generated automatically by the system.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="name">Medicine name *</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="mt-1"
              />
              <FieldError message={errors["name"]} />
            </div>
            <div>
              <Label htmlFor="generic">Generic name</Label>
              <Input
                id="generic"
                value={form.generic_name}
                onChange={(e) => setForm({ ...form, generic_name: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="brand">Brand</Label>
              <Input
                id="brand"
                value={form.brand}
                onChange={(e) => setForm({ ...form, brand: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Category</Label>
              <Select
                value={form.category_id}
                onValueChange={(v) => setForm({ ...form, category_id: v })}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Uncategorised</SelectItem>
                  {(categories.data ?? []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Dosage form *</Label>
              <Select
                value={form.dosage_form}
                onValueChange={(v) => setForm({ ...form, dosage_form: v })}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DOSAGE_FORMS.map((d) => (
                    <SelectItem key={d} value={d}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError message={errors["dosage_form"]} />
            </div>
            <div>
              <Label htmlFor="strength">Strength</Label>
              <Input
                id="strength"
                value={form.strength}
                onChange={(e) => setForm({ ...form, strength: e.target.value })}
                placeholder="500mg"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="unit">Unit *</Label>
              <Input
                id="unit"
                value={form.unit}
                onChange={(e) => setForm({ ...form, unit: e.target.value })}
                placeholder="Tablets, Bottles, Vials"
                className="mt-1"
              />
              <FieldError message={errors["unit"]} />
            </div>
            <div>
              <Label htmlFor="reorder">Reorder level *</Label>
              <Input
                id="reorder"
                type="number"
                min={0}
                value={form.reorder_level}
                onChange={(e) => setForm({ ...form, reorder_level: e.target.value })}
                className="mt-1"
              />
              <FieldError message={errors["reorder_level"]} />
            </div>
            <div>
              <Label htmlFor="storage">Storage location</Label>
              <Input
                id="storage"
                value={form.storage_location}
                onChange={(e) => setForm({ ...form, storage_location: e.target.value })}
                placeholder="Shelf A2"
                className="mt-1"
              />
            </div>
            <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
              <Label htmlFor="rx" className="text-sm font-normal">
                Prescription required
              </Label>
              <Switch
                id="rx"
                checked={form.prescription_required}
                onCheckedChange={(v) => setForm({ ...form, prescription_required: v })}
              />
            </div>
            <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
              <Label htmlFor="active" className="text-sm font-normal">
                Active
              </Label>
              <Switch
                id="active"
                checked={form.is_active}
                onCheckedChange={(v) => setForm({ ...form, is_active: v })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              {editing ? "Save changes" : "Add medicine"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
