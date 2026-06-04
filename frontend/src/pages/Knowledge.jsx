import { useEffect, useState } from "react";
import http, { formatErr } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MagnifyingGlass, BookOpen, Plus, PencilSimple, Trash } from "@phosphor-icons/react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";

const CATS = ["Product Guide", "Brand Guide", "FAQ", "Troubleshooting", "Competitor", "Sales Talk", "Installation"];
const empty = { category: "Product Guide", title: "", body: "", published: true };

export default function Knowledge() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);

  const isAdmin = ["super_admin", "admin"].includes(user?.role);
  const load = () => http.get("/knowledge").then(({ data }) => setItems(data));
  useEffect(() => { load(); }, []);

  const openNew = () => { setEditing(null); setForm(empty); setOpen(true); };
  const openEdit = (it) => { setEditing(it); setForm({ category: it.category, title: it.title, body: it.body, published: it.published ?? true }); setOpen(true); };

  const save = async () => {
    try {
      if (editing) await http.put(`/knowledge/${editing.id}`, form);
      else await http.post("/knowledge", form);
      toast.success("Saved");
      setOpen(false); setEditing(null); setForm(empty); load();
    } catch (e) { toast.error(formatErr(e.response?.data?.detail)); }
  };

  const remove = async (it) => {
    if (!window.confirm(`Delete "${it.title}"?`)) return;
    try { await http.delete(`/knowledge/${it.id}`); load(); toast.success("Deleted"); }
    catch (e) { toast.error(formatErr(e.response?.data?.detail)); }
  };

  const filtered = items.filter((i) => !q || (i.title + i.body + i.category).toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="p-6 lg:p-8">
      <div className="flex justify-between items-end mb-6 flex-wrap gap-3">
        <div>
          <div className="overline text-zinc-500 mb-1">Reference Library</div>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">Knowledge Hub</h1>
          <p className="text-zinc-500 text-sm mt-1">{filtered.length} articles</p>
        </div>
        {isAdmin && (
          <Button onClick={openNew} className="bg-rose-600 hover:bg-rose-700 rounded-sm" data-testid="new-knowledge-btn">
            <Plus size={16} className="mr-1" />New Article
          </Button>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-sm max-w-2xl">
          <DialogHeader><DialogTitle>{editing ? "Edit Article" : "New Article"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-[11px] uppercase tracking-wider text-zinc-600 mb-1 block">Category</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger className="rounded-sm"><SelectValue /></SelectTrigger>
                <SelectContent>{CATS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[11px] uppercase tracking-wider text-zinc-600 mb-1 block">Title</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="rounded-sm" data-testid="k-title-input" />
            </div>
            <div>
              <Label className="text-[11px] uppercase tracking-wider text-zinc-600 mb-1 block">Body</Label>
              <Textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} rows={6} className="rounded-sm" data-testid="k-body-input" />
            </div>
            <Button onClick={save} className="bg-rose-600 hover:bg-rose-700 rounded-sm w-full" data-testid="save-k-btn">Save</Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="relative max-w-md mb-4">
        <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
        <Input placeholder="Search knowledge…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9 rounded-sm bg-white border-zinc-300" data-testid="knowledge-search" />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {filtered.map((it) => (
          <div key={it.id} className="bg-white border border-zinc-200 p-5 hover:border-zinc-300 group relative" data-testid={`knowledge-${it.id}`}>
            <div className="flex items-start gap-3">
              <div className="h-9 w-9 bg-rose-50 text-rose-600 flex items-center justify-center rounded-sm shrink-0"><BookOpen size={18} weight="duotone" /></div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="overline text-zinc-500 mb-1">{it.category}</div>
                  {isAdmin && (
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => openEdit(it)} className="p-1 hover:bg-zinc-100 text-zinc-500 rounded-sm" data-testid={`edit-k-${it.id}`}><PencilSimple size={14} /></button>
                      <button onClick={() => remove(it)} className="p-1 hover:bg-rose-50 text-rose-500 rounded-sm" data-testid={`del-k-${it.id}`}><Trash size={14} /></button>
                    </div>
                  )}
                </div>
                <h3 className="font-bold text-zinc-900 mb-2">{it.title}</h3>
                <p className="text-sm text-zinc-700 leading-relaxed">{it.body}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
