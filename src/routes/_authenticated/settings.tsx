import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
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
  LoadingRows,
  PageHeader,
  Panel,
  StatusBadge,
  TableWrap,
} from "@/components/pharmacy-ui";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import {
  getCategories,
  getSettings,
  logAudit,
  qk,
  ROLE_LABELS,
  type Category,
  type Settings,
} from "@/lib/pharmacy";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings — MediStock Pharmacy" },
      {
        name: "description",
        content:
          "Configure pharmacy name, expiry warning window, default reorder level, alert preferences and medicine categories.",
      },
      { property: "og:title", content: "Settings — MediStock Pharmacy" },
      {
        property: "og:description",
        content: "Pharmacy preferences, alert thresholds and medicine categories.",
      },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { can, role, fullName, user } = useAuth();
  const queryClient = useQueryClient();
  const settings = useQuery({ queryKey: qk.settings, queryFn: getSettings });
  const categories = useQuery({ queryKey: qk.categories, queryFn: getCategories });

  const canEdit = can("manageSettings");
  const [form, setForm] = useState<Settings | null>(null);
  const [newCategory, setNewCategory] = useState("");
  const [newCategoryDesc, setNewCategoryDesc] = useState("");

  useEffect(() => {
    if (settings.data && !form) setForm(settings.data);
  }, [settings.data, form]);

  const saveSettings = useMutation({
    mutationFn: async () => {
      if (!form) return;
      if (form.pharmacy_name.trim().length < 2) throw new Error("Pharmacy name is required");
      if (form.expiry_warning_days < 1 || form.expiry_warning_days > 730)
        throw new Error("Expiry warning must be between 1 and 730 days");
      if (form.default_reorder_level < 0) throw new Error("Reorder level cannot be negative");
      const { error } = await supabase
        .from("settings")
        .update({
          pharmacy_name: form.pharmacy_name.trim(),
          expiry_warning_days: form.expiry_warning_days,
          default_reorder_level: form.default_reorder_level,
          low_stock_notifications: form.low_stock_notifications,
          expiry_notifications: form.expiry_notifications,
        })
        .eq("id", true);
      if (error) throw new Error(error.message);
      await logAudit({
        action: "Updated settings",
        module: "Settings",
        description: `${fullName} updated pharmacy settings`,
        user_name: fullName,
        user_id: user?.id ?? null,
      });
    },
    onSuccess: async () => {
      toast.success("Settings saved");
      await queryClient.invalidateQueries({ queryKey: qk.settings });
      await queryClient.invalidateQueries({ queryKey: qk.audit });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addCategory = useMutation({
    mutationFn: async () => {
      if (newCategory.trim().length < 2) throw new Error("Category name is required");
      const { error } = await supabase.from("medicine_categories").insert({
        name: newCategory.trim(),
        description: newCategoryDesc.trim() || null,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: async () => {
      toast.success("Category added");
      setNewCategory("");
      setNewCategoryDesc("");
      await queryClient.invalidateQueries({ queryKey: qk.categories });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <PageHeader
        title="Settings"
        description="Pharmacy preferences, alert thresholds and medicine categories"
        actions={
          <StatusBadge tone="info">
            Signed in as {role ? ROLE_LABELS[role] : "No role"}
          </StatusBadge>
        }
      />

      <Panel
        title="Pharmacy preferences"
        description={canEdit ? "Only admins can change these values" : "Read only — admin access required"}
      >
        {settings.isLoading || !form ? (
          <LoadingRows />
        ) : (
          <div className="grid gap-4 p-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="pharmacy">Pharmacy name</Label>
              <Input
                id="pharmacy"
                value={form.pharmacy_name}
                disabled={!canEdit}
                onChange={(e) => setForm({ ...form, pharmacy_name: e.target.value })}
                className="mt-1 sm:max-w-md"
              />
            </div>
            <div>
              <Label htmlFor="warn">Expiry warning window (days)</Label>
              <Input
                id="warn"
                inputMode="numeric"
                value={String(form.expiry_warning_days)}
                disabled={!canEdit}
                onChange={(e) =>
                  setForm({ ...form, expiry_warning_days: Number(e.target.value) || 0 })
                }
                className="mt-1"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Batches expiring within this window are flagged as expiring soon.
              </p>
            </div>
            <div>
              <Label htmlFor="reorder">Default reorder level</Label>
              <Input
                id="reorder"
                inputMode="numeric"
                value={String(form.default_reorder_level)}
                disabled={!canEdit}
                onChange={(e) =>
                  setForm({ ...form, default_reorder_level: Number(e.target.value) || 0 })
                }
                className="mt-1"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Applied to new medicines when no reorder level is entered.
              </p>
            </div>
            <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
              <Label htmlFor="lowstock" className="text-sm font-normal">
                Low stock alerts
              </Label>
              <Switch
                id="lowstock"
                checked={form.low_stock_notifications}
                disabled={!canEdit}
                onCheckedChange={(v) => setForm({ ...form, low_stock_notifications: v })}
              />
            </div>
            <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
              <Label htmlFor="expalert" className="text-sm font-normal">
                Expiry alerts
              </Label>
              <Switch
                id="expalert"
                checked={form.expiry_notifications}
                disabled={!canEdit}
                onCheckedChange={(v) => setForm({ ...form, expiry_notifications: v })}
              />
            </div>
            {canEdit ? (
              <div className="sm:col-span-2">
                <Button onClick={() => saveSettings.mutate()} disabled={saveSettings.isPending}>
                  Save settings
                </Button>
              </div>
            ) : null}
          </div>
        )}
      </Panel>

      <Panel
        title="Medicine categories"
        description="Used to group medicines in the catalogue and filters"
      >
        {canEdit ? (
          <div className="grid gap-3 border-b border-border p-4 sm:grid-cols-12">
            <div className="sm:col-span-4">
              <Label htmlFor="catname">Category name</Label>
              <Input
                id="catname"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                className="mt-1"
              />
            </div>
            <div className="sm:col-span-6">
              <Label htmlFor="catdesc">Description</Label>
              <Textarea
                id="catdesc"
                rows={1}
                value={newCategoryDesc}
                onChange={(e) => setNewCategoryDesc(e.target.value)}
                className="mt-1"
              />
            </div>
            <div className="flex items-end sm:col-span-2">
              <Button
                className="w-full"
                onClick={() => addCategory.mutate()}
                disabled={addCategory.isPending}
              >
                <Plus className="mr-1.5 size-3.5" /> Add
              </Button>
            </div>
          </div>
        ) : null}

        {categories.isLoading ? (
          <LoadingRows />
        ) : (categories.data ?? []).length === 0 ? (
          <EmptyState title="No categories yet." />
        ) : (
          <TableWrap>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Category</TableHead>
                  <TableHead>Description</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {((categories.data ?? []) as Category[]).map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {c.description ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableWrap>
        )}
      </Panel>
    </>
  );
}
