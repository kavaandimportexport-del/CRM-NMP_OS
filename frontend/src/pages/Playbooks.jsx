import { useEffect, useState } from "react";
import http from "@/lib/api";
import { Books, CheckCircle, Question, ShoppingBag } from "@phosphor-icons/react";

export default function Playbooks() {
  const [pbs, setPbs] = useState([]);
  const [active, setActive] = useState(null);
  useEffect(()=>{ http.get("/playbooks").then(({data})=>{ setPbs(data); setActive(data[0]); }); },[]);

  return (
    <div className="p-6 lg:p-8">
      <div className="overline text-zinc-500 mb-1">Field Playbooks</div>
      <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-6">Sales Playbooks</h1>
      <div className="grid lg:grid-cols-4 gap-4">
        <div className="lg:col-span-1 bg-white border border-zinc-200">
          {pbs.map((p)=>(
            <button key={p.id} onClick={()=>setActive(p)} className={`w-full text-left px-4 py-3 border-b border-zinc-100 hover:bg-zinc-50 transition-all flex items-center gap-2 ${active?.id===p.id?"bg-zinc-900 text-white hover:bg-zinc-900":""}`} data-testid={`playbook-${p.id}`}>
              <Books size={16} />
              <span className="text-sm font-medium">{p.category}</span>
            </button>
          ))}
        </div>
        {active && (
          <div className="lg:col-span-3 space-y-4">
            <Section icon={Question} title="Discovery Questions" items={active.discovery_questions} />
            <div className="bg-white border border-zinc-200 p-5">
              <div className="overline text-zinc-500 mb-3 flex items-center gap-2"><Question size={14} />Objections &amp; Responses</div>
              <div className="space-y-3">
                {active.objections.map((o, i)=>(
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
      {items.map((it, i)=>(
        <li key={i} className="text-sm text-zinc-700 flex gap-2"><span className="text-rose-500 font-mono-data">{(i+1).toString().padStart(2,"0")}</span>{it}</li>
      ))}
    </ul>
  </div>
);
