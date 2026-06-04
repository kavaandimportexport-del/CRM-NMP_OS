import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider } from "@/context/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import AppShell from "@/components/AppShell";
import Login from "@/pages/Login";
import InviteAccept from "@/pages/InviteAccept";
import Dashboard from "@/pages/Dashboard";
import Leads from "@/pages/Leads";
import LeadDetail from "@/pages/LeadDetail";
import Pipeline from "@/pages/Pipeline";
import Tasks from "@/pages/Tasks";
import Inventory from "@/pages/Inventory";
import Employees from "@/pages/Employees";
import Playbooks from "@/pages/Playbooks";
import Training from "@/pages/Training";
import Knowledge from "@/pages/Knowledge";
import Reports from "@/pages/Reports";

const Shell = ({ children }) => (
  <ProtectedRoute><AppShell>{children}</AppShell></ProtectedRoute>
);

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Toaster position="top-right" richColors />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/invite/:token" element={<InviteAccept />} />
          <Route path="/" element={<Shell><Dashboard /></Shell>} />
          <Route path="/leads" element={<Shell><Leads /></Shell>} />
          <Route path="/leads/:id" element={<Shell><LeadDetail /></Shell>} />
          <Route path="/pipeline" element={<Shell><Pipeline /></Shell>} />
          <Route path="/tasks" element={<Shell><Tasks /></Shell>} />
          <Route path="/inventory" element={<Shell><Inventory /></Shell>} />
          <Route path="/employees" element={<Shell><Employees /></Shell>} />
          <Route path="/playbooks" element={<Shell><Playbooks /></Shell>} />
          <Route path="/training" element={<Shell><Training /></Shell>} />
          <Route path="/knowledge" element={<Shell><Knowledge /></Shell>} />
          <Route path="/reports" element={<Shell><Reports /></Shell>} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
