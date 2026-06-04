import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  House, Lightning, Users, Package, GraduationCap,
  ChartBar, SignOut, Headphones, ClipboardText, Kanban,
  Key, Gear, UserCircle, CaretUp,
} from "@phosphor-icons/react";
import { useState } from "react";
import http, { formatErr } from "@/lib/api";
import { toast } from "sonner";

const ALL_NAV = [
  { to: "/", label: "Dashboard", icon: House, testid: "nav-dashboard", roles: "*" },
  { to: "/leads", label: "Leads", icon: Lightning, testid: "nav-leads", roles: "*" },
  { to: "/pipeline", label: "Pipeline", icon: Kanban, testid: "nav-pipeline", roles: "*" },
  { to: "/tasks", label: "Tasks", icon: ClipboardText, testid: "nav-tasks", roles: "*" },
  { to: "/inventory", label: "Inventory", icon: Package, testid: "nav-inventory", roles: "*" },
  { to: "/employees", label: "Employees", icon: Users, testid: "nav-employees", roles: ["super_admin"] },
  { to: "/training", label: "Training", icon: GraduationCap, testid: "nav-training", roles: "*" },
  { to: "/reports", label: "Reports", icon: ChartBar, testid: "nav-reports", roles: ["super_admin"] },
];

export default function AppShell({ children }) {
  const { user, logout } = useAuth();
  const nav2 = useNavigate();
  const [pwOpen, setPwOpen] = useState(false);
  const [pwForm, setPwForm] = useState({ old: "", new1: "", new2: "" });

  const visibleNav = ALL_NAV.filter((n) => n.roles === "*" || n.roles.includes(user?.role));

  const handleLogout = async () => {
    await logout();
    nav2("/login");
  };

  const submitPw = async () => {
    if (pwForm.new1 !== pwForm.new2) return toast.error("New passwords do not match");
    if (pwForm.new1.length < 6) return toast.error("Min 6 characters");
    try {
      await http.post("/auth/change-password", { old_password: pwForm.old, new_password: pwForm.new1 });
      toast.success("Password changed. Please sign in again.");
      setPwOpen(false); setPwForm({ old: "", new1: "", new2: "" });
      await logout(); nav2("/login");
    } catch (e) { toast.error(formatErr(e.response?.data?.detail)); }
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
          {visibleNav.map(({ to, label, icon: Icon, testid }) => (
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

        {/* Profile dropdown */}
        <div className="border-t border-zinc-800 p-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button data-testid="profile-trigger" className="w-full flex items-center gap-3 p-2 hover:bg-zinc-900 rounded-sm transition-all">
                <div className="h-9 w-9 rounded-sm bg-rose-600/20 text-rose-400 flex items-center justify-center text-sm font-bold">
                  {user?.name?.[0]?.toUpperCase() || "U"}
                </div>
                <div className="min-w-0 flex-1 text-left">
                  <div className="text-sm font-medium truncate text-zinc-100">{user?.name}</div>
                  <div className="text-[10px] text-zinc-500 uppercase tracking-wider">{user?.role?.replace("_", " ")}</div>
                </div>
                <CaretUp size={14} className="text-zinc-500" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="start" className="w-[210px] rounded-sm">
              <div className="px-3 py-2 border-b border-zinc-100">
                <div className="text-xs font-semibold text-zinc-900 truncate">{user?.name}</div>
                <div className="text-[10px] text-zinc-500 truncate">{user?.email}</div>
              </div>
              <DropdownMenuItem data-testid="profile-info" className="text-xs">
                <UserCircle size={14} className="mr-2" />My Profile
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setPwOpen(true)} data-testid="change-password-btn" className="text-xs">
                <Key size={14} className="mr-2" />Change Password
              </DropdownMenuItem>
              <DropdownMenuItem className="text-xs" disabled>
                <Gear size={14} className="mr-2" />Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} data-testid="logout-btn" className="text-xs text-rose-600">
                <SignOut size={14} className="mr-2" />Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      <Dialog open={pwOpen} onOpenChange={setPwOpen}>
        <DialogContent className="rounded-sm max-w-md" data-testid="change-password-modal">
          <DialogHeader><DialogTitle>Change Password</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-[11px] uppercase tracking-wider text-zinc-600 mb-1 block">Current Password</Label>
              <Input type="password" value={pwForm.old} onChange={(e) => setPwForm({ ...pwForm, old: e.target.value })} className="rounded-sm" data-testid="cp-old-input" />
            </div>
            <div>
              <Label className="text-[11px] uppercase tracking-wider text-zinc-600 mb-1 block">New Password</Label>
              <Input type="password" value={pwForm.new1} onChange={(e) => setPwForm({ ...pwForm, new1: e.target.value })} className="rounded-sm" data-testid="cp-new1-input" />
            </div>
            <div>
              <Label className="text-[11px] uppercase tracking-wider text-zinc-600 mb-1 block">Confirm New Password</Label>
              <Input type="password" value={pwForm.new2} onChange={(e) => setPwForm({ ...pwForm, new2: e.target.value })} className="rounded-sm" data-testid="cp-new2-input" />
            </div>
            <Button onClick={submitPw} className="bg-rose-600 hover:bg-rose-700 rounded-sm w-full" data-testid="cp-submit-btn">Change &amp; Sign Out</Button>
          </div>
        </DialogContent>
      </Dialog>

      <main className="flex-1 overflow-y-auto scrollbar-thin">
        {children}
      </main>
    </div>
  );
}
