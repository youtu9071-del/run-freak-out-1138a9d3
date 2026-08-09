import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Search, Send, ChevronLeft, MessageSquare, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

const STATUS: { v: string; l: string; cls: string }[] = [
  { v: "open", l: "Ouvert", cls: "bg-primary/15 text-primary" },
  { v: "in_progress", l: "En cours", cls: "bg-accent/15 text-accent" },
  { v: "resolved", l: "Résolu", cls: "bg-muted text-muted-foreground" },
];

interface Ticket {
  id: string; user_id: string; category: string; subject: string; status: string; updated_at: string;
}
interface Msg { id: string; message: string; is_admin: boolean; created_at: string; }

export default function AdminSupport() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [active, setActive] = useState<Ticket | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [reply, setReply] = useState("");

  const fetchAll = useCallback(async () => {
    const { data } = await supabase.from("support_tickets").select("*").order("updated_at", { ascending: false });
    const list = (data as Ticket[]) || [];
    setTickets(list);
    const ids = [...new Set(list.map((t) => t.user_id))];
    if (ids.length) {
      const { data: profs } = await supabase.from("profiles").select("user_id, username").in("user_id", ids);
      const map: Record<string, string> = {};
      (profs || []).forEach((p: any) => { map[p.user_id] = p.username; });
      setNames(map);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const openTicket = async (t: Ticket) => {
    setActive(t);
    const { data } = await supabase.from("support_messages").select("*").eq("ticket_id", t.id).order("created_at");
    setMsgs((data as Msg[]) || []);
  };

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !active || !reply.trim()) return;
    const text = reply.trim();
    setReply("");
    await supabase.from("support_messages").insert({
      ticket_id: active.id, sender_id: user.id, is_admin: true, message: text,
    });
    const { data } = await supabase.from("support_messages").select("*").eq("ticket_id", active.id).order("created_at");
    setMsgs((data as Msg[]) || []);
    fetchAll();
  };

  const setStatus = async (status: string) => {
    if (!active) return;
    await supabase.from("support_tickets").update({ status }).eq("id", active.id);
    setActive({ ...active, status });
    fetchAll();
  };

  const filtered = tickets.filter((t) => {
    const s = q.toLowerCase();
    return !s || (names[t.user_id] || "").toLowerCase().includes(s) || t.subject.toLowerCase().includes(s);
  });

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  if (active) {
    return (
      <div className="space-y-4">
        <button onClick={() => setActive(null)} className="flex items-center gap-1 text-sm text-muted-foreground">
          <ChevronLeft className="w-4 h-4" /> Toutes les demandes
        </button>
        <div className="rounded-2xl bg-card border border-border p-4">
          <p className="font-display font-bold">{active.subject}</p>
          <p className="text-xs text-muted-foreground">
            {names[active.user_id] || "Utilisateur"} · {active.category}
          </p>
          <div className="flex gap-2 mt-3">
            {STATUS.map((s) => (
              <button
                key={s.v}
                onClick={() => setStatus(s.v)}
                className={`text-[11px] font-bold px-3 py-1.5 rounded-full border ${
                  active.status === s.v ? `${s.cls} border-transparent` : "border-border text-muted-foreground"
                }`}
              >
                {s.l}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          {msgs.map((m) => (
            <div
              key={m.id}
              className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                m.is_admin ? "ml-auto gradient-primary text-primary-foreground" : "bg-card border border-border"
              }`}
            >
              <p className="text-[10px] uppercase tracking-widest opacity-70 mb-0.5">
                {m.is_admin ? "Admin" : names[active.user_id] || "Utilisateur"}
              </p>
              <p className="text-sm whitespace-pre-wrap break-words">{m.message}</p>
              <p className="text-[10px] opacity-60 mt-1">
                {formatDistanceToNow(new Date(m.created_at), { locale: fr, addSuffix: true })}
              </p>
            </div>
          ))}
        </div>

        <form onSubmit={send} className="flex gap-2">
          <input
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder="Répondre à l'utilisateur..."
            className="flex-1 rounded-xl bg-card border border-border px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <button type="submit" className="w-12 rounded-xl gradient-primary flex items-center justify-center">
            <Send className="w-4 h-4 text-primary-foreground" />
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Rechercher un utilisateur ou un sujet..."
          className="w-full rounded-xl bg-card border border-border pl-10 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-10">Aucune demande</p>
      ) : (
        <div className="grid gap-2 md:grid-cols-2">
          {filtered.map((t) => {
            const s = STATUS.find((x) => x.v === t.status) ?? STATUS[0];
            return (
              <button
                key={t.id}
                onClick={() => openTicket(t)}
                className="text-left rounded-2xl bg-card border border-border p-4 hover:border-primary/40 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <MessageSquare className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm truncate">{t.subject}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {names[t.user_id] || "Utilisateur"} · {t.category}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {formatDistanceToNow(new Date(t.updated_at), { locale: fr, addSuffix: true })}
                    </p>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-1 rounded-full shrink-0 ${s.cls}`}>{s.l}</span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
