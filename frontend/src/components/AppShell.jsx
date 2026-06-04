import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import {
  House, Lightning, Users, Package, GraduationCap,
  BookOpen, ChartBar, SignOut, Headphones, ClipboardText, Books
} from "@phosphor-icons/react";

const nav = [
  { to: "/", label: "Dashboard", icon: House, testid: "nav-dashboard" },
  { to: "/leads", label: "Leads", icon: Lightning, testid: "nav-leads" },
  { to: "/tasks", label: "Tasks", icon: ClipboardText, testid: "nav-tasks" },
  { to: "/inventory", label: "Inventory", icon: Package, testid: "nav-inventory" },
  { to: "/employees", label: "Employees", icon: Users, testid: "nav-employees" },
  { to: "/playbooks", label: "Playbooks", icon: Books, testid: "nav-playbooks" },
  { to: "/training", label: "Training", icon: GraduationCap, testid: "nav-training" },
  { to: "/knowledge", label: "Knowledge", icon: BookOpen, testid: "nav-knowledge" },
  { to: "/reports", label: "Reports", icon: ChartBar, testid: "nav-reports" },
];

export default function AppShell({ children }) {
  const { user, logout } = useAuth();
  const nav2 = useNavigate();

  const handleLogout = async () => {
    await logout();
    nav2("/login");
  };

  return (
    <div className="flex h-screen overflow-hidden bg-zinc-100">
      <aside className="w-60 shrink-0 bg-zinc-950 text-zinc-100 flex flex-col" data-testid="app-sidebar">
        <div className="px-5 py-5 border-b border-zinc-800 flex items-center gap-2">
          <div className="h-9 w-9 bg-rose-600 flex items-center justify-center rounded-sm">
            <Headphones size={20} weight="fill" className="text-white" />
          </div>
          <div>
            <div className="font-mono-data text-[10px] tracking-[0.2em] text-zinc-500">NMP</div>
            <div className="font-bold tracking-tight text-sm">SALES OS</div>
          </div>
        </div>
        <nav className="flex-1 py-3 overflow-y-auto scrollbar-thin">
          <div className="px-5 py-2 overline text-zinc-600">Operations</div>
          {nav.map(({ to, label, icon: Icon, testid }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              data-testid={testid}
              className={({ isActive }) =>
                `flex items-center gap-3 px-5 py-2.5 text-sm transition-all duration-150 ${
                  isActive
                    ? "bg-zinc-800 text-white border-l-2 border-rose-500"
                    : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100 border-l-2 border-transparent"
                }`
              }
            >
              <Icon size={18} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-zinc-800 p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-9 w-9 rounded-sm bg-zinc-800 flex items-center justify-center text-sm font-bold">
              {user?.name?.[0]?.toUpperCase() || "U"}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-medium truncate">{user?.name}</div>
              <div className="text-[10px] text-zinc-500 uppercase tracking-wider">{user?.role?.replace("_", " ")}</div>
            </div>
          </div>
          <button
            data-testid="logout-btn"
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 text-xs text-zinc-400 hover:text-rose-400 py-2 border border-zinc-800 hover:border-rose-900 rounded-sm transition-all"
          >
            <SignOut size={14} /> Sign out
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto scrollbar-thin">
        {children}
      </main>
    </div>
  );
}
