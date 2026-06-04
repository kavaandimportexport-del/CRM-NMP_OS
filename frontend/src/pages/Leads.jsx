import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import http, { formatErr } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, MagnifyingGlass, MapPin, Phone, Buildings } from "@phosphor-icons/react";
import { toast } from "sonner";

const SOURCES = ["Website","Phone Inquiry","WhatsApp","Instagram","Facebook","Google Ads","JustDial","Reference","Walk-In Customer","Cold Visit","Dealer Visit","School Visit","Church Visit","Corporate Visit","Event Company Visit"];
const TYPES = ["Product Sale", "Site Survey Required", "Project Opportunity"];
const VISITS = ["Not Required", "Recommended", "Mandatory"];
const STATUSES = ["New","Contacted","Site Visit","Quotation","Negotiation","Won","Lost"];
const PRIORITIES = ["Low", "Medium", "High", "Urgent"];

const statusColor = (s) => ({
  New: "bg-zinc-100 text-zinc-700 border-zinc-300",
  Contacted: "bg-blue-50 text-blue-700 border-blue-200",
  "Site Visit": "bg-amber-50 text-amber-700 border-amber-200",
  Quotation: "bg-purple-50 text-purple-700 border-purple-200",
  Negotiation: "bg-orange-50 text-orange-700 border-orange-200",
  Won: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Lost: "bg-rose-50 text-rose-700 border-rose-200",
}[s] || "bg-zinc-100 text-zinc-700 border-zinc-300");

const priorityColor = (p) => ({
  Low: "text-zinc-500", Medium: "text-blue-600", High: "text-amber-600", Urgent: "text-rose-600",
}[p] || "text-zinc-500");

const healthColor = (h) => h >= 71 ? "text-emerald-600" : h >= 41 ? "text-amber-600" : "text-rose-600";

const empty = {
  lead_name: "", company_name: "", contact_person: "", mobile: "", email: "",
  address: "", city: "", state: "",
  lead_source: "Website", lead_type: "Product Sale", visit_requirement: "Not Required",
  expected_deal_value: 0, priority: "Medium", status: "New", notes: "",
};

export default function Leads() {
  const [leads, setLeads] = useState([]);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);

  const load = () => http.get("/leads").then(({ data }) => setLeads(data));
  useEffect(() => { load(); }, []);

  const save = async () => {
    try {
      await http.post("/leads", { ...form, expected_deal_value: Number(form.expected_deal_value) });
      toast.success("Lead created");
      setOpen(false); setForm(empty); load();
    } catch (e) { toast.error(formatErr(e.response?.data?.detail)); }
  };

  const filtered = leads.filter((l) => {
    const s = search.toLowerCase();
    const match = !s || [l.lead_name, l.company_name, l.contact_person, l.city, l.mobile].some(
      (f) => (f || "").toLowerCase().includes(s)
    );
    const typeOk = filterType === "all" || l.lead_type === filterType;
    return match && typeOk;
  });

  return (
    <div className="p-6 lg:p-8">
      <div className="flex flex-wrap gap-4 items-end justify-between mb-6">
        <div>
          <div className="overline text-zinc-500 mb-1">Customer Pipeline</div>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">Leads</h1>
          <p className="text-zinc-500 text-sm mt-1">{filtered.length} of {leads.length} leads</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button data-testid="new-lead-btn" className="bg-rose-600 hover:bg-rose-700 rounded-sm">
              <Plus size={16} className="mr-2" /> New Lead
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl rounded-sm">
            <DialogHeader><DialogTitle>Create Lead</DialogTitle></DialogHeader>
            <div className="grid md:grid-cols-2 gap-3">
              <Field label="Lead Name *"><Input data-testid="lead-name-input" value={form.lead_name} onChange={(e)=>setForm({...form, lead_name:e.target.value})} className="rounded-sm" /></Field>
              <Field label="Company"><Input value={form.company_name} onChange={(e)=>setForm({...form, company_name:e.target.value})} className="rounded-sm" /></Field>
              <Field label="Contact Person"><Input value={form.contact_person} onChange={(e)=>setForm({...form, contact_person:e.target.value})} className="rounded-sm" /></Field>
              <Field label="Mobile"><Input value={form.mobile} onChange={(e)=>setForm({...form, mobile:e.target.value})} className="rounded-sm" /></Field>
              <Field label="Email"><Input value={form.email} onChange={(e)=>setForm({...form, email:e.target.value})} className="rounded-sm" /></Field>
              <Field label="City"><Input value={form.city} onChange={(e)=>setForm({...form, city:e.target.value})} className="rounded-sm" /></Field>
              <Field label="State"><Input value={form.state} onChange={(e)=>setForm({...form, state:e.target.value})} className="rounded-sm" /></Field>
              <Field label="Expected Deal Value"><Input type="number" value={form.expected_deal_value} onChange={(e)=>setForm({...form, expected_deal_value:e.target.value})} className="rounded-sm font-mono-data" /></Field>
              <Field label="Lead Source">
                <SelectField value={form.lead_source} onValueChange={(v)=>setForm({...form, lead_source:v})} options={SOURCES} />
              </Field>
              <Field label="Lead Type">
                <SelectField value={form.lead_type} onValueChange={(v)=>setForm({...form, lead_type:v})} options={TYPES} />
              </Field>
              <Field label="Visit Requirement">
                <SelectField value={form.visit_requirement} onValueChange={(v)=>setForm({...form, visit_requirement:v})} options={VISITS} />
              </Field>
              <Field label="Priority">
                <SelectField value={form.priority} onValueChange={(v)=>setForm({...form, priority:v})} options={PRIORITIES} />
              </Field>
              <div className="md:col-span-2">
                <Field label="Address"><Input value={form.address} onChange={(e)=>setForm({...form, address:e.target.value})} className="rounded-sm" /></Field>
              </div>
              <div className="md:col-span-2">
                <Field label="Notes"><Textarea value={form.notes} onChange={(e)=>setForm({...form, notes:e.target.value})} className="rounded-sm" rows={3} /></Field>
              </div>
            </div>
            <Button data-testid="save-lead-btn" onClick={save} className="bg-rose-600 hover:bg-rose-700 rounded-sm">Create Lead</Button>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-[240px]">
          <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <Input
            data-testid="leads-search-input"
            placeholder="Search by name, company, mobile…"
            value={search}
            onChange={(e)=>setSearch(e.target.value)}
            className="pl-9 rounded-sm bg-white border-zinc-300"
          />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-[200px] rounded-sm bg-white border-zinc-300" data-testid="leads-filter-type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="bg-white border border-zinc-200 overflow-x-auto" data-testid="leads-table">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 sticky top-0">
            <tr className="text-left text-zinc-600 border-b border-zinc-200">
              <th className="px-4 py-3 overline">Lead</th>
              <th className="px-4 py-3 overline">Company</th>
              <th className="px-4 py-3 overline">Type</th>
              <th className="px-4 py-3 overline">Source</th>
              <th className="px-4 py-3 overline">Value</th>
              <th className="px-4 py-3 overline">Status</th>
              <th className="px-4 py-3 overline">Health</th>
              <th className="px-4 py-3 overline">Priority</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan="8" className="text-center py-12 text-zinc-400">No leads yet. Create your first lead.</td></tr>
            )}
            {filtered.map((l) => (
              <tr key={l.id} className="border-b border-zinc-100 hover:bg-zinc-50 transition-colors">
                <td className="px-4 py-3">
                  <Link to={`/leads/${l.id}`} data-testid={`lead-row-${l.id}`} className="font-medium text-zinc-900 hover:text-rose-600">
                    {l.lead_name}
                  </Link>
                  <div className="text-xs text-zinc-500 flex items-center gap-2 mt-0.5">
                    {l.mobile && <span className="flex items-center gap-1"><Phone size={11} />{l.mobile}</span>}
                    {l.city && <span className="flex items-center gap-1"><MapPin size={11} />{l.city}</span>}
                  </div>
                </td>
                <td className="px-4 py-3 text-zinc-700">
                  <div className="flex items-center gap-2"><Buildings size={14} className="text-zinc-400" />{l.company_name || "—"}</div>
                </td>
                <td className="px-4 py-3"><span className="text-xs px-2 py-1 bg-zinc-100 rounded-sm border border-zinc-200">{l.lead_type}</span></td>
                <td className="px-4 py-3 text-zinc-600 text-xs">{l.lead_source}</td>
                <td className="px-4 py-3 font-mono-data text-zinc-900">{l.expected_deal_value ? "INR " + Number(l.expected_deal_value).toLocaleString("en-IN") : "—"}</td>
                <td className="px-4 py-3"><span className={`text-xs px-2 py-1 rounded-sm border ${statusColor(l.status)}`}>{l.status}</span></td>
                <td className="px-4 py-3"><span className={`font-mono-data font-bold ${healthColor(l.health_score)}`}>{l.health_score}</span><span className="text-zinc-400 text-xs">/100</span></td>
                <td className={`px-4 py-3 font-semibold text-xs ${priorityColor(l.priority)}`}>{l.priority}</td>
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

const SelectField = ({ value, onValueChange, options }) => (
  <Select value={value} onValueChange={onValueChange}>
    <SelectTrigger className="rounded-sm"><SelectValue /></SelectTrigger>
    <SelectContent>{options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
  </Select>
);
