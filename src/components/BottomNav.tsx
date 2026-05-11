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
    <nav className="fixed bottom-0 left-0 right-0 z-50 glass border-t border-border safe-area-bottom">
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto px-1">
        {navItems.map(({ icon: Icon, label, path }) => {
          const active = location.pathname === path;
          const isProfile = path === "/profile";
          return (
            <button
              key={path}
              onClick={() => navigate(path)}
              className="relative flex flex-col items-center justify-center gap-0.5 flex-1 py-2 transition-colors"
            >
              {active && (
                <motion.div
                  layoutId="nav-indicator"
                  className="absolute -top-0.5 w-8 h-0.5 rounded-full gradient-primary"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
              <div className="relative">
                <Icon className={`w-5 h-5 transition-colors ${active ? "text-primary" : "text-muted-foreground"}`} />
                {isProfile && unread > 0 && (
                  <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-accent text-accent-foreground text-[9px] font-black flex items-center justify-center accent-glow">
                    {unread > 9 ? "9+" : unread}
                  </span>
                )}
              </div>
              <span className={`text-[10px] font-medium transition-colors ${active ? "text-primary" : "text-muted-foreground"}`}>
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
