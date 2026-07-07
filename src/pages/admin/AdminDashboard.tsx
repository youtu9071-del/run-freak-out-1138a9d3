import { useAdmin } from "@/hooks/useAdmin";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Shield, Calendar, ShoppingBag, Users, LogOut, QrCode, Swords, Handshake, Ticket } from "lucide-react";
import AdminEvents from "./AdminEvents";
import AdminProducts from "./AdminProducts";
import AdminUsers from "./AdminUsers";
import AdminQRScanner from "./AdminQRScanner";
import AdminChallenges from "./AdminChallenges";
import AdminPartners from "./AdminPartners";
import AdminTickets from "./AdminTickets";

export default function AdminDashboard() {
  const { isAdmin, loading } = useAdmin();
  const { user, loading: authLoading, signOut } = useAuth();

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-12 h-12 rounded-full border-4 border-muted border-t-primary animate-spin" />
      </div>
    );
  }
  if (!user || !isAdmin) return <Navigate to="/" replace />;

  const tabs = [
    { v: "events", i: Calendar, l: "Événements", c: <AdminEvents /> },
    { v: "products", i: ShoppingBag, l: "Produits", c: <AdminProducts /> },
    { v: "challenges", i: Swords, l: "Défis", c: <AdminChallenges /> },
    { v: "tickets", i: Ticket, l: "Tickets", c: <AdminTickets /> },
    { v: "scanner", i: QrCode, l: "Scanner", c: <AdminQRScanner /> },
    { v: "partners", i: Handshake, l: "Partenaires", c: <AdminPartners /> },
    { v: "users", i: Users, l: "Utilisateurs", c: <AdminUsers /> },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border px-4 md:px-6 py-3 flex items-center justify-between sticky top-0 z-30 bg-background/95 backdrop-blur">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl gradient-primary flex items-center justify-center">
            <Shield className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-display font-black text-lg leading-tight">Admin</h1>
            <p className="text-[10px] text-muted-foreground leading-tight">FREAK OUT Control Panel</p>
          </div>
        </div>
        <button onClick={signOut} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
          <LogOut className="w-4 h-4" /> Déconnexion
        </button>
      </header>

      <div className="max-w-6xl mx-auto p-4 md:p-6">
        <Tabs defaultValue="events">
          <div className="overflow-x-auto -mx-4 md:mx-0 px-4 md:px-0 mb-6">
            <TabsList className="inline-flex md:grid md:grid-cols-7 w-max md:w-full gap-1">
              {tabs.map((t) => (
                <TabsTrigger key={t.v} value={t.v} className="flex items-center gap-1.5 whitespace-nowrap">
                  <t.i className="w-4 h-4" />
                  <span className="hidden sm:inline">{t.l}</span>
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
          {tabs.map((t) => (<TabsContent key={t.v} value={t.v}>{t.c}</TabsContent>))}
        </Tabs>
      </div>
    </div>
  );
}
