import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Swords, Check, X, Clock } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

interface Invite {
  id: string;
  challenger_id: string;
  challenged_id: string;
  distance_km: number;
  status: string;
  created_at: string;
  expires_at: string;
  challenger_profile?: { username: string; avatar_url: string | null };
}

export default function ChallengeInvites() {
  const { user } = useAuth();
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) fetchInvites();
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
      // Filter out expired invites and enrich with profiles
      const now = new Date();
      const valid = data.filter((inv) => new Date(inv.expires_at) > now);

      // Expire old ones in background
      const expired = data.filter((inv) => new Date(inv.expires_at) <= now);
      if (expired.length > 0) {
        for (const inv of expired) {
          await supabase.from("challenge_invites").update({ status: "expired" as any }).eq("id", inv.id);
        }
      }

      // Fetch challenger profiles
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
        setInvites(enriched);
      } else {
        setInvites([]);
      }
    }
    setLoading(false);
  };

  const handleRespond = async (inviteId: string, accept: boolean) => {
    const status = accept ? "accepted" : "refused";
    const { error } = await supabase
      .from("challenge_invites")
      .update({ status: status as any, responded_at: new Date().toISOString() })
      .eq("id", inviteId);

    if (error) {
      toast.error("Erreur");
      return;
    }

    toast.success(accept ? "Défi accepté ! 🔥" : "Défi refusé");
    setInvites((prev) => prev.filter((i) => i.id !== inviteId));
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
              <div className="flex-1">
                <p className="font-display font-bold text-sm">
                  {invite.challenger_profile?.username || "Inconnu"} te défie !
                </p>
                <p className="text-xs text-muted-foreground">
                  {invite.distance_km} km • Expire {formatDistanceToNow(new Date(invite.expires_at), { locale: fr, addSuffix: true })}
                </p>
              </div>
              <Clock className="w-4 h-4 text-accent" />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleRespond(invite.id, true)}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl gradient-primary py-2.5 text-sm font-bold text-primary-foreground neon-glow"
              >
                <Check className="w-4 h-4" /> Accepter
              </button>
              <button
                onClick={() => handleRespond(invite.id, false)}
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
