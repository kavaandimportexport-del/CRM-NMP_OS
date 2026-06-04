import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import http from "@/lib/api";
import { CheckCircle } from "@phosphor-icons/react";

export default function Tasks() {
  const [tasks, setTasks] = useState([]);
  const load = () => http.get("/tasks").then(({data})=>setTasks(data));
  useEffect(()=>{ load(); },[]);
  const toggle = async (t) => {
    await http.put(`/tasks/${t.id}`, { status: t.status === "Done" ? "Open" : "Done" });
    load();
  };
  return (
    <div className="p-6 lg:p-8">
      <div className="overline text-zinc-500 mb-1">Action Center</div>
      <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-6">Tasks</h1>
      <div className="bg-white border border-zinc-200 divide-y divide-zinc-100" data-testid="tasks-list">
        {tasks.length === 0 && <div className="p-12 text-center text-zinc-400 text-sm">No tasks assigned to you.</div>}
        {tasks.map((t)=>(
          <div key={t.id} className="p-4 flex items-start gap-3 hover:bg-zinc-50">
            <button onClick={()=>toggle(t)} className={`h-5 w-5 rounded-sm border flex items-center justify-center mt-0.5 ${t.status === "Done" ? "bg-emerald-500 border-emerald-500 text-white" : "border-zinc-300 hover:border-rose-400"}`}>
              {t.status === "Done" && <CheckCircle weight="fill" size={14} />}
            </button>
            <div className="flex-1">
              <div className={`text-sm font-medium ${t.status==="Done"?"line-through text-zinc-400":"text-zinc-900"}`}>{t.title}</div>
              <div className="text-xs text-zinc-500 mt-0.5">{t.task_type}{t.due_date && ` · Due ${t.due_date}`}</div>
              {t.lead_id && <Link to={`/leads/${t.lead_id}`} className="text-xs text-rose-600 hover:underline mt-1 inline-block">View Lead →</Link>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
