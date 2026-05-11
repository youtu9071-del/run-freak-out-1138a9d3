import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Swords, Check, X, Clock, Calendar } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatDistanceToNow, format } from "date-fns";
import { fr } from "date-fns/locale";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

interface Invite {
  id: string;
  challenger_id: string;
  challenged_id: string;
  distance_km: number;
  status: string;
  created_at: string;
  expires_at: string;
  scheduled_date?: string | null;
  challenge_level?: string | null;
  stake_fp?: number;
  coffre_amount?: number;
  challenger_profile?: { username: string; avatar_url: string | null };
}

const MAX_REFUSAL_MESSAGE = 200;

export default function ChallengeInvites() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [refuseInvite, setRefuseInvite] = useState<Invite | null>(null);
  const [refuseMessage, setRefuseMessage] = useState("");
  const [refusing, setRefusing] = useState(false);

  useEffect(() => {
    if (!user) return;
    fetchInvites();

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

  const handleAccept = async (invite: Invite) => {
    const { error } = await supabase.rpc("accept_duel_invite" as any, { p_invite_id: invite.id });
    if (error) {
      toast.error(error.message || "Erreur");
      return;
    }
    setInvites((prev) => prev.filter((i) => i.id !== invite.id));
    toast.success(`Défi accepté ! ${invite.stake_fp ?? 0} FP placés dans le coffre 🔒`);
    setTimeout(() => navigate("/activity"), 600);
  };

  const openRefuseDialog = (invite: Invite) => {
    setRefuseInvite(invite);
    setRefuseMessage("");
  };

  const submitRefusal = async () => {
    if (!refuseInvite || !user) return;
    const trimmed = refuseMessage.trim().slice(0, MAX_REFUSAL_MESSAGE);

    setRefusing(true);
    const { error } = await supabase.rpc("refuse_duel_invite" as any, { p_invite_id: refuseInvite.id });

    if (error) {
      toast.error(error.message || "Erreur");
      setRefusing(false);
      return;
    }

    const { data: meProfile } = await supabase
      .from("profiles")
      .select("username")
      .eq("user_id", user.id)
      .maybeSingle();

    const myName = meProfile?.username || "Un runner";
    const baseMsg = `${myName} a refusé ton défi de ${refuseInvite.distance_km} km`;
    const finalMsg = trimmed ? `${baseMsg} — « ${trimmed} »` : baseMsg;

    await supabase.from("notifications" as any).insert({
      user_id: refuseInvite.challenger_id,
      type: "challenge_refused",
      title: "Défi refusé ❌",
      message: finalMsg,
      related_id: refuseInvite.id,
    });

    setInvites((prev) => prev.filter((i) => i.id !== refuseInvite.id));
    toast.success("Défi refusé · mise remboursée à l'adversaire");
    setRefuseInvite(null);
    setRefuseMessage("");
    setRefusing(false);
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
                <p className="text-xs text-muted-foreground">
                  {invite.distance_km} km
                  {invite.challenge_level && <span className="ml-2 text-accent font-bold">[{invite.challenge_level}]</span>}
                </p>
                {invite.stake_fp ? (
                  <p className="text-[10px] text-primary mt-0.5">
                    🔒 Mise {invite.stake_fp} FP requise · Coffre total {Number(invite.coffre_amount ?? 0) + invite.stake_fp} FP
                  </p>
                ) : null}
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
                onClick={() => handleAccept(invite)}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl gradient-primary py-2.5 text-sm font-bold text-primary-foreground neon-glow"
              >
                <Check className="w-4 h-4" /> Accepter
              </button>
              <button
                onClick={() => openRefuseDialog(invite)}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-secondary py-2.5 text-sm font-bold text-secondary-foreground"
              >
                <X className="w-4 h-4" /> Refuser
              </button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>

      <Dialog open={!!refuseInvite} onOpenChange={(o) => !o && setRefuseInvite(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <X className="w-5 h-5 text-destructive" /> Refuser le défi
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Tu peux ajouter un court message pour {refuseInvite?.challenger_profile?.username || "ton adversaire"} (optionnel).
            </p>
            <div>
              <Textarea
                value={refuseMessage}
                onChange={(e) => setRefuseMessage(e.target.value.slice(0, MAX_REFUSAL_MESSAGE))}
                placeholder="Ex: Pas dispo cette semaine, on remet ça !"
                className="resize-none"
                rows={3}
              />
              <p className="text-[10px] text-muted-foreground mt-1 text-right">
                {refuseMessage.length}/{MAX_REFUSAL_MESSAGE}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                disabled={refusing}
                onClick={() => setRefuseInvite(null)}
                className="flex-1 rounded-xl bg-secondary py-2.5 text-sm font-bold text-secondary-foreground disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                disabled={refusing}
                onClick={submitRefusal}
                className="flex-1 rounded-xl bg-destructive py-2.5 text-sm font-bold text-destructive-foreground disabled:opacity-50"
              >
                {refusing ? "..." : "Confirmer le refus"}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
