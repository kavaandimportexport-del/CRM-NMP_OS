import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import http, { formatErr } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Headphones, MicrophoneStage } from "@phosphor-icons/react";
import { toast } from "sonner";

export default function Login() {
  const { login, setupAdmin, user } = useAuth();
  const nav = useNavigate();
  const [mode, setMode] = useState("login"); // login | setup
  const [email, setEmail] = useState("admin@nmp.com");
  const [password, setPassword] = useState("admin123");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user) nav("/");
    (async () => {
      try {
        const { data } = await http.get("/auth/setup-status");
        if (!data.setup_complete) setMode("setup");
      } catch (_) {}
    })();
  }, [user, nav]);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "setup") {
        await setupAdmin(name, email, password);
        toast.success("Super Admin created");
      } else {
        await login(email, password);
        toast.success("Welcome back");
      }
      nav("/");
    } catch (err) {
      toast.error(formatErr(err.response?.data?.detail) || err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Left visual */}
      <div className="relative hidden lg:block bg-zinc-950 overflow-hidden">
        <img
          src="https://images.unsplash.com/photo-1535406208535-1429839cfd13?crop=entropy&cs=srgb&fm=jpg&q=85"
          alt="Mixing console"
          className="absolute inset-0 w-full h-full object-cover opacity-50"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/50 to-transparent" />
        <div className="relative z-10 flex flex-col h-full p-12 text-white">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-rose-600 flex items-center justify-center rounded-sm">
              <Headphones size={22} weight="fill" />
            </div>
            <div>
              <div className="font-mono-data text-[10px] tracking-[0.25em] text-rose-400">NEW MUSIC PALACE</div>
              <div className="font-extrabold text-xl tracking-tight">SALES OS</div>
            </div>
          </div>
          <div className="mt-auto">
            <div className="overline text-rose-400 mb-3">The Operating System For Music Commerce</div>
            <h1 className="text-4xl xl:text-5xl font-extrabold tracking-tight leading-[1.05] mb-4">
              One Lead.<br />One Journey.<br />One Source of Truth.
            </h1>
            <p className="text-zinc-400 max-w-md text-sm leading-relaxed">
              Built for music instruments, pro audio, studios, churches, schools, auditoriums &amp; corporate AV — every visit GPS verified, every quotation tracked.
            </p>
            <div className="mt-8 grid grid-cols-3 gap-4 max-w-md">
              {[
                { k: "GPS", l: "Site verified" },
                { k: "PDF", l: "Quotations" },
                { k: "360°", l: "Customer view" },
              ].map((s) => (
                <div key={s.k} className="border border-zinc-800 p-3 bg-zinc-900/40 backdrop-blur-sm">
                  <div className="font-mono-data text-rose-400 text-lg">{s.k}</div>
                  <div className="text-[10px] text-zinc-500 uppercase tracking-wider">{s.l}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Right form */}
      <div className="flex items-center justify-center p-8 bg-white">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="h-9 w-9 bg-rose-600 flex items-center justify-center rounded-sm">
              <MicrophoneStage size={20} weight="fill" className="text-white" />
            </div>
            <div className="font-bold tracking-tight">NMP SALES OS</div>
          </div>
          <div className="overline text-zinc-500 mb-2">{mode === "setup" ? "Initial Setup" : "Authenticate"}</div>
          <h2 className="text-3xl font-extrabold tracking-tight text-zinc-900 mb-1">
            {mode === "setup" ? "Create Super Admin" : "Sign in to NMP"}
          </h2>
          <p className="text-zinc-500 text-sm mb-8">
            {mode === "setup"
              ? "First-time setup — this account will own the workspace."
              : "Use your assigned credentials to continue."}
          </p>

          <form onSubmit={submit} className="space-y-4" data-testid="login-form">
            {mode === "setup" && (
              <div>
                <Label className="text-xs uppercase tracking-wider text-zinc-600">Full Name</Label>
                <Input
                  data-testid="setup-name-input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="rounded-sm border-zinc-300 mt-1"
                />
              </div>
            )}
            <div>
              <Label className="text-xs uppercase tracking-wider text-zinc-600">Email</Label>
              <Input
                data-testid="login-email-input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="rounded-sm border-zinc-300 mt-1"
              />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider text-zinc-600">Password</Label>
              <Input
                data-testid="login-password-input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="rounded-sm border-zinc-300 mt-1"
              />
            </div>
            <Button
              type="submit"
              disabled={busy}
              data-testid="login-submit-button"
              className="w-full bg-rose-600 hover:bg-rose-700 rounded-sm h-11 font-semibold"
            >
              {busy ? "Working…" : mode === "setup" ? "Create Account & Continue" : "Sign In"}
            </Button>
          </form>

          {mode === "login" && (
            <div className="mt-6 pt-6 border-t border-zinc-200">
              <div className="overline text-zinc-500 mb-2">Default credentials</div>
              <code className="text-xs text-zinc-700 font-mono-data">admin@nmp.com / admin123</code>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
