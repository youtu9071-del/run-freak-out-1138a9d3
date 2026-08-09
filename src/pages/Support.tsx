import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ChevronLeft, LifeBuoy, Plus, Send, MessageSquare, Clock, CheckCircle2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

export const SUPPORT_CATEGORIES = [
  "Problème de course / GPS",
  "Freak Points",
  "Market & achats",
  "Compte & connexion",
  "Défis & équipes",
  "Autre",
];

export const STATUS_META: Record<string, { label: string; cls: string }> = {
  open: { label: "Ouvert", cls: "bg-primary/15 text-primary" },
  in_progress: { label: "En cours", cls: "bg-accent/15 text-accent" },
  resolved: { label: "Résolu", cls: "bg-muted text-muted-foreground" },
};

interface Ticket {
  id: string;
  category: string;
  subject: string;
  status: string;
  created_at: string;
  updated_at: string;
}

interface Msg {
  id: string;
  message: string;
  is_admin: boolean;
  created_at: string;
}

export default function Support() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const activeId = params.get("t");

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [category, setCategory] = useState(SUPPORT_CATEGORIES[0]);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [reply, setReply] = useState("");

  const fetchTickets = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("support_tickets")
      .select("*")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });
    setTickets((data as Ticket[]) || []);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  const fetchMsgs = useCallback(async () => {
    if (!activeId) return;
    const { data } = await supabase
      .from("support_messages")
      .select("*")
      .eq("ticket_id", activeId)
      .order("created_at", { ascending: true });
    setMsgs((data as Msg[]) || []);
  }, [activeId]);

  useEffect(() => {
    if (!activeId) return;
    fetchMsgs();
    const ch = supabase
      .channel(`support-${activeId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "support_messages", filter: `ticket_id=eq.${activeId}` },
        () => fetchMsgs()
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [activeId, fetchMsgs]);

  const createTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !subject.trim() || !message.trim()) return;
    setSending(true);
    const { data, error } = await supabase
      .from("support_tickets")
      .insert({ user_id: user.id, category, subject: subject.trim() })
      .select("id")
      .single();
    if (!error && data) {
      await supabase.from("support_messages").insert({
        ticket_id: data.id,
        sender_id: user.id,
        is_admin: false,
        message: message.trim(),
      });
      setSubject(""); setMessage(""); setCreating(false);
      await fetchTickets();
      setParams({ t: data.id });
    }
    setSending(false);
  };

  const sendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !activeId || !reply.trim()) return;
    const text = reply.trim();
    setReply("");
    await supabase.from("support_messages").insert({
      ticket_id: activeId, sender_id: user.id, is_admin: false, message: text,
    });
    fetchMsgs();
  };

  const activeTicket = tickets.find((t) => t.id === activeId);

  return (
    <div className="min-h-screen bg-background text-foreground pb-28">
      <header className="sticky top-0 z-30 bg-background/90 backdrop-blur border-b border-border px-4 py-3 flex items-center gap-3"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 0.75rem)" }}>
        <button
          onClick={() => (activeId ? setParams({}) : navigate("/profile"))}
          className="w-9 h-9 rounded-full bg-card border border-border flex items-center justify-center"
          aria-label="Retour"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="min-w-0">
          <h1 className="font-display font-black text-lg leading-tight truncate">
            {activeTicket ? activeTicket.subject : "Support"}
          </h1>
          <p className="text-[11px] text-muted-foreground leading-tight truncate">
            {activeTicket ? activeTicket.category : "Une question ? On est là pour t'aider"}
          </p>
        </div>
      </header>

      <div className="max-w-lg mx-auto p-4 space-y-4">
        {activeId ? (
          <>
            <div className="space-y-3">
              {msgs.map((m) => (
                <motion.div
                  key={m.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
                    m.is_admin
                      ? "bg-card border border-border"
                      : "ml-auto gradient-primary text-primary-foreground"
                  }`}
                >
                  <p className="text-[10px] uppercase tracking-widest opacity-70 mb-0.5">
                    {m.is_admin ? "Support FREAK OUT" : "Toi"}
                  </p>
                  <p className="text-sm whitespace-pre-wrap break-words">{m.message}</p>
                  <p className="text-[10px] opacity-60 mt-1">
                    {formatDistanceToNow(new Date(m.created_at), { locale: fr, addSuffix: true })}
                  </p>
                </motion.div>
              ))}
            </div>

            {activeTicket?.status !== "resolved" ? (
              <form onSubmit={sendReply} className="sticky bottom-24 flex gap-2">
                <input
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  placeholder="Écris ton message..."
                  className="flex-1 rounded-xl bg-card border border-border px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <button type="submit" className="w-12 rounded-xl gradient-primary flex items-center justify-center">
                  <Send className="w-4 h-4 text-primary-foreground" />
                </button>
              </form>
            ) : (
              <p className="text-center text-xs text-muted-foreground flex items-center justify-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-primary" /> Demande résolue
              </p>
            )}
          </>
        ) : (
          <>
            <AnimatePresence initial={false}>
              {creating ? (
                <motion.form
                  key="form"
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  onSubmit={createTicket}
                  className="rounded-2xl bg-card border border-border p-4 space-y-3"
                >
                  <h2 className="font-display font-bold text-sm">Nouvelle demande</h2>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full rounded-xl bg-background border border-border px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    {SUPPORT_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <input
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    required
                    placeholder="Sujet"
                    className="w-full rounded-xl bg-background border border-border px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    required
                    rows={5}
                    placeholder="Décris ton problème..."
                    className="w-full rounded-xl bg-background border border-border px-3 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setCreating(false)} className="flex-1 rounded-xl border border-border py-3 text-sm font-semibold">
                      Annuler
                    </button>
                    <button type="submit" disabled={sending} className="flex-1 rounded-xl gradient-primary py-3 text-sm font-display font-bold text-primary-foreground disabled:opacity-50">
                      {sending ? "Envoi..." : "ENVOYER"}
                    </button>
                  </div>
                </motion.form>
              ) : (
                <motion.button
                  key="cta"
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setCreating(true)}
                  className="w-full rounded-2xl gradient-primary py-4 font-display font-black text-primary-foreground neon-glow flex items-center justify-center gap-2"
                >
                  <Plus className="w-5 h-5" /> NOUVELLE DEMANDE
                </motion.button>
              )}
            </AnimatePresence>

            <div className="space-y-2">
              <h2 className="font-display font-bold text-sm flex items-center gap-2 pt-2">
                <LifeBuoy className="w-4 h-4 text-primary" /> Mes demandes
              </h2>
              {loading ? (
                <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
              ) : tickets.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">Aucune demande pour le moment</p>
              ) : (
                tickets.map((t, i) => {
                  const s = STATUS_META[t.status] ?? STATUS_META.open;
                  return (
                    <motion.button
                      key={t.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04 }}
                      onClick={() => setParams({ t: t.id })}
                      className="w-full text-left rounded-2xl bg-card border border-border p-4 hover:border-primary/40 transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                          <MessageSquare className="w-4 h-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-sm truncate">{t.subject}</p>
                          <p className="text-xs text-muted-foreground truncate">{t.category}</p>
                          <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatDistanceToNow(new Date(t.updated_at), { locale: fr, addSuffix: true })}
                          </p>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-1 rounded-full shrink-0 ${s.cls}`}>{s.label}</span>
                      </div>
                    </motion.button>
                  );
                })
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
