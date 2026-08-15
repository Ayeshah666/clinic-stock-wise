import { useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
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
  StockBadge,
  TableWrap,
} from "@/components/pharmacy-ui";
import {
  daysUntil,
  formatDate,
  getBatches,
  getMedicines,
  getSettings,
  medicineLabel,
  qk,
  toCsv,
} from "@/lib/pharmacy";

export const Route = createFileRoute("/_authenticated/alerts")({
  head: () => ({
    meta: [
      { title: "Stock & Expiry Alerts — MediStock Pharmacy" },
      {
        name: "description",
        content:
          "Low stock, out of stock, expiring and expired medicine alerts for the clinic pharmacy in one place.",
      },
      { property: "og:title", content: "Stock & Expiry Alerts — MediStock Pharmacy" },
      {
        property: "og:description",
        content: "Every low-stock and expiry alert the pharmacy needs to act on.",
      },
    ],
  }),
  component: AlertsPage,
});

function AlertsPage() {
  const settings = useQuery({ queryKey: qk.settings, queryFn: getSettings });
  const medicines = useQuery({ queryKey: qk.medicines, queryFn: getMedicines });
  const batches = useQuery({ queryKey: qk.batches, queryFn: getBatches });

  const warnDays = settings.data?.expiry_warning_days ?? 90;
  const allBatches = batches.data ?? [];

  const stockRows = useMemo(() => {
    const map = new Map<string, number>();
    for (const b of allBatches) {
      if (daysUntil(b.expiry_date) <= 0) continue;
      map.set(b.medicine_id, (map.get(b.medicine_id) ?? 0) + b.current_quantity);
    }
    return (medicines.data ?? [])
      .filter((m) => m.is_active)
      .map((m) => ({ medicine: m, quantity: map.get(m.id) ?? 0 }))
      .filter((r) => r.quantity <= r.medicine.reorder_level)
      .sort((a, b) => a.quantity - b.quantity);
  }, [medicines.data, allBatches]);

  const outOfStock = stockRows.filter((r) => r.quantity <= 0);
  const expiring = allBatches
    .filter((b) => {
      const d = daysUntil(b.expiry_date);
      return b.current_quantity > 0 && d > 0 && d <= warnDays;
    })
    .sort((a, b) => a.expiry_date.localeCompare(b.expiry_date));
  const expired = allBatches
    .filter((b) => daysUntil(b.expiry_date) <= 0 && b.current_quantity > 0)
    .sort((a, b) => b.expiry_date.localeCompare(a.expiry_date));

  const exportAlerts = () => {
    toCsv(
      [
        ...stockRows.map((r) => ({
          alert: r.quantity <= 0 ? "Out of stock" : "Low stock",
          medicine: medicineLabel(r.medicine),
          code: r.medicine.code,
          quantity: r.quantity,
          reorder_level: r.medicine.reorder_level,
          batch: "",
          expiry: "",
        })),
        ...expiring.map((b) => ({
          alert: "Expiring soon",
          medicine: medicineLabel(b.medicines),
          code: b.medicines?.code ?? "",
          quantity: b.current_quantity,
          reorder_level: b.medicines?.reorder_level ?? "",
          batch: b.batch_number,
          expiry: b.expiry_date,
        })),
        ...expired.map((b) => ({
          alert: "Expired",
          medicine: medicineLabel(b.medicines),
          code: b.medicines?.code ?? "",
          quantity: b.current_quantity,
          reorder_level: b.medicines?.reorder_level ?? "",
          batch: b.batch_number,
          expiry: b.expiry_date,
        })),
      ],
      "pharmacy-alerts.csv",
    );
  };

  const loading = medicines.isLoading || batches.isLoading;
  const totalAlerts = stockRows.length + expiring.length + expired.length;

  return (
    <>
      <PageHeader
        title="Alerts"
        description={`Low stock and expiry warnings — expiry window is ${warnDays} days`}
        actions={
          <Button size="sm" variant="outline" onClick={exportAlerts} disabled={totalAlerts === 0}>
            <Download className="mr-1.5 size-3.5" /> Export CSV
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Alerts" value={totalAlerts} tone="warning" />
        <StatCard label="Low Stock" value={stockRows.length - outOfStock.length} tone="warning" />
        <StatCard label="Out of Stock" value={outOfStock.length} tone="danger" />
        <StatCard label="Expired Batches" value={expired.length} tone="danger" />
      </div>

      <Panel title="Low & out of stock" description="Medicines at or below their reorder level">
        {loading ? (
          <LoadingRows />
        ) : stockRows.length === 0 ? (
          <EmptyState title="All medicines are above their reorder level." />
        ) : (
          <TableWrap>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Medicine</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead className="text-right">Usable Stock</TableHead>
                  <TableHead className="text-right">Reorder Level</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stockRows.map(({ medicine, quantity }) => (
                  <TableRow key={medicine.id}>
                    <TableCell className="font-medium">
                      <Link
                        to="/medicines/$id"
                        params={{ id: medicine.id }}
                        className="hover:text-primary hover:underline"
                      >
                        {medicineLabel(medicine)}
                      </Link>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{medicine.code}</TableCell>
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

      <Panel title="Expiring soon" description={`Batches with stock expiring within ${warnDays} days`}>
        {loading ? (
          <LoadingRows />
        ) : expiring.length === 0 ? (
          <EmptyState title="No batches are approaching expiry." />
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
                {expiring.map((b) => (
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

      <Panel
        title="Expired stock"
        description="Remove these from the shelf and write them off from Inventory"
      >
        {loading ? (
          <LoadingRows />
        ) : expired.length === 0 ? (
          <EmptyState title="No expired stock on the shelf." />
        ) : (
          <TableWrap>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Medicine</TableHead>
                  <TableHead>Batch</TableHead>
                  <TableHead className="text-right">Quantity</TableHead>
                  <TableHead>Expired on</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expired.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell className="font-medium">{medicineLabel(b.medicines)}</TableCell>
                    <TableCell className="font-mono text-xs">{b.batch_number}</TableCell>
                    <TableCell className="text-right tabular">{b.current_quantity}</TableCell>
                    <TableCell>{formatDate(b.expiry_date)}</TableCell>
                    <TableCell className="text-right">
                      <Button asChild size="sm" variant="outline">
                        <Link to="/inventory">Write off</Link>
                      </Button>
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
