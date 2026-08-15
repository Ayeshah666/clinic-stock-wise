import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  StatCard,
  TableWrap,
} from "@/components/pharmacy-ui";
import {
  daysUntil,
  formatDate,
  formatDateTime,
  getBatches,
  getMedicines,
  getTransactions,
  medicineLabel,
  qk,
  toCsv,
  TXN_TYPE_LABELS,
  type StockTransaction,
} from "@/lib/pharmacy";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({
    meta: [
      { title: "Reports — MediStock Pharmacy" },
      {
        name: "description",
        content:
          "Stock valuation, dispensing trends, fast-moving medicines and stock movement reports with CSV export.",
      },
      { property: "og:title", content: "Reports — MediStock Pharmacy" },
      {
        property: "og:description",
        content: "Pharmacy stock, movement and consumption reports with CSV export.",
      },
    ],
  }),
  component: ReportsPage,
});

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
function daysAgoISO(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function ReportsPage() {
  const [from, setFrom] = useState(daysAgoISO(30));
  const [to, setTo] = useState(todayISO());

  const medicines = useQuery({ queryKey: qk.medicines, queryFn: getMedicines });
  const batches = useQuery({ queryKey: qk.batches, queryFn: getBatches });
  const transactions = useQuery({
    queryKey: [...qk.transactions, "reports"],
    queryFn: () => getTransactions(1000),
  });

  const inRange = useMemo(() => {
    const start = new Date(`${from}T00:00:00`).getTime();
    const end = new Date(`${to}T23:59:59`).getTime();
    return (transactions.data ?? []).filter((t) => {
      const ts = new Date(t.created_at).getTime();
      return ts >= start && ts <= end;
    });
  }, [transactions.data, from, to]);

  const stockValue = useMemo(() => {
    let total = 0;
    for (const b of batches.data ?? []) total += b.current_quantity * (b.purchase_price ?? 0);
    return total;
  }, [batches.data]);

  const valuationRows = useMemo(() => {
    const map = new Map<string, { name: string; code: string; qty: number; value: number }>();
    for (const b of batches.data ?? []) {
      const key = b.medicine_id;
      const entry =
        map.get(key) ??
        {
          name: medicineLabel(b.medicines),
          code: b.medicines?.code ?? "",
          qty: 0,
          value: 0,
        };
      entry.qty += b.current_quantity;
      entry.value += b.current_quantity * (b.purchase_price ?? 0);
      map.set(key, entry);
    }
    return [...map.values()].sort((a, b) => b.value - a.value);
  }, [batches.data]);

  const consumption = useMemo(() => {
    const map = new Map<string, { name: string; qty: number }>();
    for (const t of inRange) {
      if (t.txn_type !== "dispensed") continue;
      const name = medicineLabel(t.medicines);
      const entry = map.get(name) ?? { name, qty: 0 };
      entry.qty += Math.abs(t.quantity_change);
      map.set(name, entry);
    }
    return [...map.values()].sort((a, b) => b.qty - a.qty);
  }, [inRange]);

  const dispensedTotal = consumption.reduce((s, r) => s + r.qty, 0);
  const receivedTotal = inRange
    .filter((t) => t.txn_type === "received")
    .reduce((s, t) => s + t.quantity_change, 0);
  const wastage = inRange
    .filter((t) => t.txn_type === "damaged" || t.txn_type === "expired")
    .reduce((s, t) => s + Math.abs(t.quantity_change), 0);

  const expiryRows = useMemo(
    () =>
      (batches.data ?? [])
        .filter((b) => b.current_quantity > 0)
        .sort((a, b) => a.expiry_date.localeCompare(b.expiry_date)),
    [batches.data],
  );

  const loading = medicines.isLoading || batches.isLoading || transactions.isLoading;

  return (
    <>
      <PageHeader
        title="Reports"
        description="Stock valuation, consumption and movement reporting"
      />

      <Panel title="Reporting period" description="Applies to consumption and movement reports">
        <div className="grid gap-3 p-4 sm:grid-cols-2 lg:max-w-md">
          <div>
            <Label htmlFor="from">From</Label>
            <Input
              id="from"
              type="date"
              value={from}
              max={to}
              onChange={(e) => setFrom(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="to">To</Label>
            <Input
              id="to"
              type="date"
              value={to}
              min={from}
              max={todayISO()}
              onChange={(e) => setTo(e.target.value)}
              className="mt-1"
            />
          </div>
        </div>
      </Panel>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Stock Value" value={stockValue.toFixed(2)} />
        <StatCard label="Units Dispensed" value={dispensedTotal} tone="primary" />
        <StatCard label="Units Received" value={receivedTotal} tone="success" />
        <StatCard label="Damaged / Expired" value={wastage} tone="danger" />
      </div>

      <Tabs defaultValue="valuation">
        <TabsList>
          <TabsTrigger value="valuation">Stock valuation</TabsTrigger>
          <TabsTrigger value="consumption">Consumption</TabsTrigger>
          <TabsTrigger value="movement">Movement</TabsTrigger>
          <TabsTrigger value="expiry">Expiry</TabsTrigger>
        </TabsList>

        <TabsContent value="valuation">
          <Panel
            title="Stock valuation by medicine"
            description="Current quantity valued at recorded purchase price"
            actions={
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  toCsv(
                    valuationRows.map((r) => ({
                      medicine: r.name,
                      code: r.code,
                      quantity: r.qty,
                      value: r.value.toFixed(2),
                    })),
                    "stock-valuation.csv",
                  )
                }
              >
                <Download className="mr-1.5 size-3.5" /> Export
              </Button>
            }
          >
            {loading ? (
              <LoadingRows />
            ) : valuationRows.length === 0 ? (
              <EmptyState title="No stock recorded yet." />
            ) : (
              <TableWrap>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Medicine</TableHead>
                      <TableHead>Code</TableHead>
                      <TableHead className="text-right">Quantity</TableHead>
                      <TableHead className="text-right">Value</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {valuationRows.map((r) => (
                      <TableRow key={r.code + r.name}>
                        <TableCell className="font-medium">{r.name}</TableCell>
                        <TableCell className="font-mono text-xs">{r.code}</TableCell>
                        <TableCell className="text-right tabular">{r.qty}</TableCell>
                        <TableCell className="text-right tabular">{r.value.toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableWrap>
            )}
          </Panel>
        </TabsContent>

        <TabsContent value="consumption">
          <Panel
            title="Fast-moving medicines"
            description={`Units dispensed between ${formatDate(from)} and ${formatDate(to)}`}
            actions={
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  toCsv(
                    consumption.map((r) => ({ medicine: r.name, units_dispensed: r.qty })),
                    "consumption-report.csv",
                  )
                }
              >
                <Download className="mr-1.5 size-3.5" /> Export
              </Button>
            }
          >
            {loading ? (
              <LoadingRows />
            ) : consumption.length === 0 ? (
              <EmptyState title="Nothing was dispensed in this period." />
            ) : (
              <TableWrap>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Medicine</TableHead>
                      <TableHead className="text-right">Units dispensed</TableHead>
                      <TableHead className="text-right">Share</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {consumption.map((r) => (
                      <TableRow key={r.name}>
                        <TableCell className="font-medium">{r.name}</TableCell>
                        <TableCell className="text-right tabular">{r.qty}</TableCell>
                        <TableCell className="text-right tabular">
                          {dispensedTotal ? Math.round((r.qty / dispensedTotal) * 100) : 0}%
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableWrap>
            )}
          </Panel>
        </TabsContent>

        <TabsContent value="movement">
          <Panel
            title="Stock movement"
            description="All stock transactions in the selected period"
            actions={
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  toCsv(
                    inRange.map((t: StockTransaction) => ({
                      date: t.created_at,
                      medicine: medicineLabel(t.medicines),
                      batch: t.batch_number ?? "",
                      type: TXN_TYPE_LABELS[t.txn_type] ?? t.txn_type,
                      change: t.quantity_change,
                      new_quantity: t.new_quantity,
                      reason: t.reason ?? "",
                      user: t.user_name ?? "",
                    })),
                    "stock-movement.csv",
                  )
                }
              >
                <Download className="mr-1.5 size-3.5" /> Export
              </Button>
            }
          >
            {loading ? (
              <LoadingRows />
            ) : inRange.length === 0 ? (
              <EmptyState title="No stock movement in this period." />
            ) : (
              <TableWrap>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Medicine</TableHead>
                      <TableHead>Batch</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Change</TableHead>
                      <TableHead className="text-right">Balance</TableHead>
                      <TableHead>User</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {inRange.slice(0, 200).map((t) => (
                      <TableRow key={t.id}>
                        <TableCell className="whitespace-nowrap text-xs">
                          {formatDateTime(t.created_at)}
                        </TableCell>
                        <TableCell className="font-medium">{medicineLabel(t.medicines)}</TableCell>
                        <TableCell className="font-mono text-xs">
                          {t.batch_number ?? "—"}
                        </TableCell>
                        <TableCell>{TXN_TYPE_LABELS[t.txn_type] ?? t.txn_type}</TableCell>
                        <TableCell className="text-right tabular">
                          {t.quantity_change > 0 ? `+${t.quantity_change}` : t.quantity_change}
                        </TableCell>
                        <TableCell className="text-right tabular">{t.new_quantity}</TableCell>
                        <TableCell className="text-xs">{t.user_name ?? "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableWrap>
            )}
          </Panel>
        </TabsContent>

        <TabsContent value="expiry">
          <Panel
            title="Expiry report"
            description="All batches with remaining stock, earliest expiry first"
            actions={
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  toCsv(
                    expiryRows.map((b) => ({
                      medicine: medicineLabel(b.medicines),
                      batch: b.batch_number,
                      quantity: b.current_quantity,
                      expiry: b.expiry_date,
                      days_left: daysUntil(b.expiry_date),
                    })),
                    "expiry-report.csv",
                  )
                }
              >
                <Download className="mr-1.5 size-3.5" /> Export
              </Button>
            }
          >
            {loading ? (
              <LoadingRows />
            ) : expiryRows.length === 0 ? (
              <EmptyState title="No batches with stock." />
            ) : (
              <TableWrap>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Medicine</TableHead>
                      <TableHead>Batch</TableHead>
                      <TableHead className="text-right">Quantity</TableHead>
                      <TableHead>Expiry</TableHead>
                      <TableHead className="text-right">Days left</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {expiryRows.map((b) => (
                      <TableRow key={b.id}>
                        <TableCell className="font-medium">{medicineLabel(b.medicines)}</TableCell>
                        <TableCell className="font-mono text-xs">{b.batch_number}</TableCell>
                        <TableCell className="text-right tabular">{b.current_quantity}</TableCell>
                        <TableCell>{formatDate(b.expiry_date)}</TableCell>
                        <TableCell className="text-right tabular">
                          {daysUntil(b.expiry_date)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableWrap>
            )}
          </Panel>
        </TabsContent>
      </Tabs>
    </>
  );
}
