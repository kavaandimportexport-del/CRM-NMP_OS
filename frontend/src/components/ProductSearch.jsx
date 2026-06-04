import { useEffect, useState, useRef } from "react";
import http from "@/lib/api";
import { Input } from "@/components/ui/input";
import { MagnifyingGlass } from "@phosphor-icons/react";

export default function ProductSearch({ onSelect }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const tref = useRef(null);

  useEffect(() => {
    clearTimeout(tref.current);
    if (!q || q.length < 1) { setResults([]); return; }
    tref.current = setTimeout(async () => {
      try {
        const { data } = await http.get(`/inventory?search=${encodeURIComponent(q)}`);
        setResults(data.slice(0, 8));
        setOpen(true);
      } catch (_) {}
    }, 200);
    return () => clearTimeout(tref.current);
  }, [q]);

  const pick = (p) => {
    onSelect({
      sku: p.sku, product_name: p.product_name, brand: p.brand,
      unit_price: p.selling_price, gst_rate: p.gst_rate, quantity: 1, discount_pct: 0,
    });
    setQ(""); setResults([]); setOpen(false);
  };

  return (
    <div className="relative">
      <MagnifyingGlass size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
      <Input
        data-testid="product-search-input"
        placeholder="Search products by name, SKU, brand…"
        value={q}
        onChange={(e)=>setQ(e.target.value)}
        onFocus={()=>q && setOpen(true)}
        className="pl-8 rounded-sm h-9"
      />
      {open && results.length > 0 && (
        <div className="absolute z-40 left-0 right-0 top-full mt-1 bg-white border border-zinc-200 max-h-64 overflow-y-auto shadow-md">
          {results.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={()=>pick(p)}
              data-testid={`product-option-${p.sku}`}
              className="w-full text-left px-3 py-2 hover:bg-rose-50 border-b border-zinc-100 last:border-0"
            >
              <div className="text-sm font-medium text-zinc-900">{p.product_name}</div>
              <div className="text-xs text-zinc-500 flex justify-between mt-0.5">
                <span className="font-mono-data">{p.sku} · {p.brand}</span>
                <span className="font-mono-data text-rose-600">INR {p.selling_price}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
