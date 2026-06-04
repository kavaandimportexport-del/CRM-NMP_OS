import { useEffect, useRef, useState } from "react";
import http, { formatErr } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { NavigationArrow, CheckCircle, ArrowsClockwise, X } from "@phosphor-icons/react";
import { toast } from "sonner";

// Haversine
const distanceKm = (lat1, lon1, lat2, lon2) => {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

export default function GpsCheckInOut({ leadId, onDone }) {
  const [visits, setVisits] = useState([]);
  const [openVisit, setOpenVisit] = useState(null);
  const [busy, setBusy] = useState(false);
  const [notes, setNotes] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [summary, setSummary] = useState("");
  const canvasRef = useRef(null);

  const load = () => http.get(`/gps/visits?lead_id=${leadId}`).then(({ data }) => {
    setVisits(data);
    const open = data.find((v) => v.status === "Open");
    setOpenVisit(open || null);
  });
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [leadId]);

  const checkIn = () => {
    if (!navigator.geolocation) return toast.error("GPS not supported");
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          await http.post("/gps/check-in", {
            lead_id: leadId, gps_lat: pos.coords.latitude, gps_lng: pos.coords.longitude,
            gps_accuracy: pos.coords.accuracy, notes,
          });
          toast.success("Checked in");
          setNotes(""); load(); onDone && onDone();
        } catch (e) { toast.error(formatErr(e.response?.data?.detail)); }
        finally { setBusy(false); }
      },
      (err) => { toast.error("GPS denied: " + err.message); setBusy(false); },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const checkOut = () => {
    if (!navigator.geolocation) return toast.error("GPS not supported");
    const sig = canvasRef.current;
    const hasSig = sig && hasInk(sig);
    if (!customerName.trim()) return toast.error("Customer name required");
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const km = distanceKm(openVisit.gps_lat, openVisit.gps_lng, pos.coords.latitude, pos.coords.longitude);
          const mins = (Date.now() - new Date(openVisit.check_in_at).getTime()) / 60000;
          await http.post("/gps/check-out", {
            check_in_id: openVisit.id,
            gps_lat: pos.coords.latitude, gps_lng: pos.coords.longitude,
            distance_km: parseFloat(km.toFixed(2)),
            duration_minutes: parseFloat(mins.toFixed(1)),
            signature_data: hasSig ? sig.toDataURL("image/png") : "",
            customer_name: customerName, summary,
          });
          toast.success("Checked out");
          setCustomerName(""); setSummary(""); clearSig(); load(); onDone && onDone();
        } catch (e) { toast.error(formatErr(e.response?.data?.detail)); }
        finally { setBusy(false); }
      },
      (err) => { toast.error("GPS denied: " + err.message); setBusy(false); },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const clearSig = () => {
    const c = canvasRef.current; if (!c) return;
    c.getContext("2d").clearRect(0, 0, c.width, c.height);
  };

  const hasInk = (c) => {
    const ctx = c.getContext("2d");
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    for (let i = 3; i < d.length; i += 4) if (d[i] !== 0) return true;
    return false;
  };

  // Signature canvas drawing
  useEffect(() => {
    const c = canvasRef.current; if (!c) return;
    const ctx = c.getContext("2d");
    ctx.strokeStyle = "#18181B"; ctx.lineWidth = 2; ctx.lineCap = "round"; ctx.lineJoin = "round";
    let drawing = false;
    const pos = (e) => {
      const r = c.getBoundingClientRect();
      const t = e.touches ? e.touches[0] : e;
      return { x: t.clientX - r.left, y: t.clientY - r.top };
    };
    const start = (e) => { drawing = true; const p = pos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); e.preventDefault(); };
    const draw = (e) => { if (!drawing) return; const p = pos(e); ctx.lineTo(p.x, p.y); ctx.stroke(); e.preventDefault(); };
    const end = () => { drawing = false; };
    c.addEventListener("mousedown", start); c.addEventListener("mousemove", draw); window.addEventListener("mouseup", end);
    c.addEventListener("touchstart", start); c.addEventListener("touchmove", draw); window.addEventListener("touchend", end);
    return () => {
      c.removeEventListener("mousedown", start); c.removeEventListener("mousemove", draw); window.removeEventListener("mouseup", end);
      c.removeEventListener("touchstart", start); c.removeEventListener("touchmove", draw); window.removeEventListener("touchend", end);
    };
  }, [openVisit]);

  const API = process.env.REACT_APP_BACKEND_URL + "/api";

  return (
    <div className="space-y-4">
      <div className="bg-white border border-zinc-200 p-5">
        <div className="overline text-zinc-500 mb-3 flex items-center gap-2">
          <NavigationArrow size={14} weight="fill" />Field Check-in / Check-out
        </div>

        {!openVisit ? (
          <div className="space-y-3">
            <Label className="text-[11px] uppercase tracking-wider text-zinc-600 mb-1 block">Visit Notes (optional)</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="rounded-sm" placeholder="Why are you visiting?" data-testid="checkin-notes" />
            <Button onClick={checkIn} disabled={busy} className="bg-rose-600 hover:bg-rose-700 rounded-sm w-full" data-testid="check-in-btn">
              <NavigationArrow size={16} className="mr-2" />{busy ? "Capturing GPS…" : "Check In Now"}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="bg-amber-50 border border-amber-200 p-3 text-sm">
              <div className="flex items-center gap-2 text-amber-700 font-semibold">
                <ArrowsClockwise size={14} className="animate-spin" />Visit in progress
              </div>
              <div className="text-xs text-amber-900 mt-1 font-mono-data">
                Checked in at {new Date(openVisit.check_in_at).toLocaleTimeString()} · {openVisit.gps_lat.toFixed(5)}, {openVisit.gps_lng.toFixed(5)}
              </div>
            </div>
            <div>
              <Label className="text-[11px] uppercase tracking-wider text-zinc-600 mb-1 block">Customer Name (signing) *</Label>
              <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} className="rounded-sm" data-testid="customer-name-input" />
            </div>
            <div>
              <Label className="text-[11px] uppercase tracking-wider text-zinc-600 mb-1 block">Visit Summary</Label>
              <Textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={2} className="rounded-sm" placeholder="What was discussed / agreed?" />
            </div>
            <div>
              <Label className="text-[11px] uppercase tracking-wider text-zinc-600 mb-1 block flex items-center justify-between">
                <span>Customer Signature</span>
                <button onClick={clearSig} className="text-xs text-rose-600 hover:underline normal-case tracking-normal flex items-center gap-1" data-testid="clear-sig-btn">
                  <X size={12} />Clear
                </button>
              </Label>
              <canvas ref={canvasRef} width={500} height={140} className="border border-zinc-300 bg-white rounded-sm w-full touch-none" data-testid="signature-canvas" />
              <div className="text-[10px] text-zinc-500 mt-1">Customer signs above — click & drag (or touch on mobile).</div>
            </div>
            <Button onClick={checkOut} disabled={busy} className="bg-emerald-600 hover:bg-emerald-700 rounded-sm w-full" data-testid="check-out-btn">
              <CheckCircle size={16} className="mr-2" />{busy ? "Closing visit…" : "Check Out & Close Visit"}
            </Button>
          </div>
        )}
      </div>

      {visits.length > 0 && (
        <div className="bg-white border border-zinc-200">
          <div className="px-5 py-3 border-b border-zinc-200">
            <div className="overline text-zinc-500">Past Visits ({visits.length})</div>
          </div>
          <div className="divide-y divide-zinc-100">
            {visits.map((v) => (
              <div key={v.id} className="p-4 hover:bg-zinc-50">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 border rounded-sm uppercase tracking-wider font-bold ${v.status === "Closed" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200"}`}>{v.status}</span>
                    <span className="text-sm font-medium text-zinc-900">{v.user_name}</span>
                  </div>
                  {v.distance_km > 0 && <span className="font-mono-data text-xs text-zinc-700">{v.distance_km} km</span>}
                </div>
                <div className="text-xs text-zinc-500 font-mono-data">
                  In: {new Date(v.check_in_at).toLocaleString()}
                  {v.check_out_at && ` · Out: ${new Date(v.check_out_at).toLocaleString()}`}
                  {v.duration_minutes > 0 && ` · ${Math.round(v.duration_minutes)} min`}
                </div>
                {v.customer_name && <div className="text-xs text-zinc-700 mt-1">Signed by: <b>{v.customer_name}</b></div>}
                {v.summary && <div className="text-xs text-zinc-600 mt-1">{v.summary}</div>}
                <div className="flex gap-3 mt-1">
                  <a href={`https://www.google.com/maps?q=${v.gps_lat},${v.gps_lng}`} target="_blank" rel="noreferrer" className="text-xs text-rose-600 hover:underline">View map →</a>
                  {v.signature_data && <a href={v.signature_data} target="_blank" rel="noreferrer" className="text-xs text-rose-600 hover:underline">View signature →</a>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
