import { useEffect, useState } from "react";
import http from "@/lib/api";
import { Input } from "@/components/ui/input";
import { MagnifyingGlass, BookOpen } from "@phosphor-icons/react";

export default function Knowledge() {
  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  useEffect(()=>{ http.get("/knowledge").then(({data})=>setItems(data)); },[]);
  const filtered = items.filter(i => !q || (i.title+i.body+i.category).toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="p-6 lg:p-8">
      <div className="overline text-zinc-500 mb-1">Reference Library</div>
      <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-6">Knowledge Hub</h1>
      <div className="relative max-w-md mb-4">
        <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
        <Input placeholder="Search knowledge…" value={q} onChange={(e)=>setQ(e.target.value)} className="pl-9 rounded-sm bg-white border-zinc-300" data-testid="knowledge-search" />
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        {filtered.map((it)=>(
          <div key={it.id} className="bg-white border border-zinc-200 p-5 hover:border-zinc-300" data-testid={`knowledge-${it.id}`}>
            <div className="flex items-start gap-3">
              <div className="h-9 w-9 bg-rose-50 text-rose-600 flex items-center justify-center rounded-sm shrink-0"><BookOpen size={18} weight="duotone" /></div>
              <div>
                <div className="overline text-zinc-500 mb-1">{it.category}</div>
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
