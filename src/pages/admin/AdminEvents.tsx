import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface EventForm {
  title: string;
  description: string;
  distance_km: number;
  start_date: string;
  end_date: string;
  reward_fp: number;
  bonus_description: string;
  status: string;
}

const empty: EventForm = {
  title: "", description: "", distance_km: 10,
  start_date: "", end_date: "", reward_fp: 50,
  bonus_description: "", status: "upcoming",
};

export default function AdminEvents() {
  const [events, setEvents] = useState<any[]>([]);
  const [form, setForm] = useState<EventForm>(empty);
  const [editId, setEditId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const load = async () => {
    const { data } = await supabase.from("events").select("*").order("created_at", { ascending: false });
    setEvents(data || []);
  };

  useEffect(() => { load(); }, []);

  const handleSave = async () => {
    if (!form.title || !form.start_date || !form.end_date) {
      toast.error("Remplis les champs obligatoires");
      return;
    }

    if (editId) {
      const { error } = await supabase.from("events").update({
        title: form.title, description: form.description,
        distance_km: form.distance_km, start_date: form.start_date,
        end_date: form.end_date, reward_fp: form.reward_fp,
        bonus_description: form.bonus_description, status: form.status,
      }).eq("id", editId);
      if (error) { toast.error(error.message); return; }
      toast.success("Événement modifié");
    } else {
      const { error } = await supabase.from("events").insert({
        title: form.title, description: form.description,
        distance_km: form.distance_km, start_date: form.start_date,
        end_date: form.end_date, reward_fp: form.reward_fp,
        bonus_description: form.bonus_description, status: form.status,
      });
      if (error) { toast.error(error.message); return; }
      toast.success("Événement créé");
    }
    setForm(empty); setEditId(null); setShowForm(false); load();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("events").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Supprimé"); load();
  };

  const startEdit = (e: any) => {
    setForm({
      title: e.title, description: e.description || "",
      distance_km: e.distance_km, start_date: e.start_date?.slice(0, 16),
      end_date: e.end_date?.slice(0, 16), reward_fp: e.reward_fp,
      bonus_description: e.bonus_description || "", status: e.status,
    });
    setEditId(e.id); setShowForm(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="font-display font-bold text-lg">Événements ({events.length})</h2>
        <button onClick={() => { setForm(empty); setEditId(null); setShowForm(!showForm); }}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground font-semibold text-sm">
          <Plus className="w-4 h-4" /> Ajouter
        </button>
      </div>

      {showForm && (
        <div className="bg-card rounded-2xl p-4 border border-border space-y-3">
          <input placeholder="Titre *" value={form.title} onChange={e => setForm({...form, title: e.target.value})}
            className="w-full rounded-xl bg-secondary border border-border px-3 py-2 text-sm text-foreground" />
          <textarea placeholder="Description" value={form.description} onChange={e => setForm({...form, description: e.target.value})}
            className="w-full rounded-xl bg-secondary border border-border px-3 py-2 text-sm text-foreground min-h-[60px]" />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">Distance (km)</label>
              <input type="number" value={form.distance_km} onChange={e => setForm({...form, distance_km: +e.target.value})}
                className="w-full rounded-xl bg-secondary border border-border px-3 py-2 text-sm text-foreground" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Récompense (FP)</label>
              <input type="number" value={form.reward_fp} onChange={e => setForm({...form, reward_fp: +e.target.value})}
                className="w-full rounded-xl bg-secondary border border-border px-3 py-2 text-sm text-foreground" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Début *</label>
              <input type="datetime-local" value={form.start_date} onChange={e => setForm({...form, start_date: e.target.value})}
                className="w-full rounded-xl bg-secondary border border-border px-3 py-2 text-sm text-foreground" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Fin *</label>
              <input type="datetime-local" value={form.end_date} onChange={e => setForm({...form, end_date: e.target.value})}
                className="w-full rounded-xl bg-secondary border border-border px-3 py-2 text-sm text-foreground" />
            </div>
          </div>
          <input placeholder="Bonus (ex: Badge exclusif)" value={form.bonus_description} onChange={e => setForm({...form, bonus_description: e.target.value})}
            className="w-full rounded-xl bg-secondary border border-border px-3 py-2 text-sm text-foreground" />
          <select value={form.status} onChange={e => setForm({...form, status: e.target.value})}
            className="w-full rounded-xl bg-secondary border border-border px-3 py-2 text-sm text-foreground">
            <option value="upcoming">À venir</option>
            <option value="active">Actif</option>
            <option value="completed">Terminé</option>
          </select>
          <div className="flex gap-2">
            <button onClick={handleSave} className="px-4 py-2 rounded-xl bg-primary text-primary-foreground font-semibold text-sm">
              {editId ? "Modifier" : "Créer"}
            </button>
            <button onClick={() => { setShowForm(false); setEditId(null); }} className="px-4 py-2 rounded-xl bg-secondary text-foreground text-sm">
              Annuler
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {events.map(e => (
          <div key={e.id} className="bg-card rounded-xl p-4 border border-border flex justify-between items-center">
            <div>
              <p className="font-semibold text-sm">{e.title}</p>
              <p className="text-xs text-muted-foreground">{e.distance_km} km · {e.reward_fp} FP · {e.status}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => startEdit(e)} className="p-2 rounded-lg hover:bg-secondary"><Pencil className="w-4 h-4 text-muted-foreground" /></button>
              <button onClick={() => handleDelete(e.id)} className="p-2 rounded-lg hover:bg-destructive/20"><Trash2 className="w-4 h-4 text-destructive" /></button>
            </div>
          </div>
        ))}
        {events.length === 0 && <p className="text-center text-muted-foreground text-sm py-8">Aucun événement</p>}
      </div>
    </div>
  );
}
