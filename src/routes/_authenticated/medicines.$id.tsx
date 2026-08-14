import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  LoadingRows,
  PageHeader,
  Panel,
  StatCard,
  StatusBadge,
  StockBadge,
  TableWrap,
} from "@/components/pharmacy-ui";
import {
  daysUntil,
  fefoBatches,
  formatDate,
  formatDateTime,
  getBatches,
  getMedicines,
  getSettings,
  getTransactions,
  medicineLabel,
  qk,
  TXN_TYPE_LABELS,
} from "@/lib/pharmacy";

export const Route = createFileRoute("/_authenticated/medicines/$id")({
  head: () => ({
    meta: [
      { title: "Medicine Details — MediStock Pharmacy" },
      {
        name: "description",
        content:
          "Batch-level stock, expiry dates and full stock movement history for a single pharmacy medicine.",
      },
      { property: "og:title", content: "Medicine Details — MediStock Pharmacy" },
      {
        property: "og:description",
        content: "Batches, expiry status and stock movement history for this medicine.",
      },
    ],
  }),
  component: MedicineDetailPage,
});

function MedicineDetailPage() {
  const { id } = Route.useParams();
  const settings = useQuery({ queryKey: qk.settings, queryFn: getSettings });
  const medicines = useQuery({ queryKey: qk.medicines, queryFn: getMedicines });
  const batches = useQuery({ queryKey: qk.batches, queryFn: getBatches });
  const txns = useQuery({ queryKey: qk.transactions, queryFn: () => getTransactions(300) });

  const warnDays = settings.data?.expiry_warning_days ?? 90;
  const medicine = (medicines.data ?? []).find((m) => m.id === id);
  const medBatches = (batches.data ?? []).filter((b) => b.medicine_id === id);
  const usable = fefoBatches(medBatches);
  const totalStock = usable.reduce((s, b) => s + b.current_quantity, 0);
  const expiredUnits = medBatches
    .filter((b) => daysUntil(b.expiry_date) <= 0)
    .reduce((s, b) => s + b.current_quantity, 0);
  const history = (txns.data ?? []).filter((t) => t.medicine_id === id);

  if (medicines.isLoading) return <LoadingRows />;
  if (!medicine) {
    return (
      <EmptyState
        title="Medicine not found."
        description="It may have been removed from the catalogue."
        action={
          <Button asChild variant="outline">
            <Link to="/medicines">Back to medicines</Link>
          </Button>
        }
      />
    );
  }

  return (
    <>
      <PageHeader
        title={medicineLabel(medicine)}
        description={`${medicine.code} · ${medicine.dosage_form} · ${medicine.unit}`}
        actions={
          <>
            <Button asChild size="sm" variant="outline">
              <Link to="/medicines">
                <ArrowLeft className="mr-1.5 size-3.5" /> All medicines
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link to="/dispensing">Dispense</Link>
            </Button>
            <Button asChild size="sm">
              <Link to="/purchases">Receive stock</Link>
            </Button>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Usable Stock"
          value={totalStock}
          hint={`${usable.length} valid batches`}
          tone="info"
        />
        <StatCard label="Reorder Level" value={medicine.reorder_level} hint={medicine.unit} />
        <StatCard label="Expired Units" value={expiredUnits} tone="danger" hint="Quarantine and write off" />
        <StatCard
          label="Next Expiry"
          value={usable[0] ? formatDate(usable[0].expiry_date) : "—"}
          hint={usable[0] ? `Batch ${usable[0].batch_number}` : "No usable batches"}
          tone="warning"
        />
      </div>

      <Panel title="Medicine information">
        <dl className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3">
          <Info label="Generic name" value={medicine.generic_name ?? "—"} />
          <Info label="Brand" value={medicine.brand ?? "—"} />
          <Info label="Category" value={medicine.medicine_categories?.name ?? "Uncategorised"} />
          <Info label="Strength" value={medicine.strength ?? "—"} />
          <Info label="Storage location" value={medicine.storage_location ?? "—"} />
          <Info
            label="Prescription"
            value={medicine.prescription_required ? "Required" : "Not required"}
          />
          <Info label="Status" value={medicine.is_active ? "Active" : "Inactive"} />
          <Info label="Added" value={formatDate(medicine.created_at)} />
          <div>
            <dt className="text-xs tracking-wide text-muted-foreground uppercase">Stock status</dt>
            <dd className="mt-1">
              <StockBadge quantity={totalStock} reorderLevel={medicine.reorder_level} />
            </dd>
          </div>
        </dl>
      </Panel>

      <Panel title="Batches" description="Ordered earliest expiry first (FEFO)">
        {medBatches.length === 0 ? (
          <EmptyState title="No batches recorded for this medicine yet." />
        ) : (
          <TableWrap>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Batch</TableHead>
                  <TableHead className="text-right">Received</TableHead>
                  <TableHead className="text-right">Remaining</TableHead>
                  <TableHead>Manufactured</TableHead>
                  <TableHead>Expiry</TableHead>
                  <TableHead className="text-right">Days Left</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...medBatches]
                  .sort((a, b) => a.expiry_date.localeCompare(b.expiry_date))
                  .map((b) => (
                    <TableRow key={b.id}>
                      <TableCell className="font-mono text-xs">{b.batch_number}</TableCell>
                      <TableCell className="text-right tabular">{b.quantity_received}</TableCell>
                      <TableCell className="text-right tabular">{b.current_quantity}</TableCell>
                      <TableCell>{formatDate(b.manufacturing_date)}</TableCell>
                      <TableCell>{formatDate(b.expiry_date)}</TableCell>
                      <TableCell className="text-right tabular">{daysUntil(b.expiry_date)}</TableCell>
                      <TableCell>{b.suppliers?.name ?? "—"}</TableCell>
                      <TableCell>
                        <ExpiryBadge days={daysUntil(b.expiry_date)} warnDays={warnDays} />
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </TableWrap>
        )}
      </Panel>

      <Panel title="Stock movement history">
        {txns.isLoading ? (
          <LoadingRows />
        ) : history.length === 0 ? (
          <EmptyState title="No stock movements recorded for this medicine." />
        ) : (
          <TableWrap>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date / Time</TableHead>
                  <TableHead>Batch</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Change</TableHead>
                  <TableHead className="text-right">New Qty</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>User</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {formatDateTime(t.created_at)}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{t.batch_number ?? "—"}</TableCell>
                    <TableCell>
                      <StatusBadge
                        tone={
                          t.txn_type === "received"
                            ? "success"
                            : t.txn_type === "dispensed"
                              ? "info"
                              : t.txn_type === "expired" || t.txn_type === "damaged"
                                ? "danger"
                                : "neutral"
                        }
                      >
                        {TXN_TYPE_LABELS[t.txn_type] ?? t.txn_type}
                      </StatusBadge>
                    </TableCell>
                    <TableCell
                      className={
                        t.quantity_change < 0
                          ? "text-right tabular text-destructive"
                          : "text-right tabular text-success"
                      }
                    >
                      {t.quantity_change > 0 ? `+${t.quantity_change}` : t.quantity_change}
                    </TableCell>
                    <TableCell className="text-right tabular">{t.new_quantity}</TableCell>
                    <TableCell className="max-w-[18rem] truncate">{t.reason ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{t.user_name ?? "—"}</TableCell>
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

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs tracking-wide text-muted-foreground uppercase">{label}</dt>
      <dd className="mt-1 text-sm text-foreground">{value}</dd>
    </div>
  );
}
