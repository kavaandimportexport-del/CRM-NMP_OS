import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import http from "@/lib/api";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowsLeftRight, Coins } from "@phosphor-icons/react";

const STAGES = ["New", "Contacted", "Site Visit", "Quotation", "Negotiation", "Won", "Lost"];

const stageAccent = {
  New: "bg-zinc-100 border-zinc-300 text-zinc-700",
  Contacted: "bg-blue-50 border-blue-300 text-blue-700",
  "Site Visit": "bg-amber-50 border-amber-300 text-amber-700",
  Quotation: "bg-purple-50 border-purple-300 text-purple-700",
  Negotiation: "bg-orange-50 border-orange-300 text-orange-700",
  Won: "bg-emerald-50 border-emerald-300 text-emerald-700",
  Lost: "bg-rose-50 border-rose-300 text-rose-700",
};

const inrShort = (n) => {
  const v = Number(n || 0);
  if (v >= 10000000) return `INR ${(v / 10000000).toFixed(2)}Cr`;
  if (v >= 100000) return `INR ${(v / 100000).toFixed(1)}L`;
  if (v >= 1000) return `INR ${(v / 1000).toFixed(0)}K`;
  return `INR ${v}`;
};

const priorityDot = (p) =>
  ({ Urgent: "bg-rose-500", High: "bg-amber-500", Medium: "bg-blue-500", Low: "bg-zinc-300" }[p] || "bg-zinc-300");

// Weighted value = expected_deal_value × (probability / 100). Used for forecast heat.
// Cards in non-closed columns are shaded based on (weighted / max_weighted_in_col).
const weighted = (l) => (Number(l.expected_deal_value || 0) * Number(l.probability ?? 25)) / 100;

export default function Pipeline() {
  const [data, setData] = useState(null);

  const load = () => http.get("/pipeline").then(({ data }) => setData(data));
  useEffect(() => { load(); }, []);

  const move = async (leadId, newStatus) => {
    try {
      await http.put(`/leads/${leadId}`, { status: newStatus });
      toast.success(`Moved to ${newStatus}`);
      load();
    } catch (_) { toast.error("Failed to move"); }
  };

  if (!data) return <div className="p-8 text-zinc-500">Loading pipeline…</div>;

  const totalPipeline = STAGES.filter(s => s !== "Won" && s !== "Lost").reduce((acc, s) => acc + (data[s]?.value || 0), 0);
  const totalWeighted = STAGES.filter(s => s !== "Won" && s !== "Lost").reduce(
    (acc, s) => acc + (data[s]?.leads || []).reduce((sum, l) => sum + weighted(l), 0),
    0,
  );

  return (
    <div className="p-6 lg:p-8">
      <div className="flex items-end justify-between mb-6 flex-wrap gap-4">
        <div>
          <div className="overline text-zinc-500 mb-1">Sales Pipeline</div>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">Kanban Board</h1>
          <p className="text-zinc-500 text-sm mt-1">Drag-equivalent: change status from each card.</p>
        </div>
        <div className="flex gap-3">
          <div className="bg-white border border-zinc-200 px-4 py-3" data-testid="pipeline-total">
            <div className="overline text-zinc-500 flex items-center gap-1"><Coins size={12} />Open Pipeline</div>
            <div className="font-mono-data text-2xl font-extrabold text-rose-600 mt-1">{inrShort(totalPipeline)}</div>
          </div>
          <div className="bg-zinc-900 text-white border border-zinc-900 px-4 py-3" data-testid="pipeline-weighted">
            <div className="overline text-zinc-400 flex items-center gap-1"><Coins size={12} />Weighted Forecast</div>
            <div className="font-mono-data text-2xl font-extrabold text-emerald-400 mt-1">{inrShort(totalWeighted)}</div>
            <div className="text-[10px] text-zinc-500 mt-0.5">= value × probability%</div>
          </div>
        </div>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-thin">
        {STAGES.map((stage) => {
          const col = data[stage] || { count: 0, value: 0, leads: [] };
          const isClosed = stage === "Won" || stage === "Lost";
          const maxW = isClosed ? 0 : Math.max(1, ...col.leads.map((l) => weighted(l)));
          return (
            <div key={stage} className="min-w-[280px] w-[280px] shrink-0 bg-zinc-50 border border-zinc-200" data-testid={`column-${stage.replace(/\s+/g,'-').toLowerCase()}`}>
              <div className={`px-3 py-2 border-b border-zinc-200 ${stageAccent[stage]}`}>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm">{stage}</span>
                  <span className="font-mono-data text-xs font-bold bg-white border border-current/30 px-2 py-0.5">{col.count}</span>
                </div>
                <div className="font-mono-data text-[11px] mt-0.5 opacity-80">{inrShort(col.value)}</div>
              </div>
              <div className="p-2 space-y-2 max-h-[calc(100vh-260px)] overflow-y-auto scrollbar-thin">
                {col.leads.length === 0 && (
                  <div className="text-xs text-zinc-400 text-center py-6">No leads</div>
                )}
                {col.leads.map((l) => {
                  const w = weighted(l);
                  // Heat: 0..1 of column max. Map to background tint.
                  const heat = isClosed ? 0 : (w / maxW);
                  const heatColor = heat >= 0.66
                    ? "border-l-4 border-l-emerald-500 bg-emerald-50/60"
                    : heat >= 0.33
                    ? "border-l-4 border-l-amber-400 bg-amber-50/40"
                    : heat > 0
                    ? "border-l-4 border-l-zinc-300 bg-white"
                    : "border-l-4 border-l-transparent bg-white";
                  return (
                    <div key={l.id} className={`border border-zinc-200 p-3 hover:border-rose-300 transition-all ${heatColor}`} data-testid={`pipe-card-${l.id}`}>
                      <div className="flex items-start gap-2 mb-1">
                        <span className={`w-1.5 h-1.5 rounded-full mt-1.5 ${priorityDot(l.priority)}`} />
                        <Link to={`/leads/${l.id}`} className="text-sm font-semibold text-zinc-900 hover:text-rose-600 flex-1 line-clamp-2">
                          {l.lead_name}
                        </Link>
                      </div>
                      {l.company_name && <div className="text-[11px] text-zinc-500 ml-3.5 mb-1">{l.company_name}</div>}
                      <div className="flex items-center justify-between text-[11px] ml-3.5">
                        <span className="font-mono-data text-zinc-700">{l.expected_deal_value ? inrShort(l.expected_deal_value) : "—"}</span>
                        <span className="text-zinc-400">{l.city || ""}</span>
                      </div>
                      {!isClosed && l.expected_deal_value > 0 && (
                        <div className="ml-3.5 mt-1 flex items-center justify-between text-[11px]">
                          <span className="text-zinc-500">Prob {l.probability ?? 25}%</span>
                          <span className="font-mono-data font-bold text-emerald-700">{inrShort(w)}</span>
                        </div>
                      )}
                      <Select value={stage} onValueChange={(v) => move(l.id, v)}>
                        <SelectTrigger className="h-7 mt-2 rounded-sm text-[11px] border-zinc-200 bg-white" data-testid={`move-${l.id}`}>
                          <ArrowsLeftRight size={11} className="mr-1" />
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {STAGES.map((s) => <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
