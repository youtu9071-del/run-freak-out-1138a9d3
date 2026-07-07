import { motion } from "framer-motion";
import { ShoppingBag, Zap, Tag, Package, QrCode, Wallet, Lock } from "lucide-react";
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
}

const currencySymbols: Record<string, string> = { EUR: "€", USD: "$", FCFA: "FCFA" };
const formatPrice = (price: number, currency: string) => {
  const sym = currencySymbols[currency] || currency;
  return currency === "FCFA" ? `${price.toLocaleString()} ${sym}` : `${price.toFixed(2)} ${sym}`;
};

export default function MarketContent() {
  const { user, profile, refreshProfile } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [purchasing, setPurchasing] = useState(false);
  const [generatedQR, setGeneratedQR] = useState<string | null>(null);
  const userFp = Number(profile?.total_fp ?? 0);

  const loadProducts = () => {
    supabase.from("products").select("*").eq("in_stock", true).order("created_at", { ascending: false })
      .then(({ data }) => { if (data) setProducts(data as Product[]); setLoading(false); });
  };
  useEffect(loadProducts, []);

  const handleBuy = async (product: Product) => {
    const requiredFp = Number(product.max_fp_discount ?? 0);

    if (!user || !profile) {
      toast.error("Veuillez connecter votre portefeuille pour continuer");
      return;
    }

    // 1. Fresh FP from DB (source of truth)
    const { data: freshProfile, error: profileErr } = await supabase
      .from("profiles").select("total_fp").eq("user_id", user.id).maybeSingle();
    if (profileErr || !freshProfile) {
      toast.error("Portefeuille indisponible, réessayez");
      return;
    }
    const currentFp = Number(freshProfile.total_fp ?? 0);

    // Debug logs
    console.log("[MARKET] Purchase check", {
      userFp: currentFp, requiredFp, product: product.name, productId: product.id,
      pass: currentFp >= requiredFp,
    });

    // 2. Hard block — FP insufficient
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
      console.error("[MARKET] Purchase error", msg);
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

      {products.length === 0 ? (
        <div className="text-center py-16">
          <ShoppingBag className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground text-lg font-medium">Boutique bientôt disponible</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {products.map((product, i) => {
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
