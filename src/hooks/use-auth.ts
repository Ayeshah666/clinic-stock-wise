import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Role } from "@/lib/pharmacy";

export interface AuthState {
  user: User | null;
  session: Session | null;
  role: Role | null;
  fullName: string;
  loading: boolean;
}

const PERMISSIONS = {
  manageUsers: ["admin"],
  manageMedicines: ["admin", "pharmacist"],
  manageSuppliers: ["admin", "pharmacist"],
  manageCategories: ["admin"],
  receiveStock: ["admin", "pharmacist", "assistant"],
  dispense: ["admin", "pharmacist", "assistant"],
  adjustStock: ["admin", "pharmacist"],
  viewAudit: ["admin", "pharmacist"],
  viewReports: ["admin", "pharmacist", "assistant"],
  manageSettings: ["admin"],
} as const;

export type Permission = keyof typeof PERMISSIONS;

export function can(role: Role | null, permission: Permission): boolean {
  if (!role) return false;
  return (PERMISSIONS[permission] as readonly string[]).includes(role);
}

export function useAuth(): AuthState & { can: (p: Permission) => boolean } {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    role: null,
    fullName: "",
    loading: true,
  });

  useEffect(() => {
    let active = true;

    const loadProfile = async (session: Session | null) => {
      if (!session?.user) {
        if (active) setState({ user: null, session: null, role: null, fullName: "", loading: false });
        return;
      }
      const [{ data: roleRow }, { data: profile }] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", session.user.id).maybeSingle(),
        supabase.from("profiles").select("full_name").eq("id", session.user.id).maybeSingle(),
      ]);
      if (!active) return;
      setState({
        user: session.user,
        session,
        role: (roleRow?.role as Role | undefined) ?? null,
        fullName: profile?.full_name || session.user.email?.split("@")[0] || "Staff",
        loading: false,
      });
    };

    supabase.auth.getSession().then(({ data }) => void loadProfile(data.session));

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        void loadProfile(session);
      }
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { ...state, can: (p: Permission) => can(state.role, p) };
}
