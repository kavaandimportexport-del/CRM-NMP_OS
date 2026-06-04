import { useEffect, useState } from "react";
import http, { formatErr } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Books, CheckCircle, Question, ShoppingBag, Plus, PencilSimple, Trash } from "@phosphor-icons/react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";

const empty = { category: "", discovery_questions: "", products: "", checklist: "", objections: "" };

export default function Playbooks() {
  const { user } = useAuth();
  const [pbs, setPbs] = useState([]);
  const [active, setActive] = useState(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);

  const isAdmin = ["super_admin", "admin"].includes(user?.role);

  const load = async () => {
    const { data } = await http.get("/playbooks");
    setPbs(data);
    if (data.length && !active) setActive(data[0]);
    if (active) {
      const updated = data.find((p) => p.id === active.id);
      if (updated) setActive(updated);
    }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const openNew = () => {
    setEditing(null);
    setForm(empty);
    setOpen(true);
  };

  const openEdit = (pb) => {
    setEditing(pb);
    setForm({
      category: pb.category,
      discovery_questions: pb.discovery_questions.join("\n"),
      products: pb.products.join("\n"),
      checklist: pb.checklist.join("\n"),
      objections: pb.objections.map((o) => `${o.o} | ${o.r}`).join("\n"),
    });
    setOpen(true);
  };

  const save = async () => {
    const payload = {
      category: form.category,
      discovery_questions: form.discovery_questions.split("\n").map((s) => s.trim()).filter(Boolean),
      products: form.products.split("\n").map((s) => s.trim()).filter(Boolean),
      checklist: form.checklist.split("\n").map((s) => s.trim()).filter(Boolean),
      objections: form.objections.split("\n").map((s) => {
        const [o, r] = s.split("|").map((x) => x.trim());
        return o && r ? { o, r } : null;
      }).filter(Boolean),
    };
    try {
      if (editing) await http.put(`/playbooks/${editing.id}`, payload);
      else await http.post("/playbooks", payload);
      toast.success("Saved");
      setOpen(false); setEditing(null); setForm(empty);
      load();
    } catch (e) { toast.error(formatErr(e.response?.data?.detail)); }
  };

  const remove = async (pb) => {
    if (!window.confirm(`Delete playbook "${pb.category}"?`)) return;
    try { await http.delete(`/playbooks/${pb.id}`); setActive(null); load(); toast.success("Deleted"); }
    catch (e) { toast.error(formatErr(e.response?.data?.detail)); }
  };

  return (
    <div className="p-6 lg:p-8">
      <div className="flex justify-between items-end mb-6 flex-wrap gap-3">
        <div>
          <div className="overline text-zinc-500 mb-1">Field Playbooks</div>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">Sales Playbooks</h1>
        </div>
        {isAdmin && (
          <Button onClick={openNew} className="bg-rose-600 hover:bg-rose-700 rounded-sm" data-testid="new-playbook-btn">
            <Plus size={16} className="mr-1" />New Playbook
          </Button>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-sm max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Edit Playbook" : "New Playbook"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-[11px] uppercase tracking-wider text-zinc-600 mb-1 block">Category Name</Label>
              <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="rounded-sm" data-testid="pb-category-input" />
            </div>
            <div>
              <Label className="text-[11px] uppercase tracking-wider text-zinc-600 mb-1 block">Discovery Questions (one per line)</Label>
              <Textarea value={form.discovery_questions} onChange={(e) => setForm({ ...form, discovery_questions: e.target.value })} rows={4} className="rounded-sm font-mono-data text-xs" />
            </div>
            <div>
              <Label className="text-[11px] uppercase tracking-wider text-zinc-600 mb-1 block">Objections (format: objection | response — one per line)</Label>
              <Textarea value={form.objections} onChange={(e) => setForm({ ...form, objections: e.target.value })} rows={3} className="rounded-sm font-mono-data text-xs" />
            </div>
            <div>
              <Label className="text-[11px] uppercase tracking-wider text-zinc-600 mb-1 block">Recommended Products (one per line)</Label>
              <Textarea value={form.products} onChange={(e) => setForm({ ...form, products: e.target.value })} rows={3} className="rounded-sm font-mono-data text-xs" />
            </div>
            <div>
              <Label className="text-[11px] uppercase tracking-wider text-zinc-600 mb-1 block">Closing Checklist (one per line)</Label>
              <Textarea value={form.checklist} onChange={(e) => setForm({ ...form, checklist: e.target.value })} rows={3} className="rounded-sm font-mono-data text-xs" />
            </div>
            <Button onClick={save} className="bg-rose-600 hover:bg-rose-700 rounded-sm w-full" data-testid="save-playbook-btn">Save</Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="grid lg:grid-cols-4 gap-4">
        <div className="lg:col-span-1 bg-white border border-zinc-200">
          {pbs.map((p) => (
            <button key={p.id} onClick={() => setActive(p)} className={`w-full text-left px-4 py-3 border-b border-zinc-100 hover:bg-zinc-50 transition-all flex items-center gap-2 ${active?.id === p.id ? "bg-zinc-900 text-white hover:bg-zinc-900" : ""}`} data-testid={`playbook-${p.id}`}>
              <Books size={16} />
              <span className="text-sm font-medium flex-1">{p.category}</span>
            </button>
          ))}
        </div>
        {active && (
          <div className="lg:col-span-3 space-y-4">
            {isAdmin && (
              <div className="flex justify-end gap-2">
                <Button onClick={() => openEdit(active)} variant="outline" size="sm" className="rounded-sm" data-testid={`edit-pb-${active.id}`}>
                  <PencilSimple size={14} className="mr-1" />Edit
                </Button>
                <Button onClick={() => remove(active)} variant="outline" size="sm" className="rounded-sm text-rose-600 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-300" data-testid={`del-pb-${active.id}`}>
                  <Trash size={14} className="mr-1" />Delete
                </Button>
              </div>
            )}
            <Section icon={Question} title="Discovery Questions" items={active.discovery_questions} />
            <div className="bg-white border border-zinc-200 p-5">
              <div className="overline text-zinc-500 mb-3 flex items-center gap-2"><Question size={14} />Objections &amp; Responses</div>
              <div className="space-y-3">
                {active.objections.map((o, i) => (
                  <div key={i} className="border-l-2 border-rose-500 pl-4">
                    <div className="text-sm font-semibold text-rose-700">"{o.o}"</div>
                    <div className="text-sm text-zinc-700 mt-1">→ {o.r}</div>
                  </div>
                ))}
              </div>
            </div>
            <Section icon={ShoppingBag} title="Recommended Products" items={active.products} />
            <Section icon={CheckCircle} title="Closing Checklist" items={active.checklist} />
          </div>
        )}
      </div>
    </div>
  );
}

const Section = ({ icon: Icon, title, items }) => (
  <div className="bg-white border border-zinc-200 p-5">
    <div className="overline text-zinc-500 mb-3 flex items-center gap-2"><Icon size={14} />{title}</div>
    <ul className="space-y-2">
      {items.map((it, i) => (
        <li key={i} className="text-sm text-zinc-700 flex gap-2"><span className="text-rose-500 font-mono-data">{(i + 1).toString().padStart(2, "0")}</span>{it}</li>
      ))}
    </ul>
  </div>
);
