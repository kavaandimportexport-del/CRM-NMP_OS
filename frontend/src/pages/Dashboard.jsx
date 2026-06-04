import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import http from "@/lib/api";
import {
  Lightning, Target, MapPin, Receipt, CurrencyInr,
  TrendUp, Warning, CheckCircle, ClockCountdown, Bell, Coins,
} from "@phosphor-icons/react";
import {
  PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar,
  XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";
import { useAuth } from "@/context/AuthContext";

const COLORS = ["#E11D48", "#F59E0B", "#10B981", "#3B82F6", "#8B5CF6", "#06B6D4", "#EC4899"];

const Kpi = ({ icon: Icon, label, value, accent = "rose", testid, to }) => {
  const content = (
    <div data-testid={testid} className="bg-white border border-zinc-200 p-5 hover:border-zinc-400 hover:shadow-sm transition-all h-full">
      <div className="flex items-start justify-between mb-3">
        <div className={`h-9 w-9 flex items-center justify-center bg-${accent}-50 text-${accent}-600 rounded-sm`}>
          <Icon size={20} weight="duotone" />
        </div>
      </div>
      <div className="font-mono-data text-3xl font-bold text-zinc-900 tracking-tight">{value}</div>
      <div className="overline text-zinc-500 mt-1">{label}</div>
    </div>
  );
  return to ? <Link to={to}>{content}</Link> : content;
};

const inrShort = (n) => {
  const v = Number(n || 0);
  if (v >= 10000000) return `₹${(v / 10000000).toFixed(2)}Cr`;
  if (v >= 100000) return `₹${(v / 100000).toFixed(1)}L`;
  if (v >= 1000) return `₹${(v / 1000).toFixed(0)}K`;
  return `₹${v}`;
};

export default function Dashboard() {
  const { user } = useAuth();
  const [k, setK] = useState(null);
  const [fu, setFu] = useState(null);

  useEffect(() => {
    http.get("/dashboard/kpis").then(({ data }) => setK(data)).catch(() => {});
    http.get("/follow-ups").then(({ data }) => setFu(data)).catch(() => {});
  }, []);

  if (!k) return <div className="p-8 text-zinc-500">Loading dashboard…</div>;

  const statusData = Object.entries(k.status_breakdown || {}).map(([name, value]) => ({ name, value }));

  return (
    <div className="p-6 lg:p-8 max-w-[1600px]">
      <div className="flex items-end justify-between mb-6 flex-wrap gap-4">
        <div>
          <div className="overline text-zinc-500 mb-1">Operations Console</div>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-zinc-900">
            Welcome, {user?.name?.split(" ")[0]}.
          </h1>
          <p className="text-zinc-500 text-sm mt-1">Live snapshot of your sales pipeline.</p>
        </div>
        <div className="hidden md:flex items-center gap-2 text-xs text-zinc-500">
          <span className="led-dot text-emerald-500" />
          <span>System Online</span>
        </div>
      </div>

      {/* Headline row */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-4">
        <Kpi icon={Coins} label="Open Pipeline" value={inrShort(k.pipeline_value)} accent="rose" testid="kpi-pipeline-value" to="/pipeline" />
        <Kpi icon={CurrencyInr} label="Won Revenue" value={inrShort(k.revenue)} accent="emerald" testid="kpi-revenue" />
        <Kpi icon={TrendUp} label="Quote Approval" value={`${k.quotation_approval_rate || 0}%`} accent="emerald" testid="kpi-approval-rate" />
        <Kpi icon={Bell} label="Today's Follow-ups" value={k.today_follow_ups || 0} accent="amber" testid="kpi-today-followups" />
        <Kpi icon={ClockCountdown} label="Overdue" value={k.overdue_follow_ups || 0} accent="rose" testid="kpi-overdue-followups" />
      </div>

      {/* Pipeline KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Kpi icon={Lightning} label="Total Leads" value={k.total_leads} accent="rose" testid="kpi-total-leads" to="/leads" />
        <Kpi icon={Target} label="Open Leads" value={k.open_leads} accent="amber" testid="kpi-open-leads" />
        <Kpi icon={MapPin} label="GPS Verified" value={k.gps_verified} accent="emerald" testid="kpi-gps-verified" />
        <Kpi icon={Warning} label="Visit Pending" value={k.visit_pending} accent="rose" testid="kpi-visit-pending" />
        <Kpi icon={Receipt} label="Quotations" value={k.quotations_sent} accent="amber" testid="kpi-quotations" />
        <Kpi icon={CheckCircle} label="Deals Won" value={k.deals_won} accent="emerald" testid="kpi-deals-won" />
        <Kpi icon={TrendUp} label="Conversion" value={`${k.conversion_rate}%`} accent="rose" testid="kpi-conversion" />
        <Kpi icon={Warning} label="Deals Lost" value={k.deals_lost} accent="rose" testid="kpi-deals-lost" />
      </div>

      {/* Follow-ups + Charts */}
      <div className="grid lg:grid-cols-3 gap-4 mb-4">
        <div className="bg-white border border-zinc-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="overline text-zinc-500 flex items-center gap-2"><Bell size={12} />Today's Follow-ups</div>
            <Link to="/leads" className="text-xs text-rose-600 hover:underline">View all →</Link>
          </div>
          {fu?.today?.length ? (
            <div className="divide-y divide-zinc-100">
              {fu.today.slice(0, 5).map((l) => (
                <Link key={l.id} to={`/leads/${l.id}`} className="block py-2 hover:bg-zinc-50 -mx-2 px-2" data-testid={`today-fu-${l.id}`}>
                  <div className="text-sm font-medium text-zinc-900">{l.lead_name}</div>
                  <div className="text-xs text-zinc-500 flex justify-between mt-0.5">
                    <span>{l.company_name || "—"}</span>
                    <span className="text-amber-600">{l.follow_up_type || "Call"}</span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-sm text-zinc-400 text-center py-8">No follow-ups today.</div>
          )}
        </div>

        <div className="bg-white border border-zinc-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="overline text-rose-600 flex items-center gap-2"><ClockCountdown size={12} />Overdue Follow-ups</div>
            <Link to="/leads" className="text-xs text-rose-600 hover:underline">View all →</Link>
          </div>
          {fu?.overdue?.length ? (
            <div className="divide-y divide-zinc-100">
              {fu.overdue.slice(0, 5).map((l) => (
                <Link key={l.id} to={`/leads/${l.id}`} className="block py-2 hover:bg-zinc-50 -mx-2 px-2" data-testid={`overdue-fu-${l.id}`}>
                  <div className="text-sm font-medium text-zinc-900">{l.lead_name}</div>
                  <div className="text-xs text-zinc-500 flex justify-between mt-0.5">
                    <span>{l.company_name || "—"}</span>
                    <span className="text-rose-600">{(l.next_follow_up || "").slice(0, 10)}</span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-sm text-emerald-600 text-center py-8">All caught up.</div>
          )}
        </div>

        <div className="bg-white border border-zinc-200 p-5">
          <div className="overline text-zinc-500 mb-3">Pipeline by Status</div>
          {statusData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={statusData} dataKey="value" nameKey="name" innerRadius={40} outerRadius={75} paddingAngle={2}>
                  {statusData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 2, border: "1px solid #E4E4E7", fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : <div className="text-sm text-zinc-400 text-center py-12">No data</div>}
        </div>
      </div>

      <div className="bg-white border border-zinc-200 p-5">
        <div className="overline text-zinc-500 mb-4">Lead Sources</div>
        {k.source_breakdown?.length > 0 ? (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={k.source_breakdown}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E4E4E7" vertical={false} />
              <XAxis dataKey="source" tick={{ fontSize: 11 }} stroke="#71717A" />
              <YAxis tick={{ fontSize: 11 }} stroke="#71717A" />
              <Tooltip cursor={{ fill: "#FAFAFA" }} contentStyle={{ borderRadius: 2, border: "1px solid #E4E4E7", fontSize: 12 }} />
              <Bar dataKey="count" fill="#E11D48" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : <div className="text-sm text-zinc-400 text-center py-16">No leads yet</div>}
      </div>
    </div>
  );
}
