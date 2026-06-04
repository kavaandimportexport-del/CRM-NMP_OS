import { useEffect, useState } from "react";
import http from "@/lib/api";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

const COLORS = ["#E11D48", "#F59E0B", "#10B981", "#3B82F6", "#8B5CF6"];

export default function Reports() {
  const [k, setK] = useState(null);
  useEffect(()=>{ http.get("/dashboard/kpis").then(({data})=>setK(data)); },[]);
  if (!k) return <div className="p-8 text-zinc-500">Loading…</div>;

  const status = Object.entries(k.status_breakdown||{}).map(([name,value])=>({name,value}));

  return (
    <div className="p-6 lg:p-8">
      <div className="overline text-zinc-500 mb-1">Analytics</div>
      <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-6">Reports</h1>

      <div className="grid md:grid-cols-4 gap-4 mb-6">
        {[
          ["Total Leads", k.total_leads],
          ["GPS Verified", k.gps_verified],
          ["Quotations", k.quotations_sent],
          ["Conversion %", k.conversion_rate],
        ].map(([l,v])=>(
          <div key={l} className="bg-white border border-zinc-200 p-5">
            <div className="overline text-zinc-500">{l}</div>
            <div className="font-mono-data text-3xl font-bold mt-2">{v}</div>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-white border border-zinc-200 p-5">
          <div className="overline text-zinc-500 mb-3">Lead Sources</div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={k.source_breakdown||[]}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E4E4E7" vertical={false} />
              <XAxis dataKey="source" tick={{fontSize:10}} />
              <YAxis tick={{fontSize:10}} />
              <Tooltip />
              <Bar dataKey="count" fill="#E11D48" radius={[2,2,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-white border border-zinc-200 p-5">
          <div className="overline text-zinc-500 mb-3">Pipeline Status</div>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={status} dataKey="value" nameKey="name" innerRadius={50} outerRadius={100}>
                {status.map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
