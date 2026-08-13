import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowDownRight,
  ArrowUpRight,
  Boxes,
  CircleAlert,
  Pill,
  SlidersHorizontal,
  TriangleAlert,
} from "lucide-react";
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
  formatDate,
  formatDateTime,
  getBatches,
  getMedicines,
  getSettings,
  getTransactions,
  isToday,
  medicineLabel,
  qk,
  TXN_TYPE_LABELS,
  type Batch,
} from "@/lib/pharmacy";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Pharmacy Dashboard — MediStock" },
      {
        name: "description",
        content:
          "Live overview of stock levels, low stock medicines, expiring batches and today's pharmacy activity.",
      },
      { property: "og:title", content: "Pharmacy Dashboard — MediStock" },
      {
        property: "og:description",
        content: "Stock levels, low stock, expiry alerts and daily pharmacy activity.",
      },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const settings = useQuery({ queryKey: qk.settings, queryFn: getSettings });
  const medicines = useQuery({ queryKey: qk.medicines, queryFn: getMedicines });
  const batches = useQuery({ queryKey: qk.batches, queryFn: getBatches });
  const txns = useQuery({ queryKey: qk.transactions, queryFn: () => getTransactions(40) });

  const warnDays = settings.data?.expiry_warning_days ?? 90;
  const meds = medicines.data ?? [];
  const allBatches = batches.data ?? [];

  const stockByMedicine = new Map<string, number>();
  for (const b of allBatches) {
    if (daysUntil(b.expiry_date) <= 0) continue;
    stockByMedicine.set(b.medicine_id, (stockByMedicine.get(b.medicine_id) ?? 0) + b.current_quantity);
  }

  const activeMeds = meds.filter((m) => m.is_active);
  const lowStock = activeMeds
    .map((m) => ({ medicine: m, quantity: stockByMedicine.get(m.id) ?? 0 }))
    .filter((row) => row.quantity <= row.medicine.reorder_level)
    .sort((a, b) => a.quantity - b.quantity);

  const totalUnits = allBatches.reduce((sum, b) => sum + b.current_quantity, 0);
  const expiringSoon = allBatches.filter((b) => {
    const d = daysUntil(b.expiry_date);
    return b.current_quantity > 0 && d > 0 && d <= warnDays;
  });
  const expired = allBatches.filter((b) => daysUntil(b.expiry_date) <= 0 && b.current_quantity > 0);

  const todayTxns = (txns.data ?? []).filter((t) => isToday(t.created_at));
  const dispensedToday = todayTxns
    .filter((t) => t.txn_type === "dispensed")
    .reduce((s, t) => s + Math.abs(t.quantity_change), 0);
  const receivedToday = todayTxns
    .filter((t) => t.txn_type === "received")
    .reduce((s, t) => s + t.quantity_change, 0);

  const loading = medicines.isLoading || batches.isLoading;

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={`${settings.data?.pharmacy_name ?? "Clinic Pharmacy"} — stock overview and daily activity`}
        actions={
          <>
            <Button asChild size="sm">
              <Link to="/medicines">
                <Pill className="mr-1.5 size-3.5" /> Add Medicine
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link to="/purchases">
                <ArrowDownRight className="mr-1.5 size-3.5" /> Receive Stock
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link to="/dispensing">
                <ArrowUpRight className="mr-1.5 size-3.5" /> Dispense Medicine
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link to="/suppliers">Add Supplier</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link to="/alerts">
                <TriangleAlert className="mr-1.5 size-3.5" /> View Alerts
              </Link>
            </Button>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        <StatCard
          label="Total Medicines"
          value={activeMeds.length}
          hint={`${meds.length - activeMeds.length} inactive`}
          tone="info"
          icon={<Pill className="size-4" />}
        />
        <StatCard
          label="Items in Stock"
          value={totalUnits.toLocaleString()}
          hint={`${allBatches.length} batches`}
          icon={<Boxes className="size-4" />}
        />
        <StatCard label="Low Stock" value={lowStock.length} tone="warning" hint="At or below reorder level" />
        <StatCard label="Expiring Soon" value={expiringSoon.length} tone="warning" hint={`Within ${warnDays} days`} />
        <StatCard label="Expired" value={expired.length} tone="danger" hint="Batches still on shelf" icon={<CircleAlert className="size-4" />} />
        <StatCard label="Dispensed Today" value={dispensedToday} tone="info" hint="Units" />
        <StatCard label="Received Today" value={receivedToday} tone="success" hint="Units" />
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Panel
          title="Low Stock"
          description="Medicines at or below their reorder level"
          actions={
            <Button asChild variant="ghost" size="sm">
              <Link to="/alerts">View all</Link>
            </Button>
          }
        >
          {loading ? (
            <LoadingRows />
          ) : lowStock.length === 0 ? (
            <EmptyState title="No low-stock medicines." description="Every medicine is above its reorder level." />
          ) : (
            <TableWrap>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Medicine</TableHead>
                    <TableHead className="text-right">Current Stock</TableHead>
                    <TableHead className="text-right">Reorder Level</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lowStock.slice(0, 8).map(({ medicine, quantity }) => (
                    <TableRow key={medicine.id}>
                      <TableCell className="font-medium">
                        <Link
                          to="/medicines/$id"
                          params={{ id: medicine.id }}
                          className="hover:text-primary hover:underline"
                        >
                          {medicineLabel(medicine)}
                        </Link>
                        <span className="block text-xs text-muted-foreground">{medicine.code}</span>
                      </TableCell>
                      <TableCell className="text-right tabular">{quantity}</TableCell>
                      <TableCell className="text-right tabular">{medicine.reorder_level}</TableCell>
                      <TableCell>
                        <StockBadge quantity={quantity} reorderLevel={medicine.reorder_level} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button asChild size="sm" variant="outline">
                          <Link to="/purchases">Reorder</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableWrap>
          )}
        </Panel>

        <Panel
          title="Expiring Soon"
          description={`Batches expiring within ${warnDays} days`}
          actions={
            <Button asChild variant="ghost" size="sm">
              <Link to="/alerts">View all</Link>
            </Button>
          }
        >
          {loading ? (
            <LoadingRows />
          ) : expiringSoon.length === 0 ? (
            <EmptyState title="No medicines are expiring soon." />
          ) : (
            <TableWrap>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Medicine</TableHead>
                    <TableHead>Batch</TableHead>
                    <TableHead className="text-right">Quantity</TableHead>
                    <TableHead>Expiry</TableHead>
                    <TableHead className="text-right">Days Left</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expiringSoon.slice(0, 8).map((b: Batch) => (
                    <TableRow key={b.id}>
                      <TableCell className="font-medium">{medicineLabel(b.medicines)}</TableCell>
                      <TableCell className="font-mono text-xs">{b.batch_number}</TableCell>
                      <TableCell className="text-right tabular">{b.current_quantity}</TableCell>
                      <TableCell>{formatDate(b.expiry_date)}</TableCell>
                      <TableCell className="text-right tabular">{daysUntil(b.expiry_date)}</TableCell>
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
      </div>

      <Panel title="Recent Stock Activity" description="Stock received, dispensed and adjusted">
        {txns.isLoading ? (
          <LoadingRows />
        ) : (txns.data ?? []).length === 0 ? (
          <EmptyState title="No stock activity recorded yet." />
        ) : (
          <TableWrap>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date / Time</TableHead>
                  <TableHead>Medicine</TableHead>
                  <TableHead>Batch</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Change</TableHead>
                  <TableHead className="text-right">New Qty</TableHead>
                  <TableHead>User</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(txns.data ?? []).slice(0, 12).map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {formatDateTime(t.created_at)}
                    </TableCell>
                    <TableCell className="font-medium">{medicineLabel(t.medicines)}</TableCell>
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
                    <TableCell className="text-muted-foreground">{t.user_name ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableWrap>
        )}
      </Panel>

      <Panel title="Quick Actions" bodyClassName="flex flex-wrap gap-2 p-4">
        <Button asChild size="sm">
          <Link to="/medicines">
            <Pill className="mr-1.5 size-3.5" /> Add Medicine
          </Link>
        </Button>
        <Button asChild size="sm" variant="outline">
          <Link to="/purchases">Receive Stock</Link>
        </Button>
        <Button asChild size="sm" variant="outline">
          <Link to="/dispensing">Dispense Medicine</Link>
        </Button>
        <Button asChild size="sm" variant="outline">
          <Link to="/inventory">
            <SlidersHorizontal className="mr-1.5 size-3.5" /> Adjust Stock
          </Link>
        </Button>
        <Button asChild size="sm" variant="outline">
          <Link to="/reports">Reports</Link>
        </Button>
      </Panel>
    </>
  );
}
