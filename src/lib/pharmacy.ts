import { supabase } from "@/integrations/supabase/client";

export type Role = "admin" | "pharmacist" | "assistant";

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Admin",
  pharmacist: "Pharmacist",
  assistant: "Pharmacy Assistant",
};

export const DOSAGE_FORMS = [
  "Tablet",
  "Capsule",
  "Syrup",
  "Injection",
  "Cream",
  "Ointment",
  "Drops",
  "Inhaler",
  "Suspension",
] as const;

export const ADJUSTMENT_REASONS = [
  "Damaged",
  "Expired",
  "Lost",
  "Physical count correction",
  "Returned",
  "Other",
] as const;

export const TXN_TYPE_LABELS: Record<string, string> = {
  received: "Stock Received",
  dispensed: "Dispensed",
  damaged: "Damaged",
  expired: "Expired",
  returned: "Returned",
  adjustment: "Manual Adjustment",
};

export interface Category {
  id: string;
  name: string;
  description: string | null;
}

export interface Supplier {
  id: string;
  name: string;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
}

export interface Medicine {
  id: string;
  code: string;
  name: string;
  generic_name: string | null;
  brand: string | null;
  category_id: string | null;
  dosage_form: string;
  strength: string | null;
  unit: string;
  reorder_level: number;
  storage_location: string | null;
  prescription_required: boolean;
  is_active: boolean;
  created_at: string;
  medicine_categories?: { name: string } | null;
}

export interface Batch {
  id: string;
  medicine_id: string;
  batch_number: string;
  quantity_received: number;
  current_quantity: number;
  manufacturing_date: string | null;
  expiry_date: string;
  purchase_price: number | null;
  supplier_id: string | null;
  date_received: string;
  storage_location: string | null;
  medicines?: Pick<Medicine, "id" | "name" | "strength" | "unit" | "reorder_level" | "code"> | null;
  suppliers?: { name: string } | null;
}

export interface StockTransaction {
  id: string;
  medicine_id: string;
  batch_number: string | null;
  txn_type: string;
  quantity_change: number;
  previous_quantity: number;
  new_quantity: number;
  reason: string | null;
  user_name: string | null;
  created_at: string;
  medicines?: { name: string; strength: string | null; unit: string } | null;
}

export interface Settings {
  pharmacy_name: string;
  expiry_warning_days: number;
  default_reorder_level: number;
  low_stock_notifications: boolean;
  expiry_notifications: boolean;
}

/* ---------- date / status helpers ---------- */

export function daysUntil(date: string): number {
  const target = new Date(date + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

export type ExpiryStatus = "expired" | "expiring" | "ok";

export function expiryStatus(expiry: string, warnDays: number): ExpiryStatus {
  const d = daysUntil(expiry);
  if (d <= 0) return "expired";
  if (d <= warnDays) return "expiring";
  return "ok";
}

export type StockStatus = "out" | "low" | "ok";

export function stockStatus(quantity: number, reorderLevel: number): StockStatus {
  if (quantity <= 0) return "out";
  if (quantity <= reorderLevel) return "low";
  return "ok";
}

export function formatDate(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value.length <= 10 ? value + "T00:00:00" : value);
  return d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

export function formatDateTime(value?: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function isToday(value: string): boolean {
  const d = new Date(value);
  const now = new Date();
  return d.toDateString() === now.toDateString();
}

export function medicineLabel(m?: { name: string; strength?: string | null } | null): string {
  if (!m) return "—";
  return m.strength && !m.name.includes(m.strength) ? `${m.name} (${m.strength})` : m.name;
}

/** FEFO: earliest expiry first, excluding expired and empty batches. */
export function fefoBatches(batches: Batch[]): Batch[] {
  return batches
    .filter((b) => b.current_quantity > 0 && daysUntil(b.expiry_date) > 0)
    .sort((a, b) => a.expiry_date.localeCompare(b.expiry_date));
}

/* ---------- data access ---------- */

function unwrap<T>({ data, error }: { data: T | null; error: { message: string } | null }): T {
  if (error) throw new Error(error.message);
  return (data ?? []) as T;
}

export const qk = {
  medicines: ["medicines"] as const,
  categories: ["categories"] as const,
  suppliers: ["suppliers"] as const,
  batches: ["batches"] as const,
  transactions: ["transactions"] as const,
  purchases: ["purchases"] as const,
  dispensings: ["dispensings"] as const,
  patients: ["patients"] as const,
  prescriptions: ["prescriptions"] as const,
  audit: ["audit"] as const,
  settings: ["settings"] as const,
  staff: ["staff"] as const,
};

export async function getSettings(): Promise<Settings> {
  const { data, error } = await supabase.from("settings").select("*").limit(1).maybeSingle();
  if (error) throw new Error(error.message);
  return (
    (data as Settings | null) ?? {
      pharmacy_name: "Clinic Pharmacy",
      expiry_warning_days: 90,
      default_reorder_level: 50,
      low_stock_notifications: true,
      expiry_notifications: true,
    }
  );
}

export async function getMedicines(): Promise<Medicine[]> {
  return unwrap(
    await supabase
      .from("medicines")
      .select("*, medicine_categories(name)")
      .order("name", { ascending: true }),
  ) as Medicine[];
}

export async function getCategories(): Promise<Category[]> {
  return unwrap(
    await supabase.from("medicine_categories").select("*").order("name"),
  ) as Category[];
}

export async function getSuppliers(): Promise<Supplier[]> {
  return unwrap(await supabase.from("suppliers").select("*").order("name")) as Supplier[];
}

export async function getBatches(): Promise<Batch[]> {
  return unwrap(
    await supabase
      .from("medicine_batches")
      .select(
        "*, medicines(id, code, name, strength, unit, reorder_level), suppliers(name)",
      )
      .order("expiry_date", { ascending: true }),
  ) as Batch[];
}

export async function getTransactions(limit = 300): Promise<StockTransaction[]> {
  return unwrap(
    await supabase
      .from("stock_transactions")
      .select("*, medicines(name, strength, unit)")
      .order("created_at", { ascending: false })
      .limit(limit),
  ) as StockTransaction[];
}

export async function getPurchases() {
  return unwrap(
    await supabase
      .from("purchases")
      .select(
        "*, suppliers(name), purchase_items(id, quantity, batch_number, purchase_price, expiry_date, medicines(name, strength, unit))",
      )
      .order("purchase_date", { ascending: false }),
  );
}

export async function getDispensings() {
  return unwrap(
    await supabase
      .from("dispensings")
      .select(
        "*, patients(name, code), prescriptions(code, doctor_name), dispensing_items(id, quantity, batch_number, medicines(name, strength, unit))",
      )
      .order("dispensed_at", { ascending: false }),
  );
}

export async function getPatients() {
  return unwrap(await supabase.from("patients").select("*").order("name"));
}

export async function getPrescriptions() {
  return unwrap(
    await supabase
      .from("prescriptions")
      .select(
        "*, patients(id, name, code), prescription_items(id, prescribed_quantity, dosage_instructions, duration, medicine_id, medicines(name, strength, unit))",
      )
      .order("prescription_date", { ascending: false }),
  );
}

export async function getAuditLogs() {
  return unwrap(
    await supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(300),
  );
}

export async function getStaff() {
  const profiles = unwrap(
    await supabase.from("profiles").select("*").order("created_at"),
  ) as { id: string; full_name: string; email: string; is_active: boolean; created_at: string }[];
  const roles = unwrap(await supabase.from("user_roles").select("user_id, role")) as {
    user_id: string;
    role: Role;
  }[];
  return profiles.map((p) => ({
    ...p,
    role: roles.find((r) => r.user_id === p.id)?.role ?? null,
  }));
}

export async function logAudit(input: {
  action: string;
  module: string;
  record_ref?: string | null;
  description: string;
  user_name: string | null;
  user_id?: string | null;
}) {
  await supabase.from("audit_logs").insert({
    action: input.action,
    module: input.module,
    record_ref: input.record_ref ?? null,
    description: input.description,
    user_name: input.user_name,
    user_id: input.user_id ?? null,
  });
}

export function toCsv(rows: Record<string, unknown>[], filename: string) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]!);
  const escape = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => escape(r[h])).join(",")),
  ].join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
