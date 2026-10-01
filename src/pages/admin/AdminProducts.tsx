import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Pencil, Trash2, Upload, X, Smartphone, Package } from "lucide-react";
import { toast } from "sonner";

interface ProductForm {
  name: string;
  description: string;
  price: number;
  image_url: string;
  category: string;
  currency: string;
  fp_discount_rate: number;
  max_fp_discount: number;
  in_stock: boolean;
  stock_quantity: number | null;
  product_type: "physical" | "mobile_money";
  country: string;
  operator: string;
  payout_amount: number;
  payout_currency: string;
}

const empty: ProductForm = {
  name: "", description: "", price: 0, image_url: "",
  category: "equipment", currency: "EUR", fp_discount_rate: 0.1, max_fp_discount: 50, in_stock: true,
  stock_quantity: null,
  product_type: "physical", country: "Togo", operator: "FLOOZ", payout_amount: 1000, payout_currency: "FCFA",
};

const currencySymbols: Record<string, string> = { EUR: "€", USD: "$", FCFA: "FCFA" };
const OPERATORS = ["FLOOZ", "MTN MOBILE MONEY", "TOGOCOM / TMONEY", "ORANGE MONEY", "MOOV MONEY", "WAVE"];

export default function AdminProducts() {
  const [products, setProducts] = useState<any[]>([]);
  const [form, setForm] = useState<ProductForm>(empty);
  const [editId, setEditId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [filter, setFilter] = useState<"all" | "physical" | "mobile_money">("all");
  const fileRef = useRef<HTMLInputElement>(null);

  const isMM = form.product_type === "mobile_money";

  const load = async () => {
    const { data } = await supabase.from("products").select("*").order("created_at", { ascending: false });
    setProducts(data || []);
  };

  useEffect(() => { load(); }, []);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("product-images").upload(path, file);
    if (error) { toast.error("Erreur upload image"); setUploading(false); return; }
    const { data: urlData } = supabase.storage.from("product-images").getPublicUrl(path);
    setForm({ ...form, image_url: urlData.publicUrl });
    setUploading(false);
    toast.success("Image importée !");
  };

  const handleSave = async () => {
    if (!form.name) { toast.error("Nom requis"); return; }
    if (isMM) {
      if (!form.operator) { toast.error("Opérateur requis"); return; }
      if (!form.payout_amount || form.payout_amount <= 0) { toast.error("Montant à envoyer requis"); return; }
      if (!form.max_fp_discount || form.max_fp_discount <= 0) { toast.error("Prix en FP requis"); return; }
    } else if (!form.price) {
      toast.error("Prix requis"); return;
    }

    const payload: any = {
      name: form.name, description: form.description,
      price: isMM ? form.payout_amount : form.price,
      image_url: form.image_url || null,
      category: isMM ? "mobile_money" : form.category,
      currency: isMM ? form.payout_currency : form.currency,
      fp_discount_rate: isMM ? 0 : form.fp_discount_rate,
      max_fp_discount: form.max_fp_discount,
      in_stock: form.stock_quantity !== null && form.stock_quantity <= 0 ? false : form.in_stock,
      stock_quantity: form.stock_quantity,
      product_type: form.product_type,
      country: isMM ? form.country : null,
      operator: isMM ? form.operator : null,
      payout_amount: isMM ? form.payout_amount : null,
      payout_currency: isMM ? form.payout_currency : "FCFA",
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
    if (!confirm("Supprimer ce produit ? Les QR codes et commandes associés seront aussi supprimés.")) return;
    const { error } = await supabase.rpc("admin_delete_product" as any, { p_product_id: id });
    if (error) { toast.error(error.message); return; }
    toast.success("Produit supprimé"); load();
  };

  const startEdit = (p: any) => {
    setForm({
      name: p.name, description: p.description || "", price: p.price,
      image_url: p.image_url || "", category: p.category || "equipment",
      currency: p.currency || "EUR",
      fp_discount_rate: p.fp_discount_rate || 0.1, max_fp_discount: p.max_fp_discount || 50,
      in_stock: p.in_stock ?? true,
      stock_quantity: p.stock_quantity ?? null,
      product_type: (p.product_type as any) || "physical",
      country: p.country || "Togo",
      operator: p.operator || "FLOOZ",
      payout_amount: Number(p.payout_amount ?? p.price ?? 0),
      payout_currency: p.payout_currency || "FCFA",
    });
    setEditId(p.id); setShowForm(true);
  };

  const formatPrice = (price: number, currency: string) => {
    const sym = currencySymbols[currency] || currency;
    return currency === "FCFA" ? `${Number(price).toLocaleString()} ${sym}` : `${Number(price).toFixed(2)} ${sym}`;
  };

  const inputCls = "w-full rounded-xl bg-secondary border border-border px-3 py-2 text-sm text-foreground";
  const visible = products.filter(p => filter === "all" || (p.product_type || "physical") === filter);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center gap-3 flex-wrap">
        <h2 className="font-display font-bold text-lg">Produits ({visible.length})</h2>
        <div className="flex items-center gap-2">
          <div className="flex rounded-xl bg-secondary p-1">
            {([["all", "Tous"], ["physical", "Physiques"], ["mobile_money", "Mobile Money"]] as const).map(([v, l]) => (
              <button key={v} onClick={() => setFilter(v as any)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${filter === v ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
                {l}
              </button>
            ))}
          </div>
          <button onClick={() => { setForm(empty); setEditId(null); setShowForm(!showForm); }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground font-semibold text-sm">
            <Plus className="w-4 h-4" /> Ajouter
          </button>
        </div>
      </div>

      {showForm && (
        <div className="bg-card rounded-2xl p-4 border border-border space-y-3">
          {/* Type de produit */}
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Type de produit</label>
            <div className="grid grid-cols-2 gap-2">
              {([["physical", "Produit physique", Package], ["mobile_money", "Mobile Money", Smartphone]] as const).map(([v, l, Icon]) => (
                <button key={v} onClick={() => setForm({ ...form, product_type: v as any })}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-semibold transition-colors ${
                    form.product_type === v ? "border-primary bg-primary/10 text-primary" : "border-border bg-secondary text-muted-foreground"
                  }`}>
                  <Icon className="w-4 h-4" /> {l}
                </button>
              ))}
            </div>
          </div>

          <input placeholder="Nom *" value={form.name} onChange={e => setForm({...form, name: e.target.value})} className={inputCls} />
          <textarea placeholder="Description" value={form.description} onChange={e => setForm({...form, description: e.target.value})}
            className={`${inputCls} min-h-[60px]`} />

          {isMM ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">Opérateur / service *</label>
                  <input list="mm-operators" value={form.operator} onChange={e => setForm({...form, operator: e.target.value})}
                    placeholder="FLOOZ" className={inputCls} />
                  <datalist id="mm-operators">
                    {OPERATORS.map(o => <option key={o} value={o} />)}
                  </datalist>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Pays</label>
                  <input value={form.country} onChange={e => setForm({...form, country: e.target.value})} placeholder="Togo" className={inputCls} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">Montant reçu *</label>
                  <input type="number" min={0} value={form.payout_amount}
                    onChange={e => setForm({...form, payout_amount: +e.target.value})} className={inputCls} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Devise</label>
                  <select value={form.payout_currency} onChange={e => setForm({...form, payout_currency: e.target.value})} className={inputCls}>
                    <option value="FCFA">FCFA</option>
                    <option value="EUR">Euro (€)</option>
                    <option value="USD">Dollar ($)</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Prix en FP *</label>
                  <input type="number" min={0} step="0.5" value={form.max_fp_discount}
                    onChange={e => setForm({...form, max_fp_discount: +e.target.value})} className={inputCls} />
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Les transferts Mobile Money sont traités manuellement par l'admin dans « Commandes Mobile Money ».
              </p>
            </>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">Prix *</label>
                  <input type="number" step="0.01" value={form.price} onChange={e => setForm({...form, price: +e.target.value})} className={inputCls} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Devise</label>
                  <select value={form.currency} onChange={e => setForm({...form, currency: e.target.value})} className={inputCls}>
                    <option value="EUR">Euro (€)</option>
                    <option value="USD">Dollar ($)</option>
                    <option value="FCFA">FCFA</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Catégorie</label>
                  <select value={form.category} onChange={e => setForm({...form, category: e.target.value})} className={inputCls}>
                    <option value="equipment">Équipement</option>
                    <option value="supplement">Complément</option>
                    <option value="accessory">Accessoire</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">Taux réduction FP</label>
                  <input type="number" step="0.01" value={form.fp_discount_rate} onChange={e => setForm({...form, fp_discount_rate: +e.target.value})} className={inputCls} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Coût en FP</label>
                  <input type="number" value={form.max_fp_discount} onChange={e => setForm({...form, max_fp_discount: +e.target.value})} className={inputCls} />
                </div>
              </div>
            </>
          )}

          {/* Image upload */}
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">{isMM ? "Logo de l'opérateur" : "Image du produit"}</label>
            <input ref={fileRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
            {form.image_url ? (
              <div className="relative w-full h-32 rounded-xl overflow-hidden bg-secondary">
                <img src={form.image_url} alt="preview" className="w-full h-full object-cover" />
                <button onClick={() => setForm({...form, image_url: ""})}
                  className="absolute top-2 right-2 p-1 rounded-full bg-background/80 hover:bg-destructive/20">
                  <X className="w-4 h-4 text-foreground" />
                </button>
              </div>
            ) : (
              <button onClick={() => fileRef.current?.click()} disabled={uploading}
                className="w-full rounded-xl border-2 border-dashed border-border py-6 flex flex-col items-center gap-2 text-muted-foreground hover:border-primary/50 transition-colors">
                <Upload className="w-6 h-6" />
                <span className="text-xs">{uploading ? "Import en cours..." : "Importer une image"}</span>
              </button>
            )}
          </div>

          <div>
            <label className="text-xs text-muted-foreground">Quantité disponible (laisser vide = illimité)</label>
            <input type="number" min={0} placeholder="Illimité" value={form.stock_quantity ?? ""}
              onChange={e => setForm({...form, stock_quantity: e.target.value === "" ? null : Math.max(0, +e.target.value)})}
              className={inputCls} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.in_stock} onChange={e => setForm({...form, in_stock: e.target.checked})} />
            Disponible à la vente
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
        {visible.map(p => {
          const mm = (p.product_type || "physical") === "mobile_money";
          return (
            <div key={p.id} className="bg-card rounded-xl p-4 border border-border flex justify-between items-center gap-3">
              <div className="flex items-center gap-3 min-w-0">
                {p.image_url
                  ? <img src={p.image_url} alt={p.name} className="w-10 h-10 rounded-lg object-cover shrink-0" />
                  : <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                      {mm ? <Smartphone className="w-4 h-4 text-primary" /> : <Package className="w-4 h-4 text-muted-foreground" />}
                    </div>}
                <div className="min-w-0">
                  <p className="font-semibold text-sm truncate">
                    {p.name}
                    {mm && <span className="ml-2 text-[10px] uppercase font-bold text-primary">Mobile Money</span>}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {mm
                      ? `${p.operator} · ${p.country || "—"} · ${formatPrice(p.payout_amount ?? p.price, p.payout_currency || "FCFA")} · ${p.max_fp_discount} FP`
                      : `${formatPrice(p.price, p.currency || "EUR")} · ${p.category} · ${p.in_stock ? (p.stock_quantity !== null ? `${p.stock_quantity} en stock` : "En stock") : "Rupture"}`}
                  </p>
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <button onClick={() => startEdit(p)} className="p-2 rounded-lg hover:bg-secondary"><Pencil className="w-4 h-4 text-muted-foreground" /></button>
                <button onClick={() => handleDelete(p.id)} className="p-2 rounded-lg hover:bg-destructive/20"><Trash2 className="w-4 h-4 text-destructive" /></button>
              </div>
            </div>
          );
        })}
        {visible.length === 0 && <p className="text-center text-muted-foreground text-sm py-8">Aucun produit</p>}
      </div>
    </div>
  );
}
