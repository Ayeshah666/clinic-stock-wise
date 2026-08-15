import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Download, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  LoadingRows,
  PageHeader,
  Panel,
  StatusBadge,
  TableWrap,
} from "@/components/pharmacy-ui";
import { formatDateTime, getAuditLogs, qk, toCsv } from "@/lib/pharmacy";

export const Route = createFileRoute("/_authenticated/audit-log")({
  head: () => ({
    meta: [
      { title: "Audit Log — MediStock Pharmacy" },
      {
        name: "description",
        content:
          "Full audit trail of pharmacy actions: who added medicines, received stock, dispensed and adjusted inventory.",
      },
      { property: "og:title", content: "Audit Log — MediStock Pharmacy" },
      {
        property: "og:description",
        content: "Traceable record of every staff action in the pharmacy system.",
      },
    ],
  }),
  component: AuditLogPage,
});

interface AuditRow {
  id: string;
  user_name: string | null;
  action: string;
  module: string;
  record_ref: string | null;
  description: string | null;
  created_at: string;
}

function AuditLogPage() {
  const logs = useQuery({ queryKey: qk.audit, queryFn: getAuditLogs });
  const [search, setSearch] = useState("");
  const [moduleFilter, setModuleFilter] = useState("all");

  const data = (logs.data ?? []) as AuditRow[];
  const modules = useMemo(
    () => [...new Set(data.map((l) => l.module))].sort(),
    [data],
  );

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return data.filter((l) => {
      if (moduleFilter !== "all" && l.module !== moduleFilter) return false;
      if (!term) return true;
      return `${l.user_name ?? ""} ${l.action} ${l.module} ${l.record_ref ?? ""} ${l.description ?? ""}`
        .toLowerCase()
        .includes(term);
    });
  }, [data, search, moduleFilter]);

  return (
    <>
      <PageHeader
        title="Audit Log"
        description="Traceable history of staff actions across the pharmacy"
        actions={
          <Button
            size="sm"
            variant="outline"
            disabled={rows.length === 0}
            onClick={() =>
              toCsv(
                rows.map((l) => ({
                  timestamp: l.created_at,
                  user: l.user_name ?? "",
                  action: l.action,
                  module: l.module,
                  reference: l.record_ref ?? "",
                  description: l.description ?? "",
                })),
                "audit-log.csv",
              )
            }
          >
            <Download className="mr-1.5 size-3.5" /> Export CSV
          </Button>
        }
      />

      <Panel title="Activity" description={`${rows.length} entries`}>
        <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search actions, users or references"
              className="pl-8"
              aria-label="Search audit log"
            />
          </div>
          <Select value={moduleFilter} onValueChange={setModuleFilter}>
            <SelectTrigger className="sm:w-52">
              <SelectValue placeholder="All modules" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All modules</SelectItem>
              {modules.map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {logs.isLoading ? (
          <LoadingRows />
        ) : rows.length === 0 ? (
          <EmptyState title="No audit entries found." />
        ) : (
          <TableWrap>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Module</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="whitespace-nowrap text-xs">
                      {formatDateTime(l.created_at)}
                    </TableCell>
                    <TableCell className="text-sm font-medium">{l.user_name ?? "System"}</TableCell>
                    <TableCell className="text-sm">{l.action}</TableCell>
                    <TableCell>
                      <StatusBadge tone="info">{l.module}</StatusBadge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{l.record_ref ?? "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {l.description ?? "—"}
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
