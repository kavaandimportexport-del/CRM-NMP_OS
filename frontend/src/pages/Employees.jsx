import { useEffect, useState } from "react";
import http, { formatErr } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { Plus, Copy, DotsThreeVertical, PaperPlaneTilt, Prohibit, Trash, Key, SignOut, Clock } from "@phosphor-icons/react";
import { useAuth } from "@/context/AuthContext";

const ROLES = [
  { v: "super_admin", l: "Super Admin" },
  { v: "admin", l: "Admin" },
  { v: "sales_manager", l: "Sales Manager" },
  { v: "field_sales", l: "Field Sales Executive" },
  { v: "store_sales", l: "Store Sales Executive" },
];

const emptyEmp = { name: "", email: "", mobile: "", department: "", designation: "", territory: "", role: "field_sales" };

const statusStyle = (s) => ({
  Active: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Pending: "bg-amber-50 text-amber-700 border-amber-200",
  Suspended: "bg-orange-50 text-orange-700 border-orange-200",
  Terminated: "bg-zinc-200 text-zinc-700 border-zinc-300",
  Inactive: "bg-zinc-100 text-zinc-500 border-zinc-200",
}[s] || "bg-zinc-100 text-zinc-700 border-zinc-200");

export default function Employees() {
  const { user } = useAuth();
  const [emps, setEmps] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyEmp);
  const [inviteData, setInviteData] = useState(null);
  const [historyEmp, setHistoryEmp] = useState(null);
  const [history, setHistory] = useState([]);

  const load = () => http.get("/employees").then(({ data }) => setEmps(data));
  useEffect(() => { load(); }, []);

  const isAdmin = ["super_admin", "admin"].includes(user?.role);

  const save = async () => {
    try {
      const { data } = await http.post("/employees", form);
      setInviteData(data);
      setForm(emptyEmp);
      load();
    } catch (e) { toast.error(formatErr(e.response?.data?.detail)); }
  };

  const copyInvite = (token) => {
    const link = `${window.location.origin}/invite/${token}`;
    navigator.clipboard.writeText(link);
    toast.success("Invite link copied");
  };

  const action = async (emp, op) => {
    const confirmMsgs = {
      suspend: `Suspend ${emp.name}? They will be force-logged-out.`,
      terminate: `Terminate ${emp.name}? They will be permanently blocked.`,
      "reset-password": `Reset password for ${emp.name}?`,
      "force-logout": `Force logout ${emp.name} from all sessions?`,
      "revoke-invite": `Revoke invite for ${emp.name}?`,
    };
    if (confirmMsgs[op] && !window.confirm(confirmMsgs[op])) return;
    try {
      const { data } = await http.post(`/employees/${emp.id}/${op}`);
      if (op === "resend-invite" || op === "reset-password") {
        if (data.invite_token) {
          copyInvite(data.invite_token);
          toast.success(`New invite link copied to clipboard`);
        } else if (data.temp_password) {
          navigator.clipboard.writeText(data.temp_password);
          toast.success(`Temp password copied: ${data.temp_password}`);
        }
      } else {
        toast.success(`${op.replace("-", " ")} done`);
      }
      load();
    } catch (e) { toast.error(formatErr(e.response?.data?.detail)); }
  };

  const showHistory = async (emp) => {
    try {
      const { data } = await http.get(`/employees/${emp.id}/login-history`);
      setHistory(data); setHistoryEmp(emp);
    } catch (e) { toast.error("Could not load history"); }
  };

  return (
    <div className="p-6 lg:p-8">
      <div className="flex justify-between items-end mb-6">
        <div>
          <div className="overline text-zinc-500 mb-1">Team Management</div>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">Employees</h1>
          <p className="text-zinc-500 text-sm mt-1">{emps.length} team members</p>
        </div>
        {isAdmin && (
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setInviteData(null); }}>
            <DialogTrigger asChild>
              <Button data-testid="new-employee-btn" className="bg-rose-600 hover:bg-rose-700 rounded-sm"><Plus size={16} className="mr-1" />Invite Employee</Button>
            </DialogTrigger>
            <DialogContent className="rounded-sm">
              <DialogHeader><DialogTitle>{inviteData ? "Share invite link" : "Invite Employee"}</DialogTitle></DialogHeader>
              {inviteData ? (
                <div className="space-y-3">
                  <p className="text-sm text-zinc-600">Share with <b>{inviteData.employee.email}</b>:</p>
                  <div className="bg-zinc-50 border border-zinc-200 p-3 text-xs font-mono-data break-all">
                    {window.location.origin}/invite/{inviteData.invite_token}
                  </div>
                  <Button onClick={() => copyInvite(inviteData.invite_token)} className="bg-rose-600 hover:bg-rose-700 rounded-sm w-full"><Copy size={14} className="mr-2" />Copy Link</Button>
                  <div className="text-xs text-zinc-500">Temp password: <code className="font-mono-data text-zinc-700">{inviteData.temp_password}</code></div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Name *"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="rounded-sm" data-testid="emp-name-input" /></Field>
                  <Field label="Email *"><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="rounded-sm" data-testid="emp-email-input" /></Field>
                  <Field label="Mobile"><Input value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} className="rounded-sm" /></Field>
                  <Field label="Department"><Input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} className="rounded-sm" /></Field>
                  <Field label="Designation"><Input value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} className="rounded-sm" /></Field>
                  <Field label="Territory"><Input value={form.territory} onChange={(e) => setForm({ ...form, territory: e.target.value })} className="rounded-sm" /></Field>
                  <div className="col-span-2">
                    <Field label="Role">
                      <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                        <SelectTrigger className="rounded-sm" data-testid="emp-role-select"><SelectValue /></SelectTrigger>
                        <SelectContent>{ROLES.map((r) => <SelectItem key={r.v} value={r.v}>{r.l}</SelectItem>)}</SelectContent>
                      </Select>
                    </Field>
                  </div>
                  <Button onClick={save} className="bg-rose-600 hover:bg-rose-700 rounded-sm col-span-2" data-testid="save-emp-btn">Create &amp; Generate Invite</Button>
                </div>
              )}
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Dialog open={!!historyEmp} onOpenChange={(v) => !v && setHistoryEmp(null)}>
        <DialogContent className="rounded-sm max-w-2xl max-h-[80vh] overflow-y-auto" data-testid="login-history-modal">
          <DialogHeader><DialogTitle>Login History — {historyEmp?.name}</DialogTitle></DialogHeader>
          <div className="divide-y divide-zinc-100">
            {history.length === 0 && <div className="text-sm text-zinc-400 py-6 text-center">No login history.</div>}
            {history.map((h) => (
              <div key={h.id} className="py-2 flex items-center justify-between text-sm">
                <div>
                  <div className="text-zinc-900 flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${h.success ? "bg-emerald-500" : "bg-rose-500"}`} />
                    {h.success ? "Success" : "Failed"}
                  </div>
                  <div className="text-xs text-zinc-500 mt-0.5">{new Date(h.at).toLocaleString()}</div>
                </div>
                <div className="text-xs text-zinc-500 text-right">
                  <div className="font-mono-data">{h.ip || "—"}</div>
                  <div className="truncate max-w-[260px]">{(h.user_agent || "").slice(0, 60)}</div>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <div className="bg-white border border-zinc-200 overflow-x-auto" data-testid="employees-table">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50">
            <tr className="text-left border-b border-zinc-200">
              <th className="px-4 py-3 overline">Name</th>
              <th className="px-4 py-3 overline">Email</th>
              <th className="px-4 py-3 overline">Role</th>
              <th className="px-4 py-3 overline">Department</th>
              <th className="px-4 py-3 overline">Territory</th>
              <th className="px-4 py-3 overline">Status</th>
              {isAdmin && <th className="px-4 py-3 overline w-12"></th>}
            </tr>
          </thead>
          <tbody>
            {emps.map((e) => (
              <tr key={e.id} className="border-b border-zinc-100 hover:bg-zinc-50">
                <td className="px-4 py-3">
                  <div className="font-medium text-zinc-900">{e.name}</div>
                  <div className="text-xs text-zinc-500">{e.designation || "—"}</div>
                </td>
                <td className="px-4 py-3 text-zinc-700">{e.email}</td>
                <td className="px-4 py-3"><span className="text-xs px-2 py-1 bg-zinc-100 rounded-sm border border-zinc-200 capitalize">{e.role.replace("_", " ")}</span></td>
                <td className="px-4 py-3 text-zinc-600">{e.department || "—"}</td>
                <td className="px-4 py-3 text-zinc-600">{e.territory || "—"}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-1 rounded-sm border ${statusStyle(e.status)}`}>{e.status}</span>
                </td>
                {isAdmin && (
                  <td className="px-4 py-3">
                    {e.role !== "super_admin" || user?.id === e.id ? null : null}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button data-testid={`emp-actions-${e.id}`} className="h-8 w-8 inline-flex items-center justify-center hover:bg-zinc-100 rounded-sm">
                          <DotsThreeVertical size={18} />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="rounded-sm">
                        {e.status === "Pending" && (
                          <>
                            <DropdownMenuItem onClick={() => action(e, "resend-invite")} data-testid={`act-resend-${e.id}`}>
                              <PaperPlaneTilt size={14} className="mr-2" />Resend Invite
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => action(e, "revoke-invite")} className="text-rose-600">
                              <Prohibit size={14} className="mr-2" />Revoke Invite
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                          </>
                        )}
                        <DropdownMenuItem onClick={() => action(e, "reset-password")} data-testid={`act-reset-${e.id}`}>
                          <Key size={14} className="mr-2" />Reset Password
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => action(e, "force-logout")}>
                          <SignOut size={14} className="mr-2" />Force Logout
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => showHistory(e)} data-testid={`act-history-${e.id}`}>
                          <Clock size={14} className="mr-2" />Login History
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {e.status === "Active" && (
                          <DropdownMenuItem onClick={() => action(e, "suspend")} className="text-orange-600" data-testid={`act-suspend-${e.id}`}>
                            <Prohibit size={14} className="mr-2" />Suspend
                          </DropdownMenuItem>
                        )}
                        {(e.status === "Suspended" || e.status === "Inactive") && (
                          <DropdownMenuItem onClick={() => action(e, "activate")} className="text-emerald-600">
                            <PaperPlaneTilt size={14} className="mr-2" />Activate
                          </DropdownMenuItem>
                        )}
                        {e.role !== "super_admin" && (
                          <DropdownMenuItem onClick={() => action(e, "terminate")} className="text-rose-600" data-testid={`act-terminate-${e.id}`}>
                            <Trash size={14} className="mr-2" />Terminate
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const Field = ({ label, children }) => (
  <div>
    <Label className="text-[11px] uppercase tracking-wider text-zinc-600 mb-1 block">{label}</Label>
    {children}
  </div>
);
