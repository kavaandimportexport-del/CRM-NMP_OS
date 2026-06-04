import { useEffect, useState } from "react";
import http, { formatErr } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  PlayCircle, Clock, CheckCircle, Certificate, Question, XCircle,
  Plus, PencilSimple, Trash, VideoCamera, Wrench, GraduationCap,
} from "@phosphor-icons/react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import jsPDF from "jspdf";

const VIDEO_TYPES = ["Training Video", "Product Demo", "SOP Video"];
const TYPE_ICON = { "Training Video": GraduationCap, "Product Demo": VideoCamera, "SOP Video": Wrench };
const TYPE_ACCENT = {
  "Training Video": "text-rose-600 bg-rose-50 border-rose-200",
  "Product Demo": "text-blue-600 bg-blue-50 border-blue-200",
  "SOP Video": "text-amber-600 bg-amber-50 border-amber-200",
};
const CATEGORIES = ["Sales", "Product", "Technical", "Compliance", "Company"];

const statusBadge = (s) => ({
  "Not Started": "bg-zinc-100 text-zinc-700 border-zinc-300",
  "In Progress": "bg-amber-50 text-amber-700 border-amber-200",
  "Certified": "bg-emerald-50 text-emerald-700 border-emerald-200",
  "Failed": "bg-rose-50 text-rose-700 border-rose-200",
}[s] || "bg-zinc-100 text-zinc-700 border-zinc-300");

const emptyForm = {
  title: "", category: "Sales", duration: "", description: "",
  video_url: "", video_type: "Training Video",
  quiz: [{ q: "", options: ["", "", "", ""], answer: 0 }],
};

// Convert YouTube/Vimeo share URL to embed URL
const toEmbed = (url = "") => {
  if (!url) return "";
  // YouTube watch?v=XXX
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]+)/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
  // Vimeo /<id>
  const vm = url.match(/vimeo\.com\/(\d+)/);
  if (vm) return `https://player.vimeo.com/video/${vm[1]}`;
  return url;
};

export default function Training() {
  const { user } = useAuth();
  const isAdmin = ["super_admin", "admin"].includes(user?.role);
  const [modules, setModules] = useState([]);
  const [filter, setFilter] = useState("all");
  const [watching, setWatching] = useState(null);
  const [quizActive, setQuizActive] = useState(null);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const load = () => http.get("/training").then(({ data }) => setModules(data));
  useEffect(() => { load(); }, []);

  const filtered = filter === "all" ? modules : modules.filter((m) => m.video_type === filter);

  const watch = async (m) => {
    setWatching(m);
    try { await http.post(`/training/${m.id}/mark-watched`); load(); } catch (_) {}
  };

  const startQuiz = (m) => {
    setQuizActive(m); setAnswers({}); setResult(null); setWatching(null);
  };

  const submit = async () => {
    const arr = quizActive.quiz.map((_, i) => answers[i] ?? -1);
    try {
      const { data } = await http.post(`/training/${quizActive.id}/submit-quiz`, { answers: arr });
      setResult(data); load();
      if (data.passed) toast.success(`Certified! Score ${data.score}%`);
      else toast.error(`Score ${data.score}% — need 70%`);
    } catch (e) { toast.error(formatErr(e.response?.data?.detail)); }
  };

  const downloadCert = async (m) => {
    try {
      const { data } = await http.get(`/training/${m.id}/certificate`);
      const doc = new jsPDF({ orientation: "landscape" });
      doc.setFillColor(250, 250, 250); doc.rect(0, 0, 297, 210, "F");
      doc.setDrawColor(225, 29, 72); doc.setLineWidth(2); doc.rect(10, 10, 277, 190);
      doc.setLineWidth(0.5); doc.rect(14, 14, 269, 182);
      doc.setFontSize(12); doc.setTextColor(225, 29, 72); doc.setFont("helvetica", "bold");
      doc.text("NEW MUSIC PALACE — SALES OS", 148.5, 30, { align: "center" });
      doc.setFontSize(10); doc.setTextColor(82, 82, 91); doc.setFont("helvetica", "normal");
      doc.text("CERTIFICATE OF COMPLETION", 148.5, 38, { align: "center" });
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
      doc.setFontSize(9); doc.setTextColor(150, 150, 150);
      doc.text(`Certificate No: ${data.certificate_number}`, 30, 180);
      doc.text(`Issue Date: ${data.issue_date}`, 247, 180, { align: "right" });
      doc.save(`Certificate_${data.training_title.replace(/\s+/g, "_")}.pdf`);
    } catch (e) { toast.error("Certificate not available"); }
  };

  const openNew = () => { setEditing(null); setForm(emptyForm); setEditorOpen(true); };
  const openEdit = (m) => {
    setEditing(m);
    setForm({
      title: m.title, category: m.category, duration: m.duration || "",
      description: m.description || "", video_url: m.video_url || "",
      video_type: m.video_type || "Training Video",
      quiz: m.quiz?.length ? m.quiz : [{ q: "", options: ["", "", "", ""], answer: 0 }],
    });
    setEditorOpen(true);
  };

  const saveModule = async () => {
    if (!form.title.trim()) return toast.error("Title required");
    const cleanQuiz = form.quiz
      .filter((q) => q.q?.trim() && q.options.filter((o) => o?.trim()).length >= 2)
      .map((q) => ({
        q: q.q,
        options: q.options.filter((o) => o?.trim()),
        answer: Math.min(q.answer, q.options.filter((o) => o?.trim()).length - 1),
      }));
    const payload = { ...form, video_url: toEmbed(form.video_url), quiz: cleanQuiz };
    try {
      if (editing) await http.put(`/training/${editing.id}`, payload);
      else await http.post("/training", payload);
      toast.success("Saved");
      setEditorOpen(false); setEditing(null); setForm(emptyForm);
      load();
    } catch (e) { toast.error(formatErr(e.response?.data?.detail)); }
  };

  const removeModule = async (m) => {
    if (!window.confirm(`Delete "${m.title}"?`)) return;
    try { await http.delete(`/training/${m.id}`); load(); toast.success("Deleted"); }
    catch (e) { toast.error(formatErr(e.response?.data?.detail)); }
  };

  const addQ = () => setForm({ ...form, quiz: [...form.quiz, { q: "", options: ["", "", "", ""], answer: 0 }] });
  const updateQ = (i, key, val) => {
    const q = [...form.quiz]; q[i] = { ...q[i], [key]: val }; setForm({ ...form, quiz: q });
  };
  const updateOpt = (i, oi, val) => {
    const q = [...form.quiz]; const opts = [...q[i].options]; opts[oi] = val; q[i] = { ...q[i], options: opts }; setForm({ ...form, quiz: q });
  };
  const removeQ = (i) => setForm({ ...form, quiz: form.quiz.filter((_, idx) => idx !== i) });

  return (
    <div className="p-6 lg:p-8">
      <div className="flex items-end justify-between mb-6 flex-wrap gap-3">
        <div>
          <div className="overline text-zinc-500 mb-1">Academy</div>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">Training & Certification</h1>
          <p className="text-zinc-500 text-sm mt-1">Training videos, product demos & SOP videos with on-completion certification.</p>
        </div>
        {isAdmin && (
          <Button onClick={openNew} className="bg-rose-600 hover:bg-rose-700 rounded-sm" data-testid="new-training-btn">
            <Plus size={16} className="mr-1" />Add Training
          </Button>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-6 flex-wrap" data-testid="training-filters">
        {[
          { v: "all", l: "All", count: modules.length },
          ...VIDEO_TYPES.map((v) => ({ v, l: v, count: modules.filter((m) => m.video_type === v).length })),
        ].map((f) => (
          <button
            key={f.v}
            onClick={() => setFilter(f.v)}
            data-testid={`filter-${f.v.replace(/\s+/g, '-').toLowerCase()}`}
            className={`px-4 py-2 text-sm rounded-sm border transition-all ${
              filter === f.v
                ? "bg-zinc-900 text-white border-zinc-900"
                : "bg-white text-zinc-700 border-zinc-200 hover:border-zinc-400"
            }`}
          >
            {f.l} <span className="font-mono-data ml-1 opacity-60">{f.count}</span>
          </button>
        ))}
      </div>

      {/* Module grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.length === 0 && (
          <div className="col-span-full bg-white border border-zinc-200 p-12 text-center text-zinc-400 text-sm">
            No training modules in this category.
          </div>
        )}
        {filtered.map((t) => {
          const Icon = TYPE_ICON[t.video_type] || GraduationCap;
          const progStatus = t.progress?.status || "Not Started";
          return (
            <div key={t.id} className="bg-white border border-zinc-200 hover:border-rose-300 transition-all group" data-testid={`training-${t.id}`}>
              <div className="aspect-video bg-gradient-to-br from-zinc-900 to-zinc-700 flex items-center justify-center relative overflow-hidden cursor-pointer" onClick={() => watch(t)}>
                <PlayCircle size={56} weight="duotone" className="text-rose-500 z-10" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,#E11D48_0%,transparent_50%)] opacity-20" />
                <span className={`absolute top-2 left-2 text-[10px] px-2 py-0.5 border ${TYPE_ACCENT[t.video_type] || ""} rounded-sm uppercase tracking-wider font-bold inline-flex items-center gap-1`}>
                  <Icon size={10} weight="fill" />{t.video_type}
                </span>
                <span className={`absolute top-2 right-2 text-[10px] px-2 py-0.5 border ${statusBadge(progStatus)} rounded-sm uppercase tracking-wider font-bold`}>
                  {progStatus}
                </span>
                {isAdmin && (
                  <div className="absolute bottom-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                    <button onClick={(e) => { e.stopPropagation(); openEdit(t); }} className="p-1.5 bg-white/90 hover:bg-white text-zinc-700 rounded-sm" data-testid={`edit-t-${t.id}`}><PencilSimple size={12} /></button>
                    <button onClick={(e) => { e.stopPropagation(); removeModule(t); }} className="p-1.5 bg-white/90 hover:bg-rose-50 text-rose-600 rounded-sm" data-testid={`del-t-${t.id}`}><Trash size={12} /></button>
                  </div>
                )}
              </div>
              <div className="p-4">
                <div className="overline text-zinc-500 mb-1">{t.category}</div>
                <h3 className="font-bold text-zinc-900 mb-1">{t.title}</h3>
                <p className="text-sm text-zinc-600 mb-3 line-clamp-2">{t.description}</p>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs text-zinc-500 flex items-center gap-1"><Clock size={12} />{t.duration || "—"}</span>
                  {t.progress?.score > 0 && (
                    <span className="text-xs font-mono-data font-bold text-zinc-700">{t.progress.score}%</span>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button onClick={() => watch(t)} size="sm" variant="outline" className="rounded-sm flex-1" data-testid={`watch-${t.id}`}>
                    <PlayCircle size={14} className="mr-1" />Watch
                  </Button>
                  {t.quiz?.length > 0 && (
                    <Button onClick={() => startQuiz(t)} size="sm" className="bg-rose-600 hover:bg-rose-700 rounded-sm flex-1" data-testid={`quiz-${t.id}`}>
                      {progStatus === "Certified" ? "Retake" : "Quiz"}
                    </Button>
                  )}
                  {progStatus === "Certified" && (
                    <Button onClick={() => downloadCert(t)} size="sm" variant="outline" className="rounded-sm border-emerald-300 text-emerald-600 hover:bg-emerald-50" data-testid={`cert-${t.id}`} title="Download Certificate">
                      <Certificate size={14} />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Watch video modal */}
      <Dialog open={!!watching} onOpenChange={(v) => !v && setWatching(null)}>
        <DialogContent className="rounded-sm max-w-4xl">
          <DialogHeader><DialogTitle>{watching?.title}</DialogTitle></DialogHeader>
          {watching?.video_url ? (
            <div className="aspect-video bg-black">
              <iframe src={toEmbed(watching.video_url)} title={watching.title} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen className="w-full h-full" data-testid="video-player" />
            </div>
          ) : (
            <div className="aspect-video bg-zinc-100 flex items-center justify-center text-zinc-400 text-sm">
              No video URL set. Admin can add one via Edit.
            </div>
          )}
          <p className="text-sm text-zinc-600">{watching?.description}</p>
          {watching?.quiz?.length > 0 && (
            <Button onClick={() => startQuiz(watching)} className="bg-rose-600 hover:bg-rose-700 rounded-sm" data-testid="post-watch-quiz">
              Take Quiz to Get Certified
            </Button>
          )}
        </DialogContent>
      </Dialog>

      {/* Quiz modal */}
      <Dialog open={!!quizActive} onOpenChange={(v) => { if (!v) { setQuizActive(null); setResult(null); } }}>
        <DialogContent className="rounded-sm max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="quiz-modal">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Question size={20} />{quizActive?.title}</DialogTitle>
          </DialogHeader>
          {!result ? (
            <div className="space-y-4">
              <p className="text-sm text-zinc-600">Answer all questions. Pass mark: 70%.</p>
              {quizActive?.quiz?.map((q, i) => (
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
                  <Button onClick={() => downloadCert(quizActive)} className="bg-emerald-600 hover:bg-emerald-700 rounded-sm" data-testid="download-cert-btn">
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

      {/* Admin editor */}
      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="rounded-sm max-w-3xl max-h-[92vh] overflow-y-auto" data-testid="training-editor">
          <DialogHeader><DialogTitle>{editing ? "Edit Training" : "Add Training"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid md:grid-cols-2 gap-3">
              <div>
                <Label className="text-[11px] uppercase tracking-wider text-zinc-600 mb-1 block">Title *</Label>
                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="rounded-sm" data-testid="t-title-input" />
              </div>
              <div>
                <Label className="text-[11px] uppercase tracking-wider text-zinc-600 mb-1 block">Video Type</Label>
                <Select value={form.video_type} onValueChange={(v) => setForm({ ...form, video_type: v })}>
                  <SelectTrigger className="rounded-sm" data-testid="t-type-select"><SelectValue /></SelectTrigger>
                  <SelectContent>{VIDEO_TYPES.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[11px] uppercase tracking-wider text-zinc-600 mb-1 block">Category</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger className="rounded-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[11px] uppercase tracking-wider text-zinc-600 mb-1 block">Duration (e.g. 15 min)</Label>
                <Input value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })} className="rounded-sm" />
              </div>
            </div>
            <div>
              <Label className="text-[11px] uppercase tracking-wider text-zinc-600 mb-1 block">Description</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} className="rounded-sm" />
            </div>
            <div>
              <Label className="text-[11px] uppercase tracking-wider text-zinc-600 mb-1 block">Video URL (YouTube / Vimeo / direct mp4)</Label>
              <Input value={form.video_url} onChange={(e) => setForm({ ...form, video_url: e.target.value })} className="rounded-sm font-mono-data text-xs" placeholder="https://www.youtube.com/watch?v=…" data-testid="t-video-url" />
            </div>

            <div className="border-t border-zinc-200 pt-3">
              <div className="flex justify-between items-center mb-2">
                <div className="overline text-zinc-500">Quiz Questions (for certification)</div>
                <Button onClick={addQ} variant="outline" size="sm" className="rounded-sm h-7 text-xs" data-testid="add-question-btn">
                  <Plus size={12} className="mr-1" />Add Question
                </Button>
              </div>
              <div className="space-y-3">
                {form.quiz.map((q, i) => (
                  <div key={i} className="border border-zinc-200 p-3 rounded-sm bg-zinc-50">
                    <div className="flex items-start justify-between mb-2 gap-2">
                      <span className="font-mono-data text-xs text-rose-500">Q{i + 1}</span>
                      {form.quiz.length > 1 && (
                        <button onClick={() => removeQ(i)} className="text-rose-500 text-xs hover:text-rose-700" data-testid={`rm-q-${i}`}>Remove</button>
                      )}
                    </div>
                    <Input value={q.q} onChange={(e) => updateQ(i, "q", e.target.value)} placeholder="Question text" className="rounded-sm mb-2" data-testid={`q-text-${i}`} />
                    <div className="grid grid-cols-2 gap-2">
                      {q.options.map((opt, oi) => (
                        <div key={oi} className="flex items-center gap-2">
                          <input type="radio" name={`ans-${i}`} checked={q.answer === oi} onChange={() => updateQ(i, "answer", oi)} className="accent-rose-600" data-testid={`q-ans-${i}-${oi}`} />
                          <Input value={opt} onChange={(e) => updateOpt(i, oi, e.target.value)} placeholder={`Option ${oi + 1}`} className="rounded-sm h-8 text-sm" />
                        </div>
                      ))}
                    </div>
                    <p className="text-[10px] text-zinc-500 mt-1.5">Radio = correct answer. Leave option blank to skip.</p>
                  </div>
                ))}
              </div>
            </div>

            <Button onClick={saveModule} className="bg-rose-600 hover:bg-rose-700 rounded-sm w-full" data-testid="save-training-btn">
              {editing ? "Update Training" : "Create Training"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
