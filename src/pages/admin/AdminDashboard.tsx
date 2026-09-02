import { useEffect, useMemo, useState } from "react";
import { useAdmin } from "@/hooks/useAdmin";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield, Calendar, ShoppingBag, Users, LogOut, QrCode, Swords, Handshake, Ticket,
  LayoutDashboard, LifeBuoy, MessagesSquare, Settings, UserCog, Menu, X, Receipt, PanelLeftClose, PanelLeftOpen,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import AdminEvents from "./AdminEvents";
import AdminProducts from "./AdminProducts";
import AdminUsers from "./AdminUsers";
import AdminQRScanner from "./AdminQRScanner";
import AdminChallenges from "./AdminChallenges";
import AdminPartners from "./AdminPartners";
import AdminTickets from "./AdminTickets";
import AdminSupport from "./AdminSupport";
import AdminOverview from "./AdminOverview";
import AdminOrders from "./AdminOrders";

type Page = {
  v: string;
  l: string;
  sub: string;
  i: any;
  c: JSX.Element;
  badge?: "support" | "tickets" | "orders";
};

const GROUPS: { title: string; pages: Page[] }[] = [
  {
    title: "Gestion",
    pages: [
      { v: "overview", l: "Tableau de bord", sub: "Vue d'ensemble de FREAK OUT", i: LayoutDashboard, c: <AdminOverview /> },
      { v: "users", l: "Utilisateurs", sub: "Comptes, stats et rôles", i: Users, c: <AdminUsers /> },
      { v: "partners", l: "Partenaires", sub: "Gère les partenaires scanneurs", i: Handshake, c: <AdminPartners /> },
    ],
  },
  {
    title: "Animation",
    pages: [
      { v: "events", l: "Événements", sub: "Crée et pilote les événements", i: Calendar, c: <AdminEvents /> },
      { v: "challenges", l: "Défis", sub: "Duels et défis d'équipe", i: Swords, c: <AdminChallenges /> },
    ],
  },
  {
    title: "Market",
    pages: [
      { v: "products", l: "Produits", sub: "Catalogue et stocks", i: ShoppingBag, c: <AdminProducts /> },
      { v: "orders", l: "Commandes / achats", sub: "Historique des achats", i: Receipt, c: <AdminOrders />, badge: "orders" },
    ],
  },
  {
    title: "Tickets",
    pages: [
      { v: "tickets", l: "Tickets", sub: "QR codes de récompense", i: Ticket, c: <AdminTickets />, badge: "tickets" },
      { v: "scanner", l: "Scanner", sub: "Valide un QR code", i: QrCode, c: <AdminQRScanner /> },
    ],
  },
  {
    title: "Support",
    pages: [
      { v: "support", l: "Demandes de support", sub: "Toutes les demandes utilisateurs", i: LifeBuoy, c: <AdminSupport />, badge: "support" },
      { v: "conversations", l: "Conversations", sub: "Échanges avec les utilisateurs", i: MessagesSquare, c: <AdminSupport /> },
    ],
  },
  {
    title: "Gestion de la saison",
    pages: [
      { v: "season", l: "Réinitialiser la saison", sub: "Nouvelle saison, progression remise à zéro", i: RotateCcw, c: <AdminSeason /> },
    ],
  },
  {
    title: "Administration",
    pages: [
      { v: "settings", l: "Paramètres", sub: "Réglages de la plateforme", i: Settings, c: <AdminSettings /> },
      { v: "admins", l: "Gestion admin", sub: "Attribution des rôles", i: UserCog, c: <AdminUsers /> },
    ],
  },
];

function AdminSettings() {
  return (
    <div className="rounded-2xl bg-card border border-border p-6 space-y-3">
      <h3 className="font-display font-bold">Paramètres FREAK OUT</h3>
      <ul className="text-sm text-muted-foreground space-y-2">
        <li>• Attribution des Freak Points : 10 km = 5 FP (distance GPS validée uniquement)</li>
        <li>• Création d'équipe : réservée aux rangs GUERRIER DES PAVÉS III et plus</li>
        <li>• Événements terminés : archivés automatiquement après 48 h</li>
        <li>• QR codes : usage unique, validation atomique côté serveur</li>
      </ul>
    </div>
  );
}

export default function AdminDashboard() {
  const { isAdmin, loading } = useAdmin();
  const { user, loading: authLoading, signOut } = useAuth();
  const [active, setActive] = useState("overview");
  const [menuOpen, setMenuOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem("fo_admin_sidebar") === "1");

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      localStorage.setItem("fo_admin_sidebar", c ? "0" : "1");
      return !c;
    });
  };
  const [counts, setCounts] = useState<{ support: number; tickets: number; orders: number }>({
    support: 0, tickets: 0, orders: 0,
  });

  useEffect(() => {
    if (!isAdmin) return;
    (async () => {
      const since = new Date(Date.now() - 7 * 864e5).toISOString();
      const [sup, tick, ord] = await Promise.all([
        supabase.from("support_tickets").select("*", { count: "exact", head: true }).neq("status", "resolved"),
        supabase.from("purchase_qrcodes").select("*", { count: "exact", head: true }).eq("status", "active"),
        supabase.from("orders").select("*", { count: "exact", head: true }).gte("created_at", since),
      ]);
      setCounts({ support: sup.count || 0, tickets: tick.count || 0, orders: ord.count || 0 });
    })();
  }, [isAdmin]);

  const current = useMemo(
    () => GROUPS.flatMap((g) => g.pages).find((p) => p.v === active) ?? GROUPS[0].pages[0],
    [active]
  );

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-12 h-12 rounded-full border-4 border-muted border-t-primary animate-spin" />
      </div>
    );
  }
  if (!user || !isAdmin) return <Navigate to="/" replace />;

  const renderNav = (mini: boolean) => (
    <nav className="flex flex-col gap-5 p-3">
      {GROUPS.map((g) => (
        <div key={g.title}>
          <AnimatePresence initial={false}>
            {!mini && (
              <motion.p
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="px-3 mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground overflow-hidden"
              >
                {g.title}
              </motion.p>
            )}
          </AnimatePresence>
          <div className="space-y-1">
            {g.pages.map((p) => {
              const on = p.v === active;
              const badge = p.badge ? counts[p.badge] : 0;
              return (
                <button
                  key={p.v}
                  title={p.l}
                  onClick={() => { setActive(p.v); setMenuOpen(false); }}
                  className={`w-full flex items-center gap-3 ${mini ? "justify-center px-0" : "px-3"} py-2.5 rounded-xl text-sm transition-all duration-200 ${
                    on
                      ? "bg-primary/15 text-primary font-semibold border border-primary/30"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/40 border border-transparent"
                  }`}
                >
                  <span className="relative shrink-0">
                    <p.i className="w-4 h-4" />
                    {mini && badge > 0 && (
                      <span className="absolute -top-1.5 -right-1.5 w-2 h-2 rounded-full bg-accent" />
                    )}
                  </span>
                  {!mini && (
                    <>
                      <span className="truncate">{p.l}</span>
                      {badge > 0 && (
                        <span className="ml-auto min-w-5 h-5 px-1.5 rounded-full bg-accent text-accent-foreground text-[10px] font-bold flex items-center justify-center">
                          {badge}
                        </span>
                      )}
                    </>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen bg-background text-foreground flex">
      {/* Sidebar desktop */}
      <motion.aside
        initial={false}
        animate={{ width: collapsed ? 76 : 256 }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        className="hidden lg:flex shrink-0 flex-col border-r border-border sticky top-0 h-screen overflow-y-auto overflow-x-hidden"
      >
        <div className={`flex items-center gap-2 py-4 border-b border-border ${collapsed ? "justify-center px-2" : "px-4"}`}>
          <div className="w-9 h-9 rounded-xl gradient-primary flex items-center justify-center shrink-0">
            <Shield className="w-5 h-5 text-primary-foreground" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="font-display font-black leading-tight truncate">Admin</p>
              <p className="text-[10px] text-muted-foreground leading-tight truncate">FREAK OUT Control</p>
            </div>
          )}
        </div>
        {renderNav(collapsed)}
        <button
          onClick={signOut}
          title="Déconnexion"
          className={`mt-auto m-3 flex items-center gap-2 py-2.5 rounded-xl text-sm text-muted-foreground hover:text-destructive transition-colors ${collapsed ? "justify-center" : "px-3"}`}
        >
          <LogOut className="w-4 h-4 shrink-0" /> {!collapsed && "Déconnexion"}
        </button>
      </motion.aside>

      {/* Drawer mobile */}
      <AnimatePresence>
        {menuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setMenuOpen(false)}
              className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 lg:hidden"
            />
            <motion.aside
              initial={{ x: -300 }} animate={{ x: 0 }} exit={{ x: -300 }}
              transition={{ type: "spring", damping: 26, stiffness: 260 }}
              drag="x"
              dragConstraints={{ left: -300, right: 0 }}
              dragElastic={0.08}
              onDragEnd={(_, info) => { if (info.offset.x < -80) setMenuOpen(false); }}
              className="fixed left-0 top-0 bottom-0 w-[85vw] max-w-xs bg-card border-r border-border z-50 overflow-y-auto lg:hidden"
            >
              <div className="flex items-center justify-between px-4 py-4 border-b border-border">
                <p className="font-display font-black">Admin</p>
                <button onClick={() => setMenuOpen(false)}><X className="w-5 h-5" /></button>
              </div>
              {renderNav(false)}
              <button
                onClick={signOut}
                className="m-4 flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm text-muted-foreground"
              >
                <LogOut className="w-4 h-4" /> Déconnexion
              </button>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Contenu */}
      <div className="flex-1 min-w-0">
        <header className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border px-4 md:px-8 py-4 flex items-center gap-3">
          <button onClick={() => setMenuOpen(true)} className="lg:hidden w-9 h-9 rounded-xl border border-border flex items-center justify-center">
            <Menu className="w-5 h-5" />
          </button>
          <button
            onClick={toggleCollapsed}
            title={collapsed ? "Déplier le menu" : "Replier le menu"}
            className="hidden lg:flex w-9 h-9 rounded-xl border border-border items-center justify-center hover:bg-muted/40 transition-colors"
          >
            {collapsed ? <PanelLeftOpen className="w-5 h-5" /> : <PanelLeftClose className="w-5 h-5" />}
          </button>
          <div className="min-w-0">
            <h1 className="font-display font-black text-lg md:text-2xl leading-tight truncate">{current.l}</h1>
            <p className="text-xs text-muted-foreground leading-tight truncate">{current.sub}</p>
          </div>
          <button onClick={signOut} className="ml-auto lg:hidden text-xs text-muted-foreground flex items-center gap-1">
            <LogOut className="w-4 h-4" />
          </button>
        </header>

        <main className="p-4 md:p-8 max-w-6xl">
          <motion.div key={active} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            {current.c}
          </motion.div>
        </main>
      </div>
    </div>
  );
}
