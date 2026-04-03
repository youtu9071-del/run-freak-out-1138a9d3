import { motion } from "framer-motion";
import { Calendar, MapPin, Trophy, Users, Clock, CheckCircle2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface Event {
  id: string;
  title: string;
  description: string | null;
  distance_km: number;
  start_date: string;
  end_date: string;
  reward_fp: number;
  bonus_description: string | null;
  image_url: string | null;
  max_participants: number | null;
  status: string;
}

interface Participation {
  event_id: string;
  distance_completed: number;
  completed: boolean;
  fp_earned: number;
}

export default function Events() {
  const { user } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [participations, setParticipations] = useState<Participation[]>([]);
  const [participantCounts, setParticipantCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [user]);

  const loadData = async () => {
    if (!user) return;
    
    const [eventsRes, partRes] = await Promise.all([
      supabase.from("events").select("*").order("start_date", { ascending: true }),
      supabase.from("event_participants").select("event_id, distance_completed, completed, fp_earned").eq("user_id", user.id),
    ]);

    if (eventsRes.data) {
      setEvents(eventsRes.data as Event[]);
      // Get participant counts
      const counts: Record<string, number> = {};
      for (const e of eventsRes.data) {
        const { count } = await supabase
          .from("event_participants")
          .select("*", { count: "exact", head: true })
          .eq("event_id", e.id);
        counts[e.id] = count || 0;
      }
      setParticipantCounts(counts);
    }
    if (partRes.data) setParticipations(partRes.data as Participation[]);
    setLoading(false);
  };

  const joinEvent = async (eventId: string) => {
    if (!user) return;
    const { error } = await supabase.from("event_participants").insert({
      event_id: eventId,
      user_id: user.id,
    });
    if (error) {
      if (error.code === "23505") toast.error("Tu participes déjà à cet événement !");
      else toast.error("Erreur lors de l'inscription");
      return;
    }
    toast.success("Inscription réussie ! 🎉");
    loadData();
  };

  const isJoined = (eventId: string) => participations.some((p) => p.event_id === eventId);
  const getParticipation = (eventId: string) => participations.find((p) => p.event_id === eventId);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active": return "text-primary";
      case "completed": return "text-muted-foreground";
      default: return "text-accent";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "active": return "En cours";
      case "completed": return "Terminé";
      default: return "À venir";
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-10 h-10 rounded-full border-4 border-muted border-t-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24 px-4 pt-6 max-w-lg mx-auto">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="font-display font-black text-2xl text-foreground mb-1">🎉 Événements</h1>
        <p className="text-sm text-muted-foreground mb-6">Participe et gagne des Freak Points</p>
      </motion.div>

      {events.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-16"
        >
          <Calendar className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground text-lg font-medium">Aucun événement pour le moment</p>
          <p className="text-muted-foreground text-sm mt-1">Reviens bientôt !</p>
        </motion.div>
      ) : (
        <div className="space-y-4">
          {events.map((event, i) => {
            const joined = isJoined(event.id);
            const participation = getParticipation(event.id);
            const progress = participation
              ? Math.min((participation.distance_completed / event.distance_km) * 100, 100)
              : 0;

            return (
              <motion.div
                key={event.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
              >
                <Card className="overflow-hidden border-border">
                  {event.image_url && (
                    <div className="h-32 bg-secondary overflow-hidden">
                      <img src={event.image_url} alt={event.title} className="w-full h-full object-cover" />
                    </div>
                  )}
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-xs font-bold uppercase ${getStatusColor(event.status)}`}>
                            {getStatusLabel(event.status)}
                          </span>
                        </div>
                        <h3 className="font-display font-bold text-lg text-foreground">{event.title}</h3>
                      </div>
                      <div className="flex items-center gap-1 bg-primary/10 px-2 py-1 rounded-full">
                        <Trophy className="w-3.5 h-3.5 text-primary" />
                        <span className="text-xs font-bold text-primary">{event.reward_fp} FP</span>
                      </div>
                    </div>

                    {event.description && (
                      <p className="text-sm text-muted-foreground">{event.description}</p>
                    )}

                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5" />
                        {event.distance_km} km
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {format(new Date(event.start_date), "d MMM", { locale: fr })} - {format(new Date(event.end_date), "d MMM", { locale: fr })}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="w-3.5 h-3.5" />
                        {participantCounts[event.id] || 0}{event.max_participants ? `/${event.max_participants}` : ""}
                      </span>
                    </div>

                    {event.bonus_description && (
                      <p className="text-xs text-accent font-medium">🎁 {event.bonus_description}</p>
                    )}

                    {joined && participation && (
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Progression</span>
                          <span className="text-primary font-bold">{progress.toFixed(0)}%</span>
                        </div>
                        <div className="h-2 bg-secondary rounded-full overflow-hidden">
                          <motion.div
                            className="h-full bg-primary rounded-full"
                            initial={{ width: 0 }}
                            animate={{ width: `${progress}%` }}
                            transition={{ duration: 0.5 }}
                          />
                        </div>
                        {participation.completed && (
                          <p className="text-xs text-primary font-bold flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Complété ! +{participation.fp_earned} FP
                          </p>
                        )}
                      </div>
                    )}

                    {!joined && event.status !== "completed" && (
                      <Button
                        onClick={() => joinEvent(event.id)}
                        className="w-full font-bold"
                        size="sm"
                      >
                        Participer
                      </Button>
                    )}

                    {joined && !participation?.completed && (
                      <div className="flex items-center gap-2 text-xs text-primary">
                        <CheckCircle2 className="w-4 h-4" />
                        <span className="font-medium">Inscrit — continue à courir !</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
