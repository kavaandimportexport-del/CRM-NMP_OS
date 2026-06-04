import { useEffect, useState } from "react";
import http from "@/lib/api";
import { Button } from "@/components/ui/button";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { useAuth } from "@/context/AuthContext";
import { FileXls, Download } from "@phosphor-icons/react";
import { toast } from "sonner";

const COLORS = ["#E11D48", "#F59E0B", "#10B981", "#3B82F6", "#8B5CF6"];

export default function Reports() {
  const { user } = useAuth();
  const [k, setK] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { http.get("/dashboard/kpis").then(({ data }) => setK(data)); }, []);

  const exportExcel = async () => {
    setBusy(true);
    try {
      const res = await http.get("/export/excel", { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.download = `NMP_SalesOS_Export_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success("Excel export downloaded");
    } catch (e) { toast.error("Export failed"); }
    finally { setBusy(false); }
  };

  const exportCSV = (filename, headers, rows) => {
    const csv = [headers.join(","), ...rows.map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url; link.download = filename;
    link.click(); URL.revokeObjectURL(url);
  };

  if (!k) return <div className="p-8 text-zinc-500">Loading…</div>;

  const status = Object.entries(k.status_breakdown || {}).map(([name, value]) => ({ name, value }));

  return (
    <div className="p-6 lg:p-8">
      <div className="flex justify-between items-end mb-6 flex-wrap gap-4">
        <div>
          <div className="overline text-zinc-500 mb-1">Analytics &amp; Data</div>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">Reports</h1>
          <p className="text-zinc-500 text-sm mt-1">Performance snapshot &amp; data backup tools.</p>
        </div>
        {user?.role === "super_admin" && (
          <div className="flex gap-2">
            <Button
              onClick={() => exportCSV("leads.csv", ["Source", "Count"], (k.source_breakdown || []).map(s => [s.source, s.count]))}
              variant="outline" className="rounded-sm" data-testid="export-csv-btn"
            >
              <Download size={16} className="mr-1" />Sources CSV
            </Button>
            <Button onClick={exportExcel} disabled={busy} className="bg-emerald-600 hover:bg-emerald-700 rounded-sm" data-testid="export-excel-btn">
              <FileXls size={16} className="mr-1" />{busy ? "Exporting…" : "Export Full Backup (Excel)"}
            </Button>
          </div>
        )}
      </div>

      <div className="grid md:grid-cols-4 gap-4 mb-6">
        {[
          ["Total Leads", k.total_leads],
          ["GPS Verified", k.gps_verified],
          ["Quotations", k.quotations_sent],
          ["Conversion %", k.conversion_rate],
          ["Pipeline Value (Open)", `INR ${Math.round(k.pipeline_value || 0).toLocaleString("en-IN")}`],
          ["Won Revenue", `INR ${Math.round(k.revenue || 0).toLocaleString("en-IN")}`],
          ["Approval Rate", `${k.quotation_approval_rate || 0}%`],
          ["Overdue Follow-ups", k.overdue_follow_ups || 0],
        ].map(([l, v]) => (
          <div key={l} className="bg-white border border-zinc-200 p-5">
            <div className="overline text-zinc-500">{l}</div>
            <div className="font-mono-data text-2xl font-bold mt-2 truncate">{v}</div>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-white border border-zinc-200 p-5">
          <div className="overline text-zinc-500 mb-3">Lead Sources</div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={k.source_breakdown || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E4E4E7" vertical={false} />
              <XAxis dataKey="source" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Bar dataKey="count" fill="#E11D48" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-white border border-zinc-200 p-5">
          <div className="overline text-zinc-500 mb-3">Pipeline Status</div>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={status} dataKey="value" nameKey="name" innerRadius={50} outerRadius={100}>
                {status.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {user?.role === "super_admin" && (
        <div className="mt-6 bg-zinc-900 text-zinc-100 p-5 border border-zinc-800">
          <div className="overline text-rose-400 mb-2">Data Backup Notice</div>
          <p className="text-sm text-zinc-300">
            The <b>Export Full Backup (Excel)</b> button downloads a multi-sheet workbook containing all Leads, Quotations, Inventory, Employees, Tasks, and GPS Visits.
            Run this weekly and store the file securely offsite — it's your safety net if anything ever goes wrong with the database.
          </p>
        </div>
      )}
    </div>
  );
}
