import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Swords, Check, X, Clock, Calendar } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatDistanceToNow, format } from "date-fns";
import { fr } from "date-fns/locale";

interface Invite {
  id: string;
  challenger_id: string;
  challenged_id: string;
  distance_km: number;
  status: string;
  created_at: string;
  expires_at: string;
  scheduled_date?: string | null;
  challenger_profile?: { username: string; avatar_url: string | null };
}

export default function ChallengeInvites() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    fetchInvites();

    // Realtime: listen to new invites for this user
    const channel = supabase
      .channel("challenge_invites_realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "challenge_invites", filter: `challenged_id=eq.${user.id}` },
        () => fetchInvites()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const fetchInvites = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("challenge_invites")
      .select("*")
      .eq("challenged_id", user.id)
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (data) {
      const now = new Date();
      const valid = data.filter((inv) => new Date(inv.expires_at) > now);

      // Mark expired in background (no answer after 3 days → disappears)
      const expired = data.filter((inv) => new Date(inv.expires_at) <= now);
      if (expired.length > 0) {
        for (const inv of expired) {
          await supabase.from("challenge_invites").update({ status: "expired" as any }).eq("id", inv.id);
        }
      }

      const challengerIds = valid.map((i) => i.challenger_id);
      if (challengerIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, username, avatar_url")
          .in("user_id", challengerIds);

        const enriched = valid.map((inv) => ({
          ...inv,
          challenger_profile: profiles?.find((p) => p.user_id === inv.challenger_id),
        }));
        setInvites(enriched as Invite[]);
      } else {
        setInvites([]);
      }
    }
    setLoading(false);
  };

  const handleRespond = async (invite: Invite, accept: boolean) => {
    const status = accept ? "accepted" : "refused";
    const { error } = await supabase
      .from("challenge_invites")
      .update({ status: status as any, responded_at: new Date().toISOString() })
      .eq("id", invite.id);

    if (error) {
      toast.error("Erreur");
      return;
    }

    setInvites((prev) => prev.filter((i) => i.id !== invite.id));

    if (accept) {
      toast.success("Défi accepté ! La course commence 🔥");
      setTimeout(() => navigate("/activity"), 600);
    } else {
      toast.success("Défi refusé");
    }
  };

  if (loading || invites.length === 0) return null;

  return (
    <div className="mb-6">
      <h3 className="font-display font-bold text-sm text-muted-foreground mb-3 flex items-center gap-2">
        <Swords className="w-4 h-4 text-accent" /> DÉFIS REÇUS ({invites.length})
      </h3>
      <AnimatePresence>
        {invites.map((invite) => (
          <motion.div
            key={invite.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, x: -100 }}
            className="rounded-2xl bg-card border border-accent/30 p-4 mb-3 accent-glow"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center overflow-hidden">
                {invite.challenger_profile?.avatar_url ? (
                  <img src={invite.challenger_profile.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="font-display font-bold text-sm">
                    {(invite.challenger_profile?.username || "?")[0]}
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-display font-bold text-sm truncate">
                  {invite.challenger_profile?.username || "Inconnu"} te défie !
                </p>
                <p className="text-xs text-muted-foreground">{invite.distance_km} km</p>
                {invite.scheduled_date && (
                  <p className="text-xs text-primary flex items-center gap-1 mt-0.5">
                    <Calendar className="w-3 h-3" />
                    {format(new Date(invite.scheduled_date), "d MMM yyyy 'à' HH:mm", { locale: fr })}
                  </p>
                )}
                <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                  <Clock className="w-3 h-3" />
                  Expire {formatDistanceToNow(new Date(invite.expires_at), { locale: fr, addSuffix: true })}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleRespond(invite, true)}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl gradient-primary py-2.5 text-sm font-bold text-primary-foreground neon-glow"
              >
                <Check className="w-4 h-4" /> Accepter
              </button>
              <button
                onClick={() => handleRespond(invite, false)}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-secondary py-2.5 text-sm font-bold text-secondary-foreground"
              >
                <X className="w-4 h-4" /> Refuser
              </button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
