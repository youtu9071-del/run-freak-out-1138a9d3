import { Home, Swords, Users, Gift, User } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

const navItems = [
  { icon: Home, label: "Accueil", path: "/" },
  { icon: Swords, label: "Défis", path: "/challenges" },
  { icon: Users, label: "Social", path: "/social" },
  { icon: Gift, label: "Récompenses", path: "/rewards" },
  { icon: User, label: "Profil", path: "/profile" },
];

export default function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!user) return;
    const fetchUnread = async () => {
      const { count } = await supabase
        .from("notifications" as any)
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("read", false);
      setUnread(count || 0);
    };
    fetchUnread();
    const ch = supabase
      .channel("bottomnav_notifs")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        () => fetchUnread()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user]);

  // Reset when user is on Profil
  useEffect(() => {
    if (location.pathname === "/profile" && unread > 0) {
      // Visual reset only; NotificationsBell handles marking as read on open
    }
  }, [location.pathname, unread]);

  return (
    <nav className="fixed bottom-3 left-3 right-3 z-50 safe-area-bottom">
      <div className="glass-strong rounded-2xl shadow-premium max-w-lg mx-auto">
        <div className="flex items-center justify-around h-16 px-1">
          {navItems.map(({ icon: Icon, label, path }) => {
            const active = location.pathname === path;
            const isProfile = path === "/profile";
            return (
              <button
                key={path}
                onClick={() => navigate(path)}
                className="relative flex flex-col items-center justify-center gap-1 flex-1 py-2 transition-colors"
              >
                {active && (
                  <motion.div
                    layoutId="nav-indicator"
                    className="absolute inset-x-2 inset-y-1 rounded-xl bg-primary/12 border border-primary/25"
                    transition={{ type: "spring", stiffness: 400, damping: 32 }}
                  />
                )}
                <div className="relative z-10">
                  <Icon
                    className={`w-5 h-5 transition-all ${
                      active ? "text-primary scale-110" : "text-muted-foreground"
                    }`}
                    style={active ? { filter: "drop-shadow(0 0 6px hsl(var(--primary) / 0.6))" } : undefined}
                  />
                  {isProfile && unread > 0 && (
                    <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-accent text-accent-foreground text-[9px] font-black flex items-center justify-center accent-glow ring-2 ring-background">
                      {unread > 9 ? "9+" : unread}
                    </span>
                  )}
                </div>
                <span
                  className={`text-[9px] font-bold tracking-wider uppercase transition-colors z-10 ${
                    active ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  {label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
