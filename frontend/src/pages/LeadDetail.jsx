import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import http, { formatErr } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  ArrowLeft, MapPin, Phone, EnvelopeSimple, Buildings, Plus,
  Receipt, Camera, ClipboardText, Clock, FileText, NavigationArrow,
  CheckCircle, ChatCircle, PhoneCall, Note,
} from "@phosphor-icons/react";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const STATUSES = ["New","Contacted","Site Visit","Quotation","Negotiation","Won","Lost"];

const inr = (n) => "INR " + Number(n || 0).toLocaleString("en-IN");

export default function LeadDetail() {
  const { id } = useParams();
  const [lead, setLead] = useState(null);
  const [acts, setActs] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [quots, setQuots] = useState([]);

  const refresh = async () => {
    const [l, a, t, q] = await Promise.all([
      http.get(`/leads/${id}`),
      http.get(`/leads/${id}/activities`),
      http.get(`/tasks?lead_id=${id}`),
      http.get(`/quotations?lead_id=${id}`),
    ]);
    setLead(l.data); setActs(a.data); setTasks(t.data); setQuots(q.data);
  };

  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [id]);

  if (!lead) return <div className="p-8 text-zinc-500">Loading…</div>;

  const updateStatus = async (newStatus) => {
    try {
      await http.put(`/leads/${id}`, { status: newStatus });
      toast.success("Status updated");
      refresh();
    } catch (e) { toast.error(formatErr(e.response?.data?.detail)); }
  };

  const sv = lead.site_visit || {};
  const hc = lead.health_score >= 71 ? "text-emerald-600" : lead.health_score >= 41 ? "text-amber-600" : "text-rose-600";

  return (
    <div className="min-h-full bg-zinc-100">
      {/* Header */}
      <div className="bg-white border-b border-zinc-200 px-6 lg:px-8 py-5">
        <Link to="/leads" className="text-xs text-zinc-500 hover:text-rose-600 flex items-center gap-1 mb-3" data-testid="back-to-leads">
          <ArrowLeft size={12} /> Back to Leads
        </Link>
        <div className="flex flex-wrap gap-4 items-start justify-between">
          <div>
            <div className="overline text-zinc-500 mb-1">{lead.lead_type}</div>
            <h1 className="text-3xl font-extrabold tracking-tight">{lead.lead_name}</h1>
            <div className="flex flex-wrap gap-3 mt-2 text-sm text-zinc-600">
              {lead.company_name && <span className="flex items-center gap-1"><Buildings size={14} />{lead.company_name}</span>}
              {lead.mobile && <span className="flex items-center gap-1"><Phone size={14} />{lead.mobile}</span>}
              {lead.email && <span className="flex items-center gap-1"><EnvelopeSimple size={14} />{lead.email}</span>}
              {lead.city && <span className="flex items-center gap-1"><MapPin size={14} />{lead.city}, {lead.state}</span>}
            </div>
          </div>
          <div className="flex items-end gap-4">
            <div className="text-right">
              <div className="overline text-zinc-500">Health Score</div>
              <div className={`text-4xl font-extrabold font-mono-data ${hc}`} data-testid="health-score">{lead.health_score}<span className="text-zinc-400 text-xl">/100</span></div>
            </div>
            <div>
              <div className="overline text-zinc-500 mb-1">Status</div>
              <Select value={lead.status} onValueChange={updateStatus}>
                <SelectTrigger data-testid="lead-status-select" className="w-[160px] rounded-sm"><SelectValue /></SelectTrigger>
                <SelectContent>{STATUSES.map((s)=><SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      <div className="p-6 lg:p-8">
        <Tabs defaultValue="overview">
          <TabsList className="bg-white border border-zinc-200 rounded-sm h-auto p-0 flex-wrap" data-testid="lead-tabs">
            {["overview","activities","site","photos","tasks","quotations","timeline"].map((t) => (
              <TabsTrigger key={t} value={t} data-testid={`tab-${t}`} className="rounded-sm data-[state=active]:bg-zinc-900 data-[state=active]:text-white capitalize px-4 py-2">
                {t === "site" ? "Site Verification" : t}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="overview" className="mt-4">
            <div className="grid lg:grid-cols-3 gap-4">
              <Card title="Lead Details">
                <Row k="Source" v={lead.lead_source} />
                <Row k="Type" v={lead.lead_type} />
                <Row k="Priority" v={lead.priority} />
                <Row k="Visit" v={lead.visit_requirement} />
                <Row k="Expected Value" v={inr(lead.expected_deal_value)} />
              </Card>
              <Card title="Address">
                <p className="text-sm text-zinc-700">{lead.address || "—"}</p>
                <p className="text-sm text-zinc-500 mt-1">{lead.city} {lead.state && `, ${lead.state}`}</p>
              </Card>
              <Card title="Notes">
                <p className="text-sm text-zinc-700 whitespace-pre-line">{lead.notes || "—"}</p>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="activities" className="mt-4">
            <ActivityComposer leadId={id} onDone={refresh} />
            <ActivityList acts={acts} />
          </TabsContent>

          <TabsContent value="site" className="mt-4">
            <SiteVerification lead={lead} sv={sv} onDone={refresh} />
          </TabsContent>

          <TabsContent value="photos" className="mt-4">
            <Photos lead={lead} sv={sv} onDone={refresh} />
          </TabsContent>

          <TabsContent value="tasks" className="mt-4">
            <TaskPanel leadId={id} tasks={tasks} onDone={refresh} />
          </TabsContent>

          <TabsContent value="quotations" className="mt-4">
            <QuotationPanel lead={lead} quots={quots} onDone={refresh} />
          </TabsContent>

          <TabsContent value="timeline" className="mt-4">
            <ActivityList acts={acts} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

const Card = ({ title, children }) => (
  <div className="bg-white border border-zinc-200 p-5">
    <div className="overline text-zinc-500 mb-3">{title}</div>
    {children}
  </div>
);

const Row = ({ k, v }) => (
  <div className="flex justify-between py-2 border-b border-zinc-100 last:border-0 text-sm">
    <span className="text-zinc-500">{k}</span>
    <span className="text-zinc-900 font-medium">{v || "—"}</span>
  </div>
);

const ICON = { call: PhoneCall, whatsapp: ChatCircle, meeting: Buildings, note: Note,
  lead_created: Plus, status_change: CheckCircle, gps_visit: NavigationArrow, quotation_created: Receipt };

const ActivityComposer = ({ leadId, onDone }) => {
  const [type, setType] = useState("call");
  const [desc, setDesc] = useState("");
  const add = async () => {
    if (!desc.trim()) return;
    try {
      await http.post("/activities", { lead_id: leadId, activity_type: type, description: desc });
      setDesc(""); onDone(); toast.success("Activity logged");
    } catch (e) { toast.error(formatErr(e.response?.data?.detail)); }
  };
  return (
    <div className="bg-white border border-zinc-200 p-4 mb-4">
      <div className="flex gap-2">
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="w-[140px] rounded-sm" data-testid="activity-type-select"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="call">Call</SelectItem>
            <SelectItem value="whatsapp">WhatsApp</SelectItem>
            <SelectItem value="meeting">Meeting</SelectItem>
            <SelectItem value="note">Note</SelectItem>
          </SelectContent>
        </Select>
        <Input data-testid="activity-desc-input" placeholder="Quick log…" value={desc} onChange={(e)=>setDesc(e.target.value)} className="rounded-sm flex-1" />
        <Button data-testid="log-activity-btn" onClick={add} className="bg-rose-600 hover:bg-rose-700 rounded-sm">Log</Button>
      </div>
    </div>
  );
};

const ActivityList = ({ acts }) => (
  <div className="bg-white border border-zinc-200 divide-y divide-zinc-100">
    {acts.length === 0 && <div className="p-8 text-center text-zinc-400 text-sm">No activities yet.</div>}
    {acts.map((a) => {
      const Icon = ICON[a.activity_type] || Clock;
      return (
        <div key={a.id} className="p-4 flex gap-3 hover:bg-zinc-50">
          <div className="h-8 w-8 rounded-sm bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
            <Icon size={16} weight="duotone" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm text-zinc-900">{a.description}</div>
            <div className="text-xs text-zinc-500 mt-0.5">
              {a.user_name} · {new Date(a.created_at).toLocaleString()}
            </div>
          </div>
        </div>
      );
    })}
  </div>
);

const SiteVerification = ({ lead, sv, onDone }) => {
  const [busy, setBusy] = useState(false);
  const [notes, setNotes] = useState(sv.requirement_notes || "");
  const [siteAddr, setSiteAddr] = useState(sv.site_address || "");

  const capture = async () => {
    if (!navigator.geolocation) return toast.error("GPS not supported");
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          await http.post(`/leads/${lead.id}/site-visit`, {
            gps_lat: pos.coords.latitude,
            gps_lng: pos.coords.longitude,
            gps_accuracy: pos.coords.accuracy,
            site_address: siteAddr,
            requirement_notes: notes,
            photos: sv.photos || [],
          });
          toast.success("GPS site visit verified");
          onDone();
        } catch (e) { toast.error(formatErr(e.response?.data?.detail)); }
        finally { setBusy(false); }
      },
      (err) => { toast.error("GPS denied: " + err.message); setBusy(false); },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <div className="bg-white border border-zinc-200 p-5">
        <div className="overline text-zinc-500 mb-3">GPS Verification</div>
        {sv.gps_lat ? (
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2 text-emerald-600 font-medium"><CheckCircle weight="fill" /> Verified by {sv.executive_name}</div>
            <div className="font-mono-data text-xs text-zinc-700">
              Lat: {sv.gps_lat.toFixed(6)}<br />
              Lng: {sv.gps_lng.toFixed(6)}<br />
              Accuracy: ±{Math.round(sv.gps_accuracy || 0)}m
            </div>
            <div className="text-xs text-zinc-500">{new Date(sv.timestamp).toLocaleString()}</div>
            <a href={`https://www.google.com/maps?q=${sv.gps_lat},${sv.gps_lng}`} target="_blank" rel="noreferrer" className="text-rose-600 text-sm hover:underline">Open in Google Maps →</a>
          </div>
        ) : (
          <div className="text-sm text-zinc-500">Not yet verified.</div>
        )}
      </div>
      <div className="bg-white border border-zinc-200 p-5">
        <div className="overline text-zinc-500 mb-3">Capture / Update</div>
        <div className="space-y-3">
          <div>
            <Label className="text-[11px] uppercase tracking-wider text-zinc-600 mb-1 block">Site Address</Label>
            <Input value={siteAddr} onChange={(e)=>setSiteAddr(e.target.value)} className="rounded-sm" data-testid="site-address-input" />
          </div>
          <div>
            <Label className="text-[11px] uppercase tracking-wider text-zinc-600 mb-1 block">Requirement Notes</Label>
            <Textarea value={notes} onChange={(e)=>setNotes(e.target.value)} rows={4} className="rounded-sm" data-testid="site-notes-input" />
          </div>
          <Button onClick={capture} disabled={busy} className="bg-rose-600 hover:bg-rose-700 rounded-sm w-full" data-testid="capture-gps-btn">
            <NavigationArrow size={16} className="mr-2" /> {busy ? "Capturing…" : "Capture GPS & Save"}
          </Button>
        </div>
      </div>
    </div>
  );
};

const Photos = ({ lead, sv, onDone }) => {
  const [uploading, setUploading] = useState(false);
  const upload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    try {
      const { data } = await http.post("/files/upload", fd, { headers: { "Content-Type": "multipart/form-data" } });
      const existing = sv.photos || [];
      await http.post(`/leads/${lead.id}/site-visit`, {
        gps_lat: sv.gps_lat || 0, gps_lng: sv.gps_lng || 0,
        gps_accuracy: sv.gps_accuracy || 0, site_address: sv.site_address || "",
        requirement_notes: sv.requirement_notes || "", photos: [...existing, data.id],
      });
      toast.success("Photo uploaded");
      onDone();
    } catch (e) { toast.error("Upload failed"); }
    finally { setUploading(false); e.target.value = ""; }
  };
  const photos = sv.photos || [];
  const API = process.env.REACT_APP_BACKEND_URL + "/api";
  return (
    <div>
      <div className="bg-white border border-zinc-200 p-5 mb-4 flex items-center justify-between">
        <div className="overline text-zinc-500">{photos.length} photos</div>
        <label className="inline-flex">
          <input type="file" accept="image/*" onChange={upload} className="hidden" data-testid="photo-upload-input" />
          <span className="bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 text-sm font-medium rounded-sm cursor-pointer inline-flex items-center gap-2">
            <Camera size={16} /> {uploading ? "Uploading…" : "Upload Photo"}
          </span>
        </label>
      </div>
      {photos.length === 0 ? (
        <div className="bg-white border border-zinc-200 p-12 text-center text-zinc-400 text-sm">No photos yet.</div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {photos.map((pid) => (
            <a key={pid} href={`${API}/files/${pid}`} target="_blank" rel="noreferrer" className="aspect-square bg-white border border-zinc-200 overflow-hidden hover:border-rose-400 transition-all">
              <img src={`${API}/files/${pid}`} alt="" className="w-full h-full object-cover" />
            </a>
          ))}
        </div>
      )}
    </div>
  );
};

const TaskPanel = ({ leadId, tasks, onDone }) => {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", task_type: "Follow-Up", due_date: "" });
  const save = async () => {
    try {
      await http.post("/tasks", { ...form, lead_id: leadId });
      toast.success("Task created"); setOpen(false); setForm({ title:"", description:"", task_type:"Follow-Up", due_date:"" });
      onDone();
    } catch (e) { toast.error(formatErr(e.response?.data?.detail)); }
  };
  const toggle = async (t) => {
    await http.put(`/tasks/${t.id}`, { status: t.status === "Done" ? "Open" : "Done" });
    onDone();
  };
  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <div className="overline text-zinc-500">{tasks.length} tasks</div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button data-testid="new-task-btn" className="bg-rose-600 hover:bg-rose-700 rounded-sm"><Plus size={16} className="mr-1" />New Task</Button></DialogTrigger>
          <DialogContent className="rounded-sm">
            <DialogHeader><DialogTitle>New Task</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <Input placeholder="Task title" value={form.title} onChange={(e)=>setForm({...form,title:e.target.value})} className="rounded-sm" data-testid="task-title-input" />
              <Textarea placeholder="Description" value={form.description} onChange={(e)=>setForm({...form,description:e.target.value})} className="rounded-sm" rows={3} />
              <Select value={form.task_type} onValueChange={(v)=>setForm({...form,task_type:v})}>
                <SelectTrigger className="rounded-sm"><SelectValue /></SelectTrigger>
                <SelectContent>{["Follow-Up","Visit","Quotation","Product Demo","Installation","Collection","Service"].map((x)=><SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent>
              </Select>
              <Input type="date" value={form.due_date} onChange={(e)=>setForm({...form, due_date:e.target.value})} className="rounded-sm" />
              <Button onClick={save} className="bg-rose-600 hover:bg-rose-700 rounded-sm w-full" data-testid="save-task-btn">Create</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <div className="bg-white border border-zinc-200 divide-y divide-zinc-100">
        {tasks.length === 0 && <div className="p-8 text-center text-zinc-400 text-sm">No tasks yet.</div>}
        {tasks.map((t) => (
          <div key={t.id} className="p-4 flex items-start gap-3 hover:bg-zinc-50">
            <button onClick={()=>toggle(t)} className={`h-5 w-5 rounded-sm border flex items-center justify-center mt-0.5 ${t.status === "Done" ? "bg-emerald-500 border-emerald-500 text-white" : "border-zinc-300 hover:border-rose-400"}`} data-testid={`toggle-task-${t.id}`}>
              {t.status === "Done" && <CheckCircle weight="fill" size={14} />}
            </button>
            <div className="flex-1">
              <div className={`text-sm font-medium ${t.status==="Done" ? "line-through text-zinc-400" : "text-zinc-900"}`}>{t.title}</div>
              {t.description && <div className="text-xs text-zinc-500 mt-0.5">{t.description}</div>}
              <div className="text-xs text-zinc-400 mt-1">{t.task_type}{t.due_date && ` · Due ${t.due_date}`}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const QuotationPanel = ({ lead, quots, onDone }) => {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([{ product_name: "", quantity: 1, unit_price: 0, discount_pct: 0, gst_rate: 18 }]);
  const [terms, setTerms] = useState("50% advance, balance against delivery. Warranty as per brand.");

  const calc = () => {
    let sub=0, disc=0, tax=0;
    items.forEach((it)=>{
      const line = (it.quantity||0)*(it.unit_price||0);
      const d = line*(it.discount_pct||0)/100;
      const t = (line-d)*(it.gst_rate||0)/100;
      sub+=line; disc+=d; tax+=t;
    });
    return { subtotal: sub, discount: disc, tax, total: sub-disc+tax };
  };
  const totals = calc();

  const save = async () => {
    try {
      const valid = items.filter(i=>i.product_name);
      if (valid.length === 0) return toast.error("Add at least one product");
      await http.post("/quotations", { lead_id: lead.id, items: valid, terms });
      toast.success("Quotation created");
      setOpen(false); setItems([{ product_name: "", quantity: 1, unit_price: 0, discount_pct: 0, gst_rate: 18 }]);
      onDone();
    } catch (e) { toast.error(formatErr(e.response?.data?.detail)); }
  };

  const downloadPDF = (q) => {
    const doc = new jsPDF();
    doc.setFontSize(20); doc.setTextColor(225, 29, 72);
    doc.text("NMP", 14, 18);
    doc.setFontSize(10); doc.setTextColor(82, 82, 91);
    doc.text("New Music Palace · Sales OS", 14, 24);
    doc.setFontSize(14); doc.setTextColor(24, 24, 27);
    doc.text(`Quotation: ${q.quotation_number}`, 14, 38);
    doc.setFontSize(10); doc.setTextColor(82, 82, 91);
    doc.text(`Date: ${new Date(q.created_at).toLocaleDateString()}`, 14, 44);
    doc.text(`Customer: ${lead.lead_name}${lead.company_name ? ` (${lead.company_name})` : ""}`, 14, 50);
    if (lead.address) doc.text(`Address: ${lead.address}, ${lead.city || ""}`, 14, 56);

    autoTable(doc, {
      head: [["SKU", "Product", "Qty", "Unit Price", "Disc %", "GST %", "Amount"]],
      body: q.items.map((it)=>{
        const line = it.quantity*it.unit_price;
        const d = line*(it.discount_pct||0)/100;
        const taxable = line - d;
        const t = taxable * (it.gst_rate||18)/100;
        return [it.sku || "-", it.product_name, it.quantity, it.unit_price.toFixed(2), it.discount_pct, it.gst_rate, (taxable+t).toFixed(2)];
      }),
      startY: 64,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [24, 24, 27], textColor: 255 },
    });

    let y = doc.lastAutoTable.finalY + 8;
    doc.setFontSize(10);
    doc.text(`Subtotal: INR ${q.totals.subtotal.toFixed(2)}`, 140, y); y+=5;
    doc.text(`Discount: INR ${q.totals.discount.toFixed(2)}`, 140, y); y+=5;
    doc.text(`GST: INR ${q.totals.tax.toFixed(2)}`, 140, y); y+=5;
    doc.setFontSize(12); doc.setTextColor(225, 29, 72);
    doc.text(`Total: INR ${q.totals.total.toFixed(2)}`, 140, y+2);

    doc.setFontSize(9); doc.setTextColor(82,82,91);
    doc.text("Terms & Conditions:", 14, y+15);
    doc.text(doc.splitTextToSize(q.terms || "", 180), 14, y+20);

    doc.save(`${q.quotation_number}.pdf`);
  };

  const updItem = (i, k, v) => { const a=[...items]; a[i][k]=k==="product_name"||k==="sku"?v:Number(v); setItems(a); };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <div className="overline text-zinc-500">{quots.length} quotations</div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button data-testid="new-quotation-btn" className="bg-rose-600 hover:bg-rose-700 rounded-sm"><Plus size={16} className="mr-1" />New Quotation</Button></DialogTrigger>
          <DialogContent className="rounded-sm max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Create Quotation</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="overline text-zinc-500">Items</div>
              {items.map((it, i)=>(
                <div key={i} className="grid grid-cols-6 gap-2 items-end">
                  <Input placeholder="Product" className="rounded-sm col-span-2" value={it.product_name} onChange={(e)=>updItem(i,"product_name",e.target.value)} data-testid={`quot-product-${i}`} />
                  <Input type="number" placeholder="Qty" className="rounded-sm" value={it.quantity} onChange={(e)=>updItem(i,"quantity",e.target.value)} />
                  <Input type="number" placeholder="Price" className="rounded-sm" value={it.unit_price} onChange={(e)=>updItem(i,"unit_price",e.target.value)} />
                  <Input type="number" placeholder="Disc%" className="rounded-sm" value={it.discount_pct} onChange={(e)=>updItem(i,"discount_pct",e.target.value)} />
                  <Input type="number" placeholder="GST%" className="rounded-sm" value={it.gst_rate} onChange={(e)=>updItem(i,"gst_rate",e.target.value)} />
                </div>
              ))}
              <Button variant="outline" onClick={()=>setItems([...items,{product_name:"",quantity:1,unit_price:0,discount_pct:0,gst_rate:18}])} className="rounded-sm">+ Add Item</Button>
              <div>
                <Label className="text-[11px] uppercase tracking-wider text-zinc-600 mb-1 block">Terms</Label>
                <Textarea value={terms} onChange={(e)=>setTerms(e.target.value)} rows={2} className="rounded-sm" />
              </div>
              <div className="bg-zinc-50 p-3 border border-zinc-200 text-sm font-mono-data">
                <div className="flex justify-between"><span>Subtotal</span><span>{inr(totals.subtotal)}</span></div>
                <div className="flex justify-between text-zinc-500"><span>Discount</span><span>-{inr(totals.discount)}</span></div>
                <div className="flex justify-between text-zinc-500"><span>GST</span><span>+{inr(totals.tax)}</span></div>
                <div className="flex justify-between text-rose-600 font-bold border-t border-zinc-300 pt-2 mt-2"><span>Total</span><span>{inr(totals.total)}</span></div>
              </div>
              <Button onClick={save} className="bg-rose-600 hover:bg-rose-700 rounded-sm w-full" data-testid="save-quotation-btn">Save Quotation</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <div className="bg-white border border-zinc-200 divide-y divide-zinc-100">
        {quots.length === 0 && <div className="p-8 text-center text-zinc-400 text-sm">No quotations yet.</div>}
        {quots.map((q) => (
          <div key={q.id} className="p-4 flex items-center justify-between hover:bg-zinc-50">
            <div>
              <div className="font-mono-data font-bold text-zinc-900">{q.quotation_number}</div>
              <div className="text-xs text-zinc-500 mt-0.5">{q.items.length} items · {new Date(q.created_at).toLocaleDateString()}</div>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-mono-data font-bold text-rose-600">{inr(q.totals.total)}</span>
              <Button onClick={()=>downloadPDF(q)} variant="outline" size="sm" className="rounded-sm" data-testid={`download-pdf-${q.id}`}>
                <FileText size={14} className="mr-1" /> PDF
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
