import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Shield } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/")({
  component: LoginPage,
});

function LoginPage() {
  const { session, loginWithIndicativo } = useAuth();
  const navigate = useNavigate();
  const [indicativo, setIndicativo] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [needsEmail, setNeedsEmail] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (session) navigate({ to: "/main" }); }, [session, navigate]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await loginWithIndicativo(indicativo, password, needsEmail ? email : undefined);
    setBusy(false);
    if (!res.ok) {
      if (res.needsEmail) setNeedsEmail(true);
      toast.error(res.error || "Error");
      return;
    }
    toast.success(`Bienvenido ${indicativo.toUpperCase()}`);
    navigate({ to: "/main" });
  }

  return (
    <div className="min-h-screen tactical-bg flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/15 border-2 border-primary mb-4">
            <Shield className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold tracking-wide uppercase">Pizarra SITAC</h1>
          <p className="text-sm text-muted-foreground tracking-widest uppercase mt-1">Protección Civil · Rivas-Vaciamadrid</p>
        </div>

        <form onSubmit={onSubmit} className="bg-card border rounded-lg p-6 space-y-5 shadow-xl">
          <div className="space-y-2">
            <Label htmlFor="ind" className="uppercase text-xs tracking-widest text-muted-foreground">Indicativo</Label>
            <Input id="ind" autoFocus autoComplete="off" value={indicativo} onChange={e => { setIndicativo(e.target.value); setNeedsEmail(false); }} placeholder="Ej: D02" className="font-mono uppercase" />
          </div>
          {needsEmail && (
            <div className="space-y-2">
              <Label htmlFor="em" className="uppercase text-xs tracking-widest text-muted-foreground">Correo (solo primera vez)</Label>
              <Input id="em" type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="tu@correo.com" className="font-mono" />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="pw" className="uppercase text-xs tracking-widest text-muted-foreground">Contraseña</Label>
            <Input id="pw" type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••" className="font-mono" />
          </div>
          <Button type="submit" disabled={busy} className="w-full uppercase tracking-widest">{busy ? "..." : (needsEmail ? "Crear cuenta y acceder" : "Acceder")}</Button>
          {needsEmail && <p className="text-[11px] text-muted-foreground text-center">Es la primera vez que usas este indicativo. Te crearemos una cuenta con esta contraseña.</p>}
        </form>

        <p className="text-center text-xs text-muted-foreground mt-6 tracking-wider uppercase">v2.0 · Sistema Operativo</p>
      </div>
    </div>
  );
}
