import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import http, { formatErr } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useParams } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

export default function InviteAccept() {
  const { token } = useParams();
  const nav = useNavigate();
  const { refresh } = useAuth();
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (pw.length < 6) return toast.error("Password must be ≥ 6 chars");
    if (pw !== pw2) return toast.error("Passwords do not match");
    setBusy(true);
    try {
      const { data } = await http.post("/employees/invite-accept", { token, password: pw });
      localStorage.setItem("nmp_token", data.token);
      await refresh();
      toast.success("Account activated");
      nav("/");
    } catch (e) { toast.error(formatErr(e.response?.data?.detail)); }
    finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-100 p-6">
      <div className="bg-white border border-zinc-200 p-8 max-w-md w-full">
        <div className="overline text-zinc-500 mb-1">Activation</div>
        <h2 className="text-2xl font-extrabold tracking-tight mb-6">Set Your Password</h2>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <Label className="text-xs uppercase tracking-wider text-zinc-600">New Password</Label>
            <Input type="password" value={pw} onChange={(e)=>setPw(e.target.value)} className="rounded-sm mt-1" data-testid="invite-pw-input" />
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wider text-zinc-600">Confirm Password</Label>
            <Input type="password" value={pw2} onChange={(e)=>setPw2(e.target.value)} className="rounded-sm mt-1" data-testid="invite-pw2-input" />
          </div>
          <Button type="submit" disabled={busy} className="bg-rose-600 hover:bg-rose-700 rounded-sm w-full h-11" data-testid="invite-submit-btn">
            {busy ? "Activating…" : "Activate Account"}
          </Button>
        </form>
      </div>
    </div>
  );
}
