import { useEffect, useState } from "react";
import http, { formatErr } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Copy } from "@phosphor-icons/react";
import { useAuth } from "@/context/AuthContext";

const ROLES = [
  { v: "super_admin", l: "Super Admin" },
  { v: "admin", l: "Admin" },
  { v: "sales_manager", l: "Sales Manager" },
  { v: "field_sales", l: "Field Sales Executive" },
  { v: "store_sales", l: "Store Sales Executive" },
];

const emptyEmp = { name: "", email: "", mobile: "", department: "", designation: "", territory: "", role: "field_sales" };

export default function Employees() {
  const { user } = useAuth();
  const [emps, setEmps] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyEmp);
  const [inviteData, setInviteData] = useState(null);

  const load = () => http.get("/employees").then(({data})=>setEmps(data));
  useEffect(()=>{ load(); },[]);

  const isAdmin = ["super_admin", "admin"].includes(user?.role);

  const save = async () => {
    try {
      const { data } = await http.post("/employees", form);
      setInviteData(data);
      setForm(emptyEmp);
      load();
    } catch (e) { toast.error(formatErr(e.response?.data?.detail)); }
  };

  const copyInvite = () => {
    const link = `${window.location.origin}/invite/${inviteData.invite_token}`;
    navigator.clipboard.writeText(link);
    toast.success("Invite link copied");
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
          <Dialog open={open} onOpenChange={(v)=>{setOpen(v); if(!v) setInviteData(null);}}>
            <DialogTrigger asChild>
              <Button data-testid="new-employee-btn" className="bg-rose-600 hover:bg-rose-700 rounded-sm"><Plus size={16} className="mr-1" />Invite Employee</Button>
            </DialogTrigger>
            <DialogContent className="rounded-sm">
              <DialogHeader><DialogTitle>{inviteData ? "Share invite link" : "Invite Employee"}</DialogTitle></DialogHeader>
              {inviteData ? (
                <div className="space-y-3">
                  <p className="text-sm text-zinc-600">Share this link with <b>{inviteData.employee.email}</b> to activate their account:</p>
                  <div className="bg-zinc-50 border border-zinc-200 p-3 text-xs font-mono-data break-all">
                    {window.location.origin}/invite/{inviteData.invite_token}
                  </div>
                  <Button onClick={copyInvite} className="bg-rose-600 hover:bg-rose-700 rounded-sm w-full"><Copy size={14} className="mr-2" />Copy Link</Button>
                  <div className="text-xs text-zinc-500">Temp password: <code className="font-mono-data text-zinc-700">{inviteData.temp_password}</code></div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Name *"><Input value={form.name} onChange={(e)=>setForm({...form,name:e.target.value})} className="rounded-sm" data-testid="emp-name-input" /></Field>
                  <Field label="Email *"><Input value={form.email} onChange={(e)=>setForm({...form,email:e.target.value})} className="rounded-sm" data-testid="emp-email-input" /></Field>
                  <Field label="Mobile"><Input value={form.mobile} onChange={(e)=>setForm({...form,mobile:e.target.value})} className="rounded-sm" /></Field>
                  <Field label="Department"><Input value={form.department} onChange={(e)=>setForm({...form,department:e.target.value})} className="rounded-sm" /></Field>
                  <Field label="Designation"><Input value={form.designation} onChange={(e)=>setForm({...form,designation:e.target.value})} className="rounded-sm" /></Field>
                  <Field label="Territory"><Input value={form.territory} onChange={(e)=>setForm({...form,territory:e.target.value})} className="rounded-sm" /></Field>
                  <div className="col-span-2">
                    <Field label="Role">
                      <Select value={form.role} onValueChange={(v)=>setForm({...form,role:v})}>
                        <SelectTrigger className="rounded-sm" data-testid="emp-role-select"><SelectValue /></SelectTrigger>
                        <SelectContent>{ROLES.map((r)=><SelectItem key={r.v} value={r.v}>{r.l}</SelectItem>)}</SelectContent>
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
                <td className="px-4 py-3"><span className="text-xs px-2 py-1 bg-zinc-100 rounded-sm border border-zinc-200 capitalize">{e.role.replace("_"," ")}</span></td>
                <td className="px-4 py-3 text-zinc-600">{e.department || "—"}</td>
                <td className="px-4 py-3 text-zinc-600">{e.territory || "—"}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-1 rounded-sm border ${e.status==="Active" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200"}`}>{e.status}</span>
                </td>
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
