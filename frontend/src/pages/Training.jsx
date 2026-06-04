import { useEffect, useState } from "react";
import http from "@/lib/api";
import { PlayCircle, Clock } from "@phosphor-icons/react";

export default function Training() {
  const [m, setM] = useState([]);
  useEffect(()=>{ http.get("/training").then(({data})=>setM(data)); },[]);
  return (
    <div className="p-6 lg:p-8">
      <div className="overline text-zinc-500 mb-1">Academy</div>
      <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-6">Training Modules</h1>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {m.map((t)=>(
          <div key={t.id} className="bg-white border border-zinc-200 hover:border-rose-300 transition-all" data-testid={`training-${t.id}`}>
            <div className="aspect-video bg-gradient-to-br from-zinc-900 to-zinc-700 flex items-center justify-center relative overflow-hidden">
              <PlayCircle size={56} weight="duotone" className="text-rose-500 z-10" />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,#E11D48_0%,transparent_50%)] opacity-20" />
            </div>
            <div className="p-4">
              <div className="overline text-zinc-500 mb-1">{t.category}</div>
              <h3 className="font-bold text-zinc-900 mb-1">{t.title}</h3>
              <p className="text-sm text-zinc-600 mb-3">{t.description}</p>
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-500 flex items-center gap-1"><Clock size={12} />{t.duration}</span>
                <button className="text-xs text-rose-600 font-semibold hover:text-rose-800">Start →</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
