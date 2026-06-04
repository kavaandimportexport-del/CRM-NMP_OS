import { useEffect, useState } from "react";
import http, { formatErr } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { PlayCircle, Clock, CheckCircle, Certificate, Question, XCircle } from "@phosphor-icons/react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import jsPDF from "jspdf";

const statusBadge = (s) => ({
  "Not Started": "bg-zinc-100 text-zinc-700 border-zinc-300",
  "In Progress": "bg-amber-50 text-amber-700 border-amber-200",
  "Certified": "bg-emerald-50 text-emerald-700 border-emerald-200",
  "Failed": "bg-rose-50 text-rose-700 border-rose-200",
}[s] || "bg-zinc-100 text-zinc-700 border-zinc-300");

export default function Training() {
  const { user } = useAuth();
  const [modules, setModules] = useState([]);
  const [active, setActive] = useState(null);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);

  const load = () => http.get("/training").then(({ data }) => setModules(data));
  useEffect(() => { load(); }, []);

  const startQuiz = (m) => {
    setActive(m);
    setAnswers({});
    setResult(null);
  };

  const submit = async () => {
    const answerArr = active.quiz.map((_, i) => answers[i] ?? -1);
    try {
      const { data } = await http.post(`/training/${active.id}/submit-quiz`, { answers: answerArr });
      setResult(data);
      load();
      if (data.passed) toast.success(`Certified! Score ${data.score}%`);
      else toast.error(`Score ${data.score}% — need 70% to pass`);
    } catch (e) { toast.error(formatErr(e.response?.data?.detail)); }
  };

  const downloadCert = async (m) => {
    try {
      const { data } = await http.get(`/training/${m.id}/certificate`);
      const doc = new jsPDF({ orientation: "landscape" });
      // Background
      doc.setFillColor(250, 250, 250);
      doc.rect(0, 0, 297, 210, "F");
      // Border
      doc.setDrawColor(225, 29, 72);
      doc.setLineWidth(2);
      doc.rect(10, 10, 277, 190);
      doc.setLineWidth(0.5);
      doc.rect(14, 14, 269, 182);
      // Header
      doc.setFontSize(12); doc.setTextColor(225, 29, 72);
      doc.setFont("helvetica", "bold");
      doc.text("NEW MUSIC PALACE — SALES OS", 148.5, 30, { align: "center" });
      doc.setFontSize(10); doc.setTextColor(82, 82, 91); doc.setFont("helvetica", "normal");
      doc.text("CERTIFICATE OF COMPLETION", 148.5, 38, { align: "center" });
      // Body
      doc.setFontSize(14); doc.setTextColor(82, 82, 91);
      doc.text("This is to certify that", 148.5, 70, { align: "center" });
      doc.setFontSize(36); doc.setTextColor(24, 24, 27); doc.setFont("helvetica", "bold");
      doc.text(data.user_name || "—", 148.5, 90, { align: "center" });
      doc.setFontSize(14); doc.setTextColor(82, 82, 91); doc.setFont("helvetica", "normal");
      doc.text("has successfully completed the training module", 148.5, 105, { align: "center" });
      doc.setFontSize(22); doc.setTextColor(225, 29, 72); doc.setFont("helvetica", "bold");
      doc.text(`"${data.training_title}"`, 148.5, 125, { align: "center" });
      doc.setFontSize(12); doc.setTextColor(82, 82, 91); doc.setFont("helvetica", "normal");
      doc.text(`with a score of ${data.score}%`, 148.5, 140, { align: "center" });
      // Footer
      doc.setFontSize(9); doc.setTextColor(150, 150, 150);
      doc.text(`Certificate No: ${data.certificate_number}`, 30, 180);
      doc.text(`Issue Date: ${data.issue_date}`, 247, 180, { align: "right" });
      doc.save(`Certificate_${data.training_title.replace(/\s+/g, "_")}.pdf`);
    } catch (e) { toast.error("Certificate not available"); }
  };

  return (
    <div className="p-6 lg:p-8">
      <div className="overline text-zinc-500 mb-1">Academy</div>
      <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-6">Training Modules</h1>

      <Dialog open={!!active} onOpenChange={(v) => { if (!v) { setActive(null); setResult(null); } }}>
        <DialogContent className="rounded-sm max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="quiz-modal">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Question size={20} />{active?.title}</DialogTitle>
          </DialogHeader>
          {!result ? (
            <div className="space-y-4">
              <p className="text-sm text-zinc-600">Answer all questions. Pass mark: 70%.</p>
              {active?.quiz?.map((q, i) => (
                <div key={i} className="border border-zinc-200 p-4 rounded-sm">
                  <div className="font-medium text-zinc-900 mb-3 text-sm">
                    <span className="font-mono-data text-rose-500 mr-2">{(i + 1).toString().padStart(2, "0")}</span>
                    {q.q}
                  </div>
                  <RadioGroup value={String(answers[i] ?? "")} onValueChange={(v) => setAnswers({ ...answers, [i]: parseInt(v) })}>
                    {q.options.map((opt, oi) => (
                      <div key={oi} className="flex items-center gap-2">
                        <RadioGroupItem value={String(oi)} id={`q${i}-${oi}`} data-testid={`q${i}-opt${oi}`} />
                        <Label htmlFor={`q${i}-${oi}`} className="text-sm text-zinc-700 cursor-pointer">{opt}</Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>
              ))}
              <Button onClick={submit} className="bg-rose-600 hover:bg-rose-700 rounded-sm w-full" data-testid="submit-quiz-btn">Submit Quiz</Button>
            </div>
          ) : (
            <div className="text-center py-6 space-y-3">
              {result.passed ? (
                <>
                  <CheckCircle size={64} weight="fill" className="text-emerald-500 mx-auto" />
                  <div className="font-mono-data text-4xl font-bold text-emerald-600">{result.score}%</div>
                  <div className="text-sm text-zinc-600">Certified — {result.certificate_number}</div>
                  <Button onClick={() => downloadCert(active)} className="bg-emerald-600 hover:bg-emerald-700 rounded-sm" data-testid="download-cert-btn">
                    <Certificate size={16} className="mr-2" /> Download Certificate
                  </Button>
                </>
              ) : (
                <>
                  <XCircle size={64} weight="fill" className="text-rose-500 mx-auto" />
                  <div className="font-mono-data text-4xl font-bold text-rose-600">{result.score}%</div>
                  <div className="text-sm text-zinc-600">Did not reach 70% — review the material and try again.</div>
                  <Button onClick={() => { setResult(null); setAnswers({}); }} variant="outline" className="rounded-sm">Retake</Button>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {modules.map((t) => {
          const progStatus = t.progress?.status || "Not Started";
          return (
            <div key={t.id} className="bg-white border border-zinc-200 hover:border-rose-300 transition-all" data-testid={`training-${t.id}`}>
              <div className="aspect-video bg-gradient-to-br from-zinc-900 to-zinc-700 flex items-center justify-center relative overflow-hidden">
                <PlayCircle size={56} weight="duotone" className="text-rose-500 z-10" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,#E11D48_0%,transparent_50%)] opacity-20" />
                <span className={`absolute top-2 right-2 text-[10px] px-2 py-0.5 border ${statusBadge(progStatus)} rounded-sm uppercase tracking-wider font-bold`}>
                  {progStatus}
                </span>
              </div>
              <div className="p-4">
                <div className="overline text-zinc-500 mb-1">{t.category}</div>
                <h3 className="font-bold text-zinc-900 mb-1">{t.title}</h3>
                <p className="text-sm text-zinc-600 mb-3 line-clamp-2">{t.description}</p>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-zinc-500 flex items-center gap-1"><Clock size={12} />{t.duration}</span>
                  {t.progress?.score > 0 && (
                    <span className="text-xs font-mono-data font-bold text-zinc-700">{t.progress.score}%</span>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button onClick={() => startQuiz(t)} size="sm" className="bg-rose-600 hover:bg-rose-700 rounded-sm flex-1" data-testid={`start-${t.id}`}>
                    {progStatus === "Certified" ? "Retake Quiz" : "Start Quiz"}
                  </Button>
                  {progStatus === "Certified" && (
                    <Button onClick={() => downloadCert(t)} size="sm" variant="outline" className="rounded-sm" data-testid={`cert-${t.id}`}>
                      <Certificate size={14} />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
