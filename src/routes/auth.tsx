import { useEffect, useState } from "react";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { Pill } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError } from "@/components/pharmacy-ui";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Staff Sign In — MediStock Clinic Pharmacy" },
      {
        name: "description",
        content:
          "Secure sign in for clinic pharmacy staff to manage medicines, stock, dispensing and expiry alerts.",
      },
      { property: "og:title", content: "Staff Sign In — MediStock Clinic Pharmacy" },
      {
        property: "og:description",
        content: "Internal pharmacy inventory system for clinic staff.",
      },
    ],
  }),
  component: AuthPage,
});

const schema = z.object({
  email: z.string().trim().email("Enter a valid email address").max(255),
  password: z.string().min(6, "Password must be at least 6 characters").max(72),
  fullName: z.string().trim().max(100).optional(),
});

function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) void router.navigate({ to: "/dashboard" });
    });
  }, [router]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({ email, password, fullName });
    if (!parsed.success) {
      const map: Record<string, string> = {};
      for (const issue of parsed.error.issues) map[String(issue.path[0])] = issue.message;
      setErrors(map);
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({
          email: parsed.data.email,
          password: parsed.data.password,
        });
        if (error) throw error;
        toast.success("Signed in");
      } else {
        const { error } = await supabase.auth.signUp({
          email: parsed.data.email,
          password: parsed.data.password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: parsed.data.fullName || parsed.data.email.split("@")[0] },
          },
        });
        if (error) throw error;
        toast.success("Account created");
      }
      await router.navigate({ to: "/dashboard" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setBusy(false);
    }
  };

  const googleSignIn = async () => {
    setBusy(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      setBusy(false);
      toast.error("Google sign-in failed");
      return;
    }
    if (result.redirected) return;
    await router.navigate({ to: "/dashboard" });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Pill className="size-5" />
          </span>
          <div>
            <h1 className="text-lg font-semibold text-foreground">MediStock</h1>
            <p className="text-xs text-muted-foreground">Clinic Pharmacy Inventory System</p>
          </div>
        </div>

        <div className="rounded-md border border-border bg-card p-5 shadow-xs">
          <h2 className="text-base font-semibold text-foreground">
            {mode === "signin" ? "Staff sign in" : "Create staff account"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Authorized clinic pharmacy staff only.
          </p>

          <form onSubmit={submit} className="mt-4 space-y-3">
            {mode === "signup" ? (
              <div>
                <Label htmlFor="fullName">Full name</Label>
                <Input
                  id="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Ayesha Khan"
                  className="mt-1"
                />
              </div>
            ) : null}
            <div>
              <Label htmlFor="email">Work email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="staff@clinic.example"
                className="mt-1"
              />
              <FieldError message={errors["email"]} />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1"
              />
              <FieldError message={errors["password"]} />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {mode === "signin" ? "Sign in" : "Create account"}
            </Button>
          </form>

          <div className="my-4 flex items-center gap-3">
            <span className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">or</span>
            <span className="h-px flex-1 bg-border" />
          </div>

          <Button variant="outline" className="w-full" onClick={googleSignIn} disabled={busy}>
            Continue with Google
          </Button>

          <p className="mt-4 text-center text-sm text-muted-foreground">
            {mode === "signin" ? "Need a staff account?" : "Already registered?"}{" "}
            <button
              type="button"
              className="font-medium text-primary hover:underline"
              onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            >
              {mode === "signin" ? "Create one" : "Sign in"}
            </button>
          </p>
        </div>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          The first account created becomes the pharmacy admin. New accounts start as Pharmacy
          Assistant until an admin changes their role.
        </p>
      </div>
    </div>
  );
}
