import { useEffect, useState } from "react";
import http, { formatErr } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, MagnifyingGlass, UploadSimple, PencilSimple, Trash } from "@phosphor-icons/react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";

export default function Inventory() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ sku: "", product_name: "", brand: "", category: "", cost_price: 0, selling_price: 0, mrp: 0, gst_rate: 18, stock: 0, warehouse: "" });

  const load = () => http.get(`/inventory${q ? `?search=${q}` : ""}`).then(({ data }) => setItems(data));
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [q]);

  const isAdmin = ["super_admin", "admin"].includes(user?.role);

  const openNew = () => { setEditing(null); setForm({ sku: "", product_name: "", brand: "", category: "", cost_price: 0, selling_price: 0, mrp: 0, gst_rate: 18, stock: 0, warehouse: "" }); setOpen(true); };
  const openEdit = (it) => { setEditing(it); setForm({ ...it }); setOpen(true); };

  const save = async () => {
    try {
      const payload = { ...form, cost_price: Number(form.cost_price), selling_price: Number(form.selling_price), mrp: Number(form.mrp), gst_rate: Number(form.gst_rate), stock: Number(form.stock) };
      if (editing) await http.put(`/inventory/${editing.id}`, payload);
      else await http.post("/inventory", payload);
      toast.success(editing ? "Product updated" : "Product added"); setOpen(false); load();
    } catch (e) { toast.error(formatErr(e.response?.data?.detail)); }
  };

  const remove = async (it) => {
    if (!window.confirm(`Delete "${it.product_name}"?`)) return;
    try { await http.delete(`/inventory/${it.id}`); toast.success("Deleted"); load(); }
    catch (e) { toast.error(formatErr(e.response?.data?.detail)); }
  };

  const uploadCSV = async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    const text = await file.text();
    const lines = text.split("\n").map(l=>l.trim()).filter(Boolean);
    const headers = lines[0].split(",").map(h=>h.trim().toLowerCase().replace(/\s+/g,"_"));
    const rows = lines.slice(1).map(l => {
      const cells = l.split(",");
      const obj = {};
      headers.forEach((h, i) => obj[h] = cells[i]?.trim() || "");
      return {
        sku: obj.sku || "", product_name: obj.product_name || obj.name || "",
        brand: obj.brand || "", category: obj.category || "",
        cost_price: Number(obj.cost_price)||0, selling_price: Number(obj.selling_price)||0,
        mrp: Number(obj.mrp)||0, gst_rate: Number(obj.gst_rate)||18,
        stock: Number(obj.stock)||0, warehouse: obj.warehouse || "",
      };
    }).filter(r=>r.sku && r.product_name);
    try {
      const { data } = await http.post("/inventory/bulk-import", rows);
      toast.success(`Imported ${data.imported} items`);
      load();
    } catch (err) { toast.error("Import failed"); }
    e.target.value = "";
  };

  return (
    <div className="p-6 lg:p-8">
      <div className="flex justify-between items-end mb-6">
        <div>
          <div className="overline text-zinc-500 mb-1">Catalog</div>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">Inventory</h1>
          <p className="text-zinc-500 text-sm mt-1">{items.length} products</p>
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            <label className="inline-flex">
              <input type="file" accept=".csv" onChange={uploadCSV} className="hidden" data-testid="inventory-csv-input" />
              <span className="border border-zinc-300 hover:bg-zinc-100 text-zinc-900 px-4 py-2 text-sm font-medium rounded-sm cursor-pointer inline-flex items-center gap-2">
                <UploadSimple size={14} /> Import CSV
              </span>
            </label>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild><Button onClick={openNew} className="bg-rose-600 hover:bg-rose-700 rounded-sm" data-testid="new-product-btn"><Plus size={16} className="mr-1" />Add Product</Button></DialogTrigger>
              <DialogContent className="rounded-sm">
                <DialogHeader><DialogTitle>{editing ? "Edit Product" : "Add Product"}</DialogTitle></DialogHeader>
                <div className="grid grid-cols-2 gap-3">
                  {["sku","product_name","brand","category","warehouse"].map((k)=>(
                    <div key={k}><Label className="text-[11px] uppercase tracking-wider text-zinc-600 mb-1 block">{k.replace("_"," ")}</Label><Input value={form[k]} onChange={(e)=>setForm({...form,[k]:e.target.value})} className="rounded-sm" /></div>
                  ))}
                  {["cost_price","selling_price","mrp","gst_rate","stock"].map((k)=>(
                    <div key={k}><Label className="text-[11px] uppercase tracking-wider text-zinc-600 mb-1 block">{k.replace("_"," ")}</Label><Input type="number" value={form[k]} onChange={(e)=>setForm({...form,[k]:e.target.value})} className="rounded-sm font-mono-data" /></div>
                  ))}
                  <Button onClick={save} className="bg-rose-600 hover:bg-rose-700 rounded-sm col-span-2">Save</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        )}
      </div>

      <div className="relative max-w-md mb-4">
        <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
        <Input placeholder="Search by SKU, name or brand…" value={q} onChange={(e)=>setQ(e.target.value)} className="pl-9 rounded-sm bg-white border-zinc-300" data-testid="inventory-search" />
      </div>

      <div className="bg-white border border-zinc-200 overflow-x-auto" data-testid="inventory-table">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50"><tr className="text-left border-b border-zinc-200">
            <th className="px-4 py-3 overline">SKU</th><th className="px-4 py-3 overline">Product</th>
            <th className="px-4 py-3 overline">Brand</th><th className="px-4 py-3 overline">Category</th>
            <th className="px-4 py-3 overline">MRP</th><th className="px-4 py-3 overline">Sell</th>
            <th className="px-4 py-3 overline">Stock</th><th className="px-4 py-3 overline">GST</th>
            {isAdmin && <th className="px-4 py-3 overline w-20">Actions</th>}
          </tr></thead>
          <tbody>
            {items.length === 0 && <tr><td colSpan={isAdmin ? 9 : 8} className="text-center py-12 text-zinc-400">No products. Add one or import a CSV.</td></tr>}
            {items.map((i) => (
              <tr key={i.id} className="border-b border-zinc-100 hover:bg-zinc-50">
                <td className="px-4 py-3 font-mono-data text-xs text-zinc-700">{i.sku}</td>
                <td className="px-4 py-3 font-medium text-zinc-900">{i.product_name}</td>
                <td className="px-4 py-3 text-zinc-600">{i.brand}</td>
                <td className="px-4 py-3 text-zinc-600">{i.category}</td>
                <td className="px-4 py-3 font-mono-data text-zinc-500">{i.mrp}</td>
                <td className="px-4 py-3 font-mono-data text-zinc-900">{i.selling_price}</td>
                <td className="px-4 py-3 font-mono-data"><span className={i.stock > 0 ? "text-emerald-600" : "text-rose-600"}>{i.stock}</span></td>
                <td className="px-4 py-3 text-xs text-zinc-500">{i.gst_rate}%</td>
                {isAdmin && (
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button onClick={() => openEdit(i)} className="p-1.5 hover:bg-zinc-100 text-zinc-600 rounded-sm" data-testid={`edit-inv-${i.id}`}><PencilSimple size={14} /></button>
                      <button onClick={() => remove(i)} className="p-1.5 hover:bg-rose-50 text-rose-500 rounded-sm" data-testid={`del-inv-${i.id}`}><Trash size={14} /></button>
                    </div>
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
