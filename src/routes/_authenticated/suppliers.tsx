import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
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
import { getBatches, getSuppliers, qk, type Supplier } from "@/lib/pharmacy";

export const Route = createFileRoute("/_authenticated/suppliers")({
  head: () => ({
    meta: [
      { title: "Suppliers — MediStock Pharmacy" },
      {
        name: "description",
        content:
          "Manage pharmacy suppliers, contact details and see which medicines each supplier delivers.",
      },
      { property: "og:title", content: "Suppliers — MediStock Pharmacy" },
      {
        property: "og:description",
        content: "Supplier directory with contacts and supplied medicine counts.",
      },
    ],
  }),
  component: SuppliersPage,
});

const supplierSchema = z.object({
  name: z.string().trim().min(2, "Supplier name is required").max(120),
  contact_person: z.string().trim().max(120),
  phone: z.string().trim().max(30),
  email: z.union([z.literal(""), z.string().trim().email("Enter a valid email address").max(255)]),
  address: z.string().trim().max(300),
  notes: z.string().trim().max(500),
});

type FormState = z.infer<typeof supplierSchema> & { is_active: boolean };

const emptyForm: FormState = {
  name: "",
  contact_person: "",
  phone: "",
  email: "",
  address: "",
  notes: "",
  is_active: true,
};

function SuppliersPage() {
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const suppliers = useQuery({ queryKey: qk.suppliers, queryFn: getSuppliers });
  const batches = useQuery({ queryKey: qk.batches, queryFn: getBatches });

  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const supplyCount = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const b of batches.data ?? []) {
      if (!b.supplier_id) continue;
      const set = map.get(b.supplier_id) ?? new Set<string>();
      set.add(b.medicine_id);
      map.set(b.supplier_id, set);
    }
    return map;
  }, [batches.data]);

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (suppliers.data ?? []).filter((s) =>
      term
        ? `${s.name} ${s.contact_person ?? ""} ${s.phone ?? ""} ${s.email ?? ""}`
            .toLowerCase()
            .includes(term)
        : true,
    );
  }, [suppliers.data, search]);

  const openEdit = (s: Supplier) => {
    setEditing(s);
    setErrors({});
    setForm({
      name: s.name,
      contact_person: s.contact_person ?? "",
      phone: s.phone ?? "",
      email: s.email ?? "",
      address: s.address ?? "",
      notes: s.notes ?? "",
      is_active: s.is_active,
    });
    setOpen(true);
  };

  const save = useMutation({
    mutationFn: async () => {
      const parsed = supplierSchema.safeParse(form);
      if (!parsed.success) {
        const map: Record<string, string> = {};
        for (const issue of parsed.error.issues) map[String(issue.path[0])] = issue.message;
        setErrors(map);
        throw new Error("Please fix the highlighted fields");
      }
      setErrors({});
      const payload = {
        name: parsed.data.name,
        contact_person: parsed.data.contact_person || null,
        phone: parsed.data.phone || null,
        email: parsed.data.email || null,
        address: parsed.data.address || null,
        notes: parsed.data.notes || null,
        is_active: form.is_active,
      };
      if (editing) {
        const { error } = await supabase.from("suppliers").update(payload).eq("id", editing.id);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabase.from("suppliers").insert(payload);
        if (error) throw new Error(error.message);
      }
    },
    onSuccess: async () => {
      toast.success(editing ? "Supplier updated" : "Supplier added");
      setOpen(false);
      await queryClient.invalidateQueries({ queryKey: qk.suppliers });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <>
      <PageHeader
        title="Suppliers"
        description="Wholesalers and distributors that deliver stock to the pharmacy"
        actions={
          can("manageSuppliers") ? (
            <Button
              size="sm"
              onClick={() => {
                setEditing(null);
                setForm(emptyForm);
                setErrors({});
                setOpen(true);
              }}
            >
              <Plus className="mr-1.5 size-3.5" /> Add Supplier
            </Button>
          ) : null
        }
      />

      <Panel title="Supplier directory" description={`${rows.length} suppliers`}>
        <div className="border-b border-border p-4">
          <div className="relative max-w-md">
            <Search className="pointer-events-none absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search suppliers"
              className="pl-8"
              aria-label="Search suppliers"
            />
          </div>
        </div>

        {suppliers.isLoading ? (
          <LoadingRows />
        ) : rows.length === 0 ? (
          <EmptyState title="No suppliers found." description="Add your first supplier to start recording deliveries." />
        ) : (
          <TableWrap>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Contact person</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead className="text-right">Medicines supplied</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">
                      {s.name}
                      {s.address ? (
                        <span className="block text-xs text-muted-foreground">{s.address}</span>
                      ) : null}
                    </TableCell>
                    <TableCell>{s.contact_person ?? "—"}</TableCell>
                    <TableCell>{s.phone ?? "—"}</TableCell>
                    <TableCell>{s.email ?? "—"}</TableCell>
                    <TableCell className="text-right tabular">
                      {supplyCount.get(s.id)?.size ?? 0}
                    </TableCell>
                    <TableCell>
                      {s.is_active ? (
                        <StatusBadge tone="success">Active</StatusBadge>
                      ) : (
                        <StatusBadge tone="neutral">Inactive</StatusBadge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {can("manageSuppliers") ? (
                        <Button size="sm" variant="outline" onClick={() => openEdit(s)}>
                          <Pencil className="size-3.5" />
                          <span className="sr-only">Edit {s.name}</span>
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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit supplier" : "Add supplier"}</DialogTitle>
            <DialogDescription>
              Suppliers can be linked to stock deliveries and medicine batches.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="sname">Supplier name *</Label>
              <Input
                id="sname"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="mt-1"
              />
              <FieldError message={errors["name"]} />
            </div>
            <div>
              <Label htmlFor="contact">Contact person</Label>
              <Input
                id="contact"
                value={form.contact_person}
                onChange={(e) => setForm({ ...form, contact_person: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="mt-1"
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="mt-1"
              />
              <FieldError message={errors["email"]} />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="address">Address</Label>
              <Textarea
                id="address"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                rows={2}
                className="mt-1"
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="snotes">Notes</Label>
              <Textarea
                id="snotes"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={2}
                className="mt-1"
              />
            </div>
            <div className="flex items-center justify-between rounded-md border border-border px-3 py-2 sm:col-span-2">
              <Label htmlFor="sactive" className="text-sm font-normal">
                Active supplier
              </Label>
              <Switch
                id="sactive"
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
              {editing ? "Save changes" : "Add supplier"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
