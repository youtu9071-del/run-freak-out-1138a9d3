import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface ProductForm {
  name: string;
  description: string;
  price: number;
  image_url: string;
  category: string;
  fp_discount_rate: number;
  max_fp_discount: number;
  in_stock: boolean;
}

const empty: ProductForm = {
  name: "", description: "", price: 0, image_url: "",
  category: "equipment", fp_discount_rate: 0.1, max_fp_discount: 50, in_stock: true,
};

export default function AdminProducts() {
  const [products, setProducts] = useState<any[]>([]);
  const [form, setForm] = useState<ProductForm>(empty);
  const [editId, setEditId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const load = async () => {
    const { data } = await supabase.from("products").select("*").order("created_at", { ascending: false });
    setProducts(data || []);
  };

  useEffect(() => { load(); }, []);

  const handleSave = async () => {
    if (!form.name || !form.price) {
      toast.error("Nom et prix requis");
      return;
    }

    const payload = {
      name: form.name, description: form.description, price: form.price,
      image_url: form.image_url || null, category: form.category,
      fp_discount_rate: form.fp_discount_rate, max_fp_discount: form.max_fp_discount,
      in_stock: form.in_stock,
    };

    if (editId) {
      const { error } = await supabase.from("products").update(payload).eq("id", editId);
      if (error) { toast.error(error.message); return; }
      toast.success("Produit modifié");
    } else {
      const { error } = await supabase.from("products").insert(payload);
      if (error) { toast.error(error.message); return; }
      toast.success("Produit ajouté");
    }
    setForm(empty); setEditId(null); setShowForm(false); load();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Supprimé"); load();
  };

  const startEdit = (p: any) => {
    setForm({
      name: p.name, description: p.description || "", price: p.price,
      image_url: p.image_url || "", category: p.category || "equipment",
      fp_discount_rate: p.fp_discount_rate || 0.1, max_fp_discount: p.max_fp_discount || 50,
      in_stock: p.in_stock ?? true,
    });
    setEditId(p.id); setShowForm(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="font-display font-bold text-lg">Produits ({products.length})</h2>
        <button onClick={() => { setForm(empty); setEditId(null); setShowForm(!showForm); }}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground font-semibold text-sm">
          <Plus className="w-4 h-4" /> Ajouter
        </button>
      </div>

      {showForm && (
        <div className="bg-card rounded-2xl p-4 border border-border space-y-3">
          <input placeholder="Nom *" value={form.name} onChange={e => setForm({...form, name: e.target.value})}
            className="w-full rounded-xl bg-secondary border border-border px-3 py-2 text-sm text-foreground" />
          <textarea placeholder="Description" value={form.description} onChange={e => setForm({...form, description: e.target.value})}
            className="w-full rounded-xl bg-secondary border border-border px-3 py-2 text-sm text-foreground min-h-[60px]" />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">Prix (€) *</label>
              <input type="number" step="0.01" value={form.price} onChange={e => setForm({...form, price: +e.target.value})}
                className="w-full rounded-xl bg-secondary border border-border px-3 py-2 text-sm text-foreground" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Catégorie</label>
              <select value={form.category} onChange={e => setForm({...form, category: e.target.value})}
                className="w-full rounded-xl bg-secondary border border-border px-3 py-2 text-sm text-foreground">
                <option value="equipment">Équipement</option>
                <option value="supplement">Complément</option>
                <option value="accessory">Accessoire</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Taux réduction FP</label>
              <input type="number" step="0.01" value={form.fp_discount_rate} onChange={e => setForm({...form, fp_discount_rate: +e.target.value})}
                className="w-full rounded-xl bg-secondary border border-border px-3 py-2 text-sm text-foreground" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Réduction max FP</label>
              <input type="number" value={form.max_fp_discount} onChange={e => setForm({...form, max_fp_discount: +e.target.value})}
                className="w-full rounded-xl bg-secondary border border-border px-3 py-2 text-sm text-foreground" />
            </div>
          </div>
          <input placeholder="URL image" value={form.image_url} onChange={e => setForm({...form, image_url: e.target.value})}
            className="w-full rounded-xl bg-secondary border border-border px-3 py-2 text-sm text-foreground" />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.in_stock} onChange={e => setForm({...form, in_stock: e.target.checked})} />
            En stock
          </label>
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
        {products.map(p => (
          <div key={p.id} className="bg-card rounded-xl p-4 border border-border flex justify-between items-center">
            <div>
              <p className="font-semibold text-sm">{p.name}</p>
              <p className="text-xs text-muted-foreground">{p.price}€ · {p.category} · {p.in_stock ? "En stock" : "Rupture"}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => startEdit(p)} className="p-2 rounded-lg hover:bg-secondary"><Pencil className="w-4 h-4 text-muted-foreground" /></button>
              <button onClick={() => handleDelete(p.id)} className="p-2 rounded-lg hover:bg-destructive/20"><Trash2 className="w-4 h-4 text-destructive" /></button>
            </div>
          </div>
        ))}
        {products.length === 0 && <p className="text-center text-muted-foreground text-sm py-8">Aucun produit</p>}
      </div>
    </div>
  );
}
