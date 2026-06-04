import { useEffect, useState } from "react";
import http from "@/lib/api";
import {
  Lightning, Target, MapPin, Receipt, CurrencyInr,
  TrendUp, Warning, CheckCircle
} from "@phosphor-icons/react";
import {
  PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar,
  XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";
import { useAuth } from "@/context/AuthContext";

const COLORS = ["#E11D48", "#F59E0B", "#10B981", "#3B82F6", "#8B5CF6", "#06B6D4", "#EC4899"];

const Kpi = ({ icon: Icon, label, value, accent = "rose", testid }) => (
  <div data-testid={testid} className="bg-white border border-zinc-200 p-5 hover:border-zinc-300 transition-all">
    <div className="flex items-start justify-between mb-3">
      <div className={`h-9 w-9 flex items-center justify-center bg-${accent}-50 text-${accent}-600 rounded-sm`}>
        <Icon size={20} weight="duotone" />
      </div>
    </div>
    <div className="font-mono-data text-3xl font-bold text-zinc-900 tracking-tight">{value}</div>
    <div className="overline text-zinc-500 mt-1">{label}</div>
  </div>
);

export default function Dashboard() {
  const { user } = useAuth();
  const [k, setK] = useState(null);

  useEffect(() => {
    http.get("/dashboard/kpis").then(({ data }) => setK(data)).catch(() => {});
  }, []);

  if (!k) {
    return <div className="p-8 text-zinc-500">Loading dashboard…</div>;
  }

  const statusData = Object.entries(k.status_breakdown || {}).map(([name, value]) => ({ name, value }));
  const inr = (n) => "INR " + Number(n || 0).toLocaleString("en-IN");

  return (
    <div className="p-6 lg:p-8 max-w-[1600px]">
      <div className="flex items-end justify-between mb-6">
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

      {/* KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Kpi icon={Lightning} label="Total Leads" value={k.total_leads} accent="rose" testid="kpi-total-leads" />
        <Kpi icon={Target} label="Open Leads" value={k.open_leads} accent="amber" testid="kpi-open-leads" />
        <Kpi icon={MapPin} label="GPS Verified" value={k.gps_verified} accent="emerald" testid="kpi-gps-verified" />
        <Kpi icon={Warning} label="Visit Pending" value={k.visit_pending} accent="rose" testid="kpi-visit-pending" />
        <Kpi icon={Receipt} label="Quotations" value={k.quotations_sent} accent="amber" testid="kpi-quotations" />
        <Kpi icon={CheckCircle} label="Deals Won" value={k.deals_won} accent="emerald" testid="kpi-deals-won" />
        <Kpi icon={TrendUp} label="Conversion" value={`${k.conversion_rate}%`} accent="rose" testid="kpi-conversion" />
        <Kpi icon={CurrencyInr} label="Revenue" value={inr(k.revenue)} accent="emerald" testid="kpi-revenue" />
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="bg-white border border-zinc-200 p-5 lg:col-span-2">
          <div className="overline text-zinc-500 mb-4">Lead Sources</div>
          {k.source_breakdown?.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
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
        <div className="bg-white border border-zinc-200 p-5">
          <div className="overline text-zinc-500 mb-4">Pipeline by Status</div>
          {statusData.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={statusData} dataKey="value" nameKey="name" innerRadius={48} outerRadius={88} paddingAngle={2}>
                  {statusData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 2, border: "1px solid #E4E4E7", fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : <div className="text-sm text-zinc-400 text-center py-16">No data</div>}
          <div className="mt-2 space-y-1">
            {statusData.map((s, i) => (
              <div key={s.name} className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-2 text-zinc-600">
                  <span className="h-2 w-2 rounded-sm" style={{ background: COLORS[i % COLORS.length] }} />
                  {s.name}
                </span>
                <span className="font-mono-data text-zinc-900">{s.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
