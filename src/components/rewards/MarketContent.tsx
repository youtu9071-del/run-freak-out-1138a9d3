import { motion } from "framer-motion";
import { ShoppingBag, Zap, Package, QrCode, Wallet, Lock, Smartphone, ArrowRight, ShieldCheck, Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { QRCodeSVG } from "qrcode.react";

interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  category: string | null;
  currency: string;
  fp_discount_rate: number;
  max_fp_discount: number;
  in_stock: boolean;
  stock_quantity: number | null;
  product_type?: string | null;
  country?: string | null;
  operator?: string | null;
  payout_amount?: number | null;
  payout_currency?: string | null;
}

const currencySymbols: Record<string, string> = { EUR: "€", USD: "$", FCFA: "FCFA" };
const formatPrice = (price: number, currency: string) => {
  const sym = currencySymbols[currency] || currency;
  return currency === "FCFA" ? `${Number(price).toLocaleString()} ${sym}` : `${Number(price).toFixed(2)} ${sym}`;
};
const flagFor = (country?: string | null) => {
  const c = (country || "").toLowerCase();
  if (c.includes("togo")) return "🇹🇬";
  if (c.includes("bénin") || c.includes("benin")) return "🇧🇯";
  if (c.includes("côte") || c.includes("ivoire")) return "🇨🇮";
  if (c.includes("sénégal") || c.includes("senegal")) return "🇸🇳";
  if (c.includes("burkina")) return "🇧🇫";
  if (c.includes("mali")) return "🇲🇱";
  if (c.includes("niger")) return "🇳🇪";
  if (c.includes("cameroun")) return "🇨🇲";
  if (c.includes("ghana")) return "🇬🇭";
  return "🌍";
};

export default function MarketContent() {
  const { user, profile, refreshProfile } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [purchasing, setPurchasing] = useState(false);
  const [generatedQR, setGeneratedQR] = useState<string | null>(null);

  // Mobile Money flow
  const [mmProduct, setMmProduct] = useState<Product | null>(null);
  const [phone, setPhone] = useState("");
  const [phone2, setPhone2] = useState("");
  const [mmStep, setMmStep] = useState<"form" | "confirm" | "done">("form");
  const [mmOrder, setMmOrder] = useState<{ order_number: string; fp_price: number } | null>(null);

  const userFp = Number(profile?.total_fp ?? 0);

  const loadProducts = () => {
    supabase.from("products").select("*").eq("in_stock", true).order("created_at", { ascending: false })
      .then(({ data }) => { if (data) setProducts(data as Product[]); setLoading(false); });
  };
  useEffect(loadProducts, []);

  const physical = products.filter(p => (p.product_type || "physical") !== "mobile_money");
  const mobileMoney = products.filter(p => p.product_type === "mobile_money");

  const openMm = (p: Product) => {
    const cost = Number(p.max_fp_discount ?? 0);
    if (!user) { toast.error("Connecte-toi pour continuer"); return; }
    if (userFp < cost) { toast.error(`FP insuffisants (${userFp.toFixed(2)} / ${cost} requis)`); return; }
    setPhone(""); setPhone2(""); setMmStep("form"); setMmOrder(null); setMmProduct(p);
  };

  const confirmMm = async () => {
    if (!mmProduct || purchasing) return;
    const cost = Number(mmProduct.max_fp_discount ?? 0);

    const { data: fresh } = await supabase.from("profiles").select("total_fp").eq("user_id", user!.id).maybeSingle();
    if (!fresh || Number(fresh.total_fp ?? 0) < cost) {
      toast.error("FP insuffisants");
      return;
    }

    setPurchasing(true);
    const { data, error } = await supabase.rpc("purchase_mobile_money" as any, {
      p_product_id: mmProduct.id,
      p_phone: phone.trim(),
    });
    setPurchasing(false);

    if (error) {
      const msg = error.message || "";
      if (msg.includes("INSUFFICIENT_FP")) toast.error("FP insuffisants — achat refusé");
      else if (msg.includes("INVALID_PHONE")) toast.error("Numéro invalide");
      else if (msg.includes("DUPLICATE_ORDER")) toast.error("Commande déjà enregistrée, patiente un instant");
      else if (msg.includes("OUT_OF_STOCK")) toast.error("Produit épuisé");
      else toast.error("Erreur lors de la commande");
      return;
    }

    const row: any = Array.isArray(data) ? data[0] : data;
    setMmOrder({ order_number: row?.order_number, fp_price: Number(row?.fp_price ?? cost) });
    setMmStep("done");
    await refreshProfile();
    loadProducts();
    toast.success("Commande enregistrée 🎉");
  };

  const handleBuy = async (product: Product) => {
    const requiredFp = Number(product.max_fp_discount ?? 0);

    if (!user || !profile) {
      toast.error("Veuillez connecter votre portefeuille pour continuer");
      return;
    }

    const { data: freshProfile, error: profileErr } = await supabase
      .from("profiles").select("total_fp").eq("user_id", user.id).maybeSingle();
    if (profileErr || !freshProfile) {
      toast.error("Portefeuille indisponible, réessayez");
      return;
    }
    const currentFp = Number(freshProfile.total_fp ?? 0);

    if (currentFp < requiredFp) {
      toast.error(`FP insuffisants (${currentFp.toFixed(2)} / ${requiredFp} requis)`);
      return;
    }
    if (product.stock_quantity !== null && product.stock_quantity <= 0) {
      toast.error("Produit épuisé");
      return;
    }

    setPurchasing(true);
    const { data, error } = await supabase.rpc("purchase_with_fp" as any, {
      p_product_id: product.id,
      p_fp_to_use: requiredFp,
    });

    if (error) {
      const msg = error.message || "";
      if (msg.includes("INSUFFICIENT_FP")) toast.error("FP insuffisants — achat refusé");
      else if (msg.includes("OUT_OF_STOCK")) toast.error("Produit épuisé");
      else toast.error("Erreur lors de l'achat");
      setPurchasing(false);
      return;
    }

    const row = Array.isArray(data) ? data[0] : data;
    const scanUid = row?.qr_uid as string;
    const scanUrl = `${window.location.origin}/scan/${scanUid}`;

    await refreshProfile();
    loadProducts();
    setGeneratedQR(scanUrl);
    toast.success("Paiement validé ! 🎉");
    setPurchasing(false);
  };

  if (loading) {
    return <div className="flex items-center justify-center py-16"><div className="w-10 h-10 rounded-full border-4 border-muted border-t-primary animate-spin" /></div>;
  }

  const mmCost = Number(mmProduct?.max_fp_discount ?? 0);
  const phonesMatch = phone.trim().length >= 8 && phone.trim() === phone2.trim();

  return (
    <div>
      {!user ? (
        <div className="rounded-xl bg-destructive/10 border border-destructive/30 p-3 mb-4 flex items-center gap-2">
          <Wallet className="w-4 h-4 text-destructive" />
          <span className="text-xs font-bold text-destructive">Veuillez connecter votre portefeuille pour continuer</span>
        </div>
      ) : (
        <div className="flex items-center gap-2 bg-primary/10 px-3 py-1.5 rounded-full w-fit mb-4">
          <Wallet className="w-4 h-4 text-primary" />
          <Zap className="w-4 h-4 text-primary" />
          <span className="text-sm font-bold text-primary">{userFp.toFixed(2)} FP disponibles</span>
        </div>
      )}

      {/* ─── MOBILE MONEY ─── */}
      {mobileMoney.length > 0 && (
        <div className="mb-7">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display font-black text-base flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-primary" /> Mobile Money
            </h2>
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Transfert manuel</span>
          </div>
          <div className="space-y-2.5">
            {mobileMoney.map((p, i) => {
              const cost = Number(p.max_fp_discount ?? 0);
              const canAfford = userFp >= cost;
              return (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className={`relative overflow-hidden rounded-2xl border p-3.5 backdrop-blur-sm ${
                    canAfford ? "border-primary/30 bg-card/70" : "border-border bg-card/40"
                  }`}
                >
                  <div className="absolute -right-10 -top-10 w-32 h-32 rounded-full bg-primary/10 blur-2xl pointer-events-none" />
                  <div className="relative flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-secondary overflow-hidden flex items-center justify-center shrink-0 ring-1 ring-border">
                      {p.image_url
                        ? <img src={p.image_url} alt={p.operator || p.name} className="w-full h-full object-cover" />
                        : <Smartphone className="w-5 h-5 text-primary" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-display font-bold text-sm truncate">💸 {p.operator || p.name}</p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {flagFor(p.country)} {p.country || "—"}
                      </p>
                      <p className="font-display font-black text-base mt-0.5">
                        {formatPrice(Number(p.payout_amount ?? p.price), p.payout_currency || p.currency)}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[11px] font-bold text-accent flex items-center justify-end gap-1">
                        <Zap className="w-3 h-3" />{cost} FP
                      </p>
                      <Button
                        size="sm"
                        className="mt-2 h-8 gradient-primary"
                        disabled={!canAfford || !user}
                        onClick={() => openMm(p)}
                      >
                        {canAfford ? "Acheter" : "FP insuffisants"}
                        {canAfford && <ArrowRight className="w-3.5 h-3.5 ml-1" />}
                      </Button>
                    </div>
                  </div>
                  {!canAfford && (
                    <p className="relative mt-2 text-[10px] font-bold text-destructive">
                      Manque {(cost - userFp).toFixed(2)} FP
                    </p>
                  )}
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── PRODUITS PHYSIQUES ─── */}
      {mobileMoney.length > 0 && physical.length > 0 && (
        <h2 className="font-display font-black text-base flex items-center gap-2 mb-3">
          <ShoppingBag className="w-4 h-4 text-accent" /> Produits
        </h2>
      )}

      {physical.length === 0 && mobileMoney.length === 0 ? (
        <div className="text-center py-16">
          <ShoppingBag className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground text-lg font-medium">Boutique bientôt disponible</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {physical.map((product, i) => {
            const requiredFp = Number(product.max_fp_discount ?? 0);
            const canAfford = userFp >= requiredFp;
            return (
              <motion.div key={product.id} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.05 }}>
                <Card className={`overflow-hidden border-border cursor-pointer transition-colors ${canAfford ? "hover:border-primary/50" : "opacity-70"}`}
                  onClick={() => { setSelectedProduct(product); setGeneratedQR(null); }}>
                  <div className="h-28 bg-secondary flex items-center justify-center overflow-hidden relative">
                    {product.image_url ? <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" /> : <Package className="w-10 h-10 text-muted-foreground" />}
                    {!canAfford && (
                      <div className="absolute inset-0 bg-background/60 flex items-center justify-center backdrop-blur-sm">
                        <Lock className="w-6 h-6 text-destructive" />
                      </div>
                    )}
                  </div>
                  <CardContent className="p-3 space-y-1">
                    <h3 className="font-bold text-sm text-foreground line-clamp-1">{product.name}</h3>
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-foreground">{formatPrice(product.price, product.currency)}</span>
                      <span className="text-[10px] text-accent flex items-center gap-0.5"><Zap className="w-3 h-3" />{requiredFp} FP</span>
                    </div>
                    <div className={`text-[10px] font-bold ${canAfford ? "text-primary" : "text-destructive"}`}>
                      {canAfford ? "✓ Disponible" : `Manque ${(requiredFp - userFp).toFixed(2)} FP`}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* ─── Dialog Mobile Money ─── */}
      <Dialog open={!!mmProduct} onOpenChange={(o) => { if (!o) { setMmProduct(null); setMmStep("form"); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-primary" />
              {mmStep === "done" ? "Commande enregistrée" : mmProduct?.operator || mmProduct?.name}
            </DialogTitle>
          </DialogHeader>

          {mmProduct && mmStep !== "done" && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-border bg-secondary/40 p-3 space-y-1.5 text-sm">
                <Row label="Produit" value={mmProduct.name} />
                <Row label="Opérateur" value={mmProduct.operator || "—"} />
                <Row label="Pays" value={`${flagFor(mmProduct.country)} ${mmProduct.country || "—"}`} />
                <Row label="Montant reçu" value={formatPrice(Number(mmProduct.payout_amount ?? mmProduct.price), mmProduct.payout_currency || mmProduct.currency)} highlight />
                <Row label="Prix en FP" value={`${mmCost} FP`} />
              </div>

              {mmProduct.description && (
                <p className="text-xs text-muted-foreground whitespace-pre-wrap">{mmProduct.description}</p>
              )}

              {mmStep === "form" && (
                <>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-foreground">Numéro Mobile Money à créditer</label>
                    <input value={phone} onChange={e => setPhone(e.target.value)} inputMode="tel"
                      placeholder="+228 XX XX XX XX"
                      className="w-full rounded-xl bg-secondary border border-border px-3 py-2.5 text-sm text-foreground" />
                    <label className="text-xs font-bold text-foreground">Confirmer le numéro</label>
                    <input value={phone2} onChange={e => setPhone2(e.target.value)} inputMode="tel"
                      placeholder="+228 XX XX XX XX"
                      className="w-full rounded-xl bg-secondary border border-border px-3 py-2.5 text-sm text-foreground" />
                    {phone2.length > 0 && phone.trim() !== phone2.trim() && (
                      <p className="text-[11px] text-destructive font-bold">Les deux numéros doivent être identiques</p>
                    )}
                  </div>
                  <Button className="w-full gradient-primary" disabled={!phonesMatch} onClick={() => setMmStep("confirm")}>
                    Continuer
                  </Button>
                  <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" /> Ton numéro reste privé : visible uniquement par l'administration.
                  </p>
                </>
              )}

              {mmStep === "confirm" && (
                <>
                  <div className="rounded-2xl border border-primary/30 bg-primary/10 p-3 text-center">
                    <p className="text-sm font-bold text-foreground">
                      Confirmes-tu l'envoi de {formatPrice(Number(mmProduct.payout_amount ?? mmProduct.price), mmProduct.payout_currency || mmProduct.currency)} vers ce numéro ?
                    </p>
                    <p className="font-display font-black text-lg mt-1">{phone}</p>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Cette opération déduira {mmCost} FP de ton solde.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1" onClick={() => setMmStep("form")} disabled={purchasing}>
                      Annuler
                    </Button>
                    <Button className="flex-1 gradient-primary" onClick={confirmMm} disabled={purchasing}>
                      {purchasing ? "Traitement..." : "Confirmer l'achat"}
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}

          {mmStep === "done" && mmOrder && mmProduct && (
            <div className="space-y-3 text-center">
              <div className="w-14 h-14 rounded-full bg-primary/15 flex items-center justify-center mx-auto">
                <Clock className="w-6 h-6 text-primary" />
              </div>
              <p className="font-display font-black text-lg">Commande en attente</p>
              <div className="rounded-2xl border border-border bg-secondary/40 p-3 space-y-1.5 text-left text-sm">
                <Row label="N° commande" value={mmOrder.order_number} highlight />
                <Row label="Opérateur" value={mmProduct.operator || mmProduct.name} />
                <Row label="Montant" value={formatPrice(Number(mmProduct.payout_amount ?? mmProduct.price), mmProduct.payout_currency || mmProduct.currency)} />
                <Row label="Numéro" value={maskPhone(phone)} />
                <Row label="FP déduits" value={`${mmOrder.fp_price} FP`} />
              </div>
              <p className="text-[11px] text-muted-foreground">
                L'administration traite le transfert manuellement. Tu seras notifié dès l'envoi.
                Retrouve la commande dans Portefeuille → Mobile Money.
              </p>
              <Button variant="outline" onClick={() => { setMmProduct(null); setMmStep("form"); }}>Fermer</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ─── Dialog produit physique ─── */}
      <Dialog open={!!selectedProduct} onOpenChange={() => { setSelectedProduct(null); setGeneratedQR(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="font-display">{selectedProduct?.name}</DialogTitle></DialogHeader>
          {selectedProduct && !generatedQR && (() => {
            const requiredFp = Number(selectedProduct.max_fp_discount ?? 0);
            const canAfford = userFp >= requiredFp;
            return (
              <div className="space-y-4">
                {selectedProduct.image_url && (
                  <div className="h-48 bg-secondary rounded-lg overflow-hidden">
                    <img src={selectedProduct.image_url} alt={selectedProduct.name} className="w-full h-full object-cover" />
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  {selectedProduct.category && (
                    <span className="text-[10px] uppercase tracking-wider font-bold px-2 py-1 rounded-full bg-primary/15 text-primary border border-primary/30">{selectedProduct.category}</span>
                  )}
                  <span className="text-[10px] uppercase tracking-wider font-bold px-2 py-1 rounded-full bg-accent/15 text-accent border border-accent/30">{selectedProduct.currency}</span>
                </div>
                {selectedProduct.description && (
                  <div className="rounded-lg bg-secondary/40 border border-border/60 p-3">
                    <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{selectedProduct.description}</p>
                  </div>
                )}
                <div className="space-y-2 bg-secondary/50 p-3 rounded-lg">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Prix indicatif</span>
                    <span className="font-bold text-foreground">{formatPrice(selectedProduct.price, selectedProduct.currency)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Coût en FP</span>
                    <span className="font-bold text-accent flex items-center gap-1"><Zap className="w-3 h-3" />{requiredFp} FP</span>
                  </div>
                  <div className="flex justify-between text-sm border-t border-border pt-2">
                    <span className="text-muted-foreground">Ton solde</span>
                    <span className={`font-bold ${canAfford ? "text-primary" : "text-destructive"}`}>{userFp.toFixed(2)} FP</span>
                  </div>
                </div>
                {!canAfford && (
                  <div className="rounded-lg bg-destructive/10 border border-destructive/30 p-3 text-center">
                    <Lock className="w-4 h-4 text-destructive mx-auto mb-1" />
                    <p className="text-xs text-destructive font-bold">FP insuffisants pour cet achat</p>
                    <p className="text-[10px] text-destructive/80">Manque {(requiredFp - userFp).toFixed(2)} FP</p>
                  </div>
                )}
                <Button
                  className="w-full gradient-primary"
                  disabled={purchasing || !user || !canAfford}
                  onClick={() => handleBuy(selectedProduct)}
                >
                  <Wallet className="w-4 h-4 mr-2" />
                  {!user ? "Portefeuille non connecté" : !canAfford ? "FP insuffisants" : purchasing ? "Traitement..." : `Confirmer (${requiredFp} FP)`}
                </Button>
              </div>
            );
          })()}
          {generatedQR && (
            <div className="space-y-4 text-center">
              <div className="flex items-center justify-center gap-2 text-primary">
                <QrCode className="w-5 h-5" />
                <span className="font-display font-bold">Paiement validé !</span>
              </div>
              <div className="bg-white p-4 rounded-xl inline-block mx-auto">
                <QRCodeSVG value={generatedQR} size={200} />
              </div>
              <p className="text-xs text-muted-foreground">Présentez ce QR code à l'administrateur ou au partenaire pour récupérer votre produit.</p>
              <p className="text-[11px] text-primary font-bold">✅ Enregistré dans Portefeuille → Mes QR codes</p>
              <Button variant="outline" onClick={() => { setSelectedProduct(null); setGeneratedQR(null); }}>Fermer</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function maskPhone(p: string) {
  const digits = (p || "").replace(/\s/g, "");
  if (digits.length <= 4) return "••••";
  return `${digits.slice(0, 4)}•••••${digits.slice(-2)}`;
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className={`text-xs font-bold text-right truncate ${highlight ? "text-primary" : "text-foreground"}`}>{value}</span>
    </div>
  );
}
