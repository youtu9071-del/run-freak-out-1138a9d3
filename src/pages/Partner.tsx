import { Navigate } from "react-router-dom";
import { useAdmin } from "@/hooks/useAdmin";
import { useAuth } from "@/contexts/AuthContext";
import AdminQRScanner from "./admin/AdminQRScanner";
import { Button } from "@/components/ui/button";
import { LogOut, ScanLine } from "lucide-react";

export default function Partner() {
  const { user, signOut, loading: al } = useAuth();
  const { isPartner, isAdmin, loading } = useAdmin();

  if (al || loading) {
    return <div className="min-h-screen flex items-center justify-center"><div className="w-10 h-10 rounded-full border-4 border-muted border-t-primary animate-spin" /></div>;
  }
  if (!user) return <Navigate to="/" replace />;
  if (!isPartner && !isAdmin) return <Navigate to="/" replace />;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ScanLine className="w-5 h-5 text-primary" />
          <h1 className="font-display font-bold">Partenaire</h1>
        </div>
        <button onClick={signOut} className="flex items-center gap-1 text-xs text-muted-foreground">
          <LogOut className="w-4 h-4" /> Sortir
        </button>
      </header>
      <div className="p-4">
        <AdminQRScanner />
      </div>
    </div>
  );
}
