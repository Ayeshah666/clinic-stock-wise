import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
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
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { formatDate, getStaff, logAudit, qk, ROLE_LABELS, type Role } from "@/lib/pharmacy";

export const Route = createFileRoute("/_authenticated/users")({
  head: () => ({
    meta: [
      { title: "Staff & Roles — MediStock Pharmacy" },
      {
        name: "description",
        content:
          "Administrators manage pharmacy staff accounts and assign admin, pharmacist or assistant roles.",
      },
      { property: "og:title", content: "Staff & Roles — MediStock Pharmacy" },
      {
        property: "og:description",
        content: "Manage pharmacy staff accounts and role-based access.",
      },
    ],
  }),
  component: UsersPage,
});

const ROLES: Role[] = ["admin", "pharmacist", "assistant"];

function UsersPage() {
  const { can, user, fullName } = useAuth();
  const queryClient = useQueryClient();
  const staff = useQuery({ queryKey: qk.staff, queryFn: getStaff });
  const isAdmin = can("manageUsers");

  const setRole = useMutation({
    mutationFn: async ({ userId, role, name }: { userId: string; role: Role; name: string }) => {
      const { error: delError } = await supabase.from("user_roles").delete().eq("user_id", userId);
      if (delError) throw new Error(delError.message);
      const { error } = await supabase.from("user_roles").insert({ user_id: userId, role });
      if (error) throw new Error(error.message);
      await logAudit({
        action: "Changed user role",
        module: "Users",
        record_ref: userId,
        description: `${fullName} set ${name}'s role to ${ROLE_LABELS[role]}`,
        user_name: fullName,
        user_id: user?.id ?? null,
      });
    },
    onSuccess: async () => {
      toast.success("Role updated");
      await queryClient.invalidateQueries({ queryKey: qk.staff });
      await queryClient.invalidateQueries({ queryKey: qk.audit });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from("profiles").update({ is_active: active }).eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: async () => {
      toast.success("Account updated");
      await queryClient.invalidateQueries({ queryKey: qk.staff });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <PageHeader
        title="Staff & Roles"
        description="Role-based access control for the pharmacy team"
      />

      <Panel
        title="Team members"
        description="Admins manage medicines, suppliers, users and settings. Pharmacists manage stock and adjustments. Assistants receive and dispense stock."
      >
        {staff.isLoading ? (
          <LoadingRows />
        ) : (staff.data ?? []).length === 0 ? (
          <EmptyState title="No staff accounts yet." />
        ) : (
          <TableWrap>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="text-right">Account</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(staff.data ?? []).map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">
                      {s.full_name || "—"}
                      {s.id === user?.id ? (
                        <span className="ml-2 text-xs text-muted-foreground">(you)</span>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-sm">{s.email}</TableCell>
                    <TableCell>
                      {isAdmin ? (
                        <Select
                          {...(s.role ? { value: s.role } : {})}
                          onValueChange={(v) =>
                            setRole.mutate({
                              userId: s.id,
                              role: v as Role,
                              name: s.full_name || s.email,
                            })
                          }
                        >
                          <SelectTrigger className="w-44">
                            <SelectValue placeholder="No role" />
                          </SelectTrigger>
                          <SelectContent>
                            {ROLES.map((r) => (
                              <SelectItem key={r} value={r}>
                                {ROLE_LABELS[r]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <StatusBadge tone="info">
                          {s.role ? ROLE_LABELS[s.role] : "No role"}
                        </StatusBadge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">{formatDate(s.created_at)}</TableCell>
                    <TableCell className="text-right">
                      {s.is_active ? (
                        <StatusBadge tone="success">Active</StatusBadge>
                      ) : (
                        <StatusBadge tone="danger">Disabled</StatusBadge>
                      )}
                      {isAdmin && s.id !== user?.id ? (
                        <button
                          type="button"
                          className="ml-3 text-xs text-primary underline-offset-2 hover:underline"
                          onClick={() => toggleActive.mutate({ id: s.id, active: !s.is_active })}
                        >
                          {s.is_active ? "Disable" : "Enable"}
                        </button>
                      ) : null}
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
