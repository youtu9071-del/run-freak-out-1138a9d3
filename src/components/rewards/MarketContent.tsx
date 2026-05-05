import { motion } from "framer-motion";
import { ShoppingBag, Zap, Tag, Package, QrCode, Wallet } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
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
  const [fpToUse, setFpToUse] = useState(0);
  const [purchasing, setPurchasing] = useState(false);
  const [generatedQR, setGeneratedQR] = useState<string | null>(null);
  const userFp = profile?.total_fp || 0;

  useEffect(() => {
    supabase.from("products").select("*").eq("in_stock", true).order("created_at", { ascending: false })
      .then(({ data }) => { if (data) setProducts(data as Product[]); setLoading(false); });
  }, []);

  const calculateDiscount = (product: Product, fp: number) => {
    const maxFpUsable = Math.min(fp, userFp, product.max_fp_discount);
    const discount = maxFpUsable * product.fp_discount_rate;
    return { discount: Math.min(discount, product.price * 0.5), fpUsed: maxFpUsable };
  };

  const handleBuy = async (product: Product) => {
    if (!user || !profile) return;

    const { discount, fpUsed } = fpToUse > 0 ? calculateDiscount(product, fpToUse) : { discount: 0, fpUsed: 0 };

    // Check FP balance
    if (fpUsed > userFp) {
      toast.error("FP insuffisants ❌");
      return;
    }

    setPurchasing(true);
    const finalPrice = Math.max(product.price - discount, 0);

    // Generate stable unique scan UID (used in URL & lookup)
    const scanUid = (crypto.randomUUID() as string).replace(/-/g, "");
    const scanUrl = `${window.location.origin}/scan/${scanUid}`;

    // QR encodes the public scan URL — scanning opens the validation page
    const qrData = scanUrl;

    // Save QR code with explicit qr_uid so the public scan endpoint can find it
    const { error: qrError } = await supabase.from("purchase_qrcodes").insert({
      user_id: user.id,
      product_id: product.id,
      fp_used: fpUsed,
      discount_amount: discount,
      total_price: finalPrice,
      qr_data: qrData,
      qr_uid: scanUid,
    } as any);

    if (qrError) {
      toast.error("Erreur lors de l'achat");
      setPurchasing(false);
      return;
    }

    // Deduct FP
    if (fpUsed > 0) {
      await supabase.from("profiles").update({
        total_fp: Math.max((profile.total_fp || 0) - fpUsed, 0),
      }).eq("user_id", user.id);
      await refreshProfile();
    }

    // Save order
    await supabase.from("orders").insert({
      user_id: user.id,
      product_id: product.id,
      total_price: finalPrice,
      fp_used: fpUsed,
      discount_amount: discount,
    });

    setGeneratedQR(qrData);
    toast.success("Paiement validé ! 🎉");
    setPurchasing(false);
  };

  if (loading) {
    return <div className="flex items-center justify-center py-16"><div className="w-10 h-10 rounded-full border-4 border-muted border-t-primary animate-spin" /></div>;
  }

  return (
    <div>
      <div className="flex items-center gap-2 bg-primary/10 px-3 py-1.5 rounded-full w-fit mb-4">
        <Zap className="w-4 h-4 text-primary" />
        <span className="text-sm font-bold text-primary">{userFp} FP disponibles</span>
      </div>

      {products.length === 0 ? (
        <div className="text-center py-16">
          <ShoppingBag className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground text-lg font-medium">Boutique bientôt disponible</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {products.map((product, i) => (
            <motion.div key={product.id} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.05 }}>
              <Card className="overflow-hidden border-border cursor-pointer hover:border-primary/50 transition-colors" onClick={() => { setSelectedProduct(product); setFpToUse(0); setGeneratedQR(null); }}>
                <div className="h-28 bg-secondary flex items-center justify-center overflow-hidden">
                  {product.image_url ? <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" /> : <Package className="w-10 h-10 text-muted-foreground" />}
                </div>
                <CardContent className="p-3 space-y-1">
                  <h3 className="font-bold text-sm text-foreground line-clamp-1">{product.name}</h3>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-foreground">{formatPrice(product.price, product.currency)}</span>
                    <span className="text-[10px] text-primary flex items-center gap-0.5"><Tag className="w-3 h-3" /> -{(product.fp_discount_rate * 100).toFixed(0)}%/FP</span>
                  </div>
                  <div className="flex items-center gap-1 text-[10px] text-accent">
                    <Zap className="w-3 h-3" />
                    <span>Max {product.max_fp_discount} FP</span>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      <Dialog open={!!selectedProduct} onOpenChange={() => { setSelectedProduct(null); setGeneratedQR(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="font-display">{selectedProduct?.name}</DialogTitle></DialogHeader>
          {selectedProduct && !generatedQR && (
            <div className="space-y-4">
              {selectedProduct.image_url && (
                <div className="h-40 bg-secondary rounded-lg overflow-hidden">
                  <img src={selectedProduct.image_url} alt={selectedProduct.name} className="w-full h-full object-cover" />
                </div>
              )}
              {selectedProduct.description && <p className="text-sm text-muted-foreground">{selectedProduct.description}</p>}
              <div className="space-y-2 bg-secondary/50 p-3 rounded-lg">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Prix</span>
                  <span className="font-bold text-foreground">{formatPrice(selectedProduct.price, selectedProduct.currency)}</span>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Utiliser des FP (max {Math.min(userFp, selectedProduct.max_fp_discount)})</label>
                  <Input type="number" min={0} max={Math.min(userFp, selectedProduct.max_fp_discount)} value={fpToUse}
                    onChange={(e) => setFpToUse(Math.max(0, Math.min(parseInt(e.target.value) || 0, Math.min(userFp, selectedProduct.max_fp_discount))))} />
                </div>
                {fpToUse > 0 && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-primary">Réduction FP</span>
                      <span className="text-primary font-bold">-{formatPrice(calculateDiscount(selectedProduct, fpToUse).discount, selectedProduct.currency)}</span>
                    </div>
                    <div className="flex justify-between text-sm font-bold">
                      <span className="text-foreground">Total</span>
                      <span className="text-foreground">{formatPrice(Math.max(selectedProduct.price - calculateDiscount(selectedProduct, fpToUse).discount, 0), selectedProduct.currency)}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* FP check warning */}
              {fpToUse > userFp && (
                <div className="rounded-lg bg-destructive/10 border border-destructive/30 p-3 text-center">
                  <p className="text-xs text-destructive font-bold">FP insuffisants ❌</p>
                </div>
              )}

              <Button
                className="w-full"
                disabled={purchasing || fpToUse > userFp}
                onClick={() => handleBuy(selectedProduct)}
              >
                <Wallet className="w-4 h-4 mr-2" />
                {purchasing ? "Traitement..." : "Acheter avec FP"}
              </Button>
            </div>
          )}

          {/* QR Code generated */}
          {generatedQR && (
            <div className="space-y-4 text-center">
              <div className="flex items-center justify-center gap-2 text-primary">
                <QrCode className="w-5 h-5" />
                <span className="font-display font-bold">Paiement validé !</span>
              </div>
              <div className="bg-white p-4 rounded-xl inline-block mx-auto">
                <QRCodeSVG value={generatedQR} size={200} />
              </div>
              <p className="text-xs text-muted-foreground">
                Présentez ce QR code à l'administrateur pour récupérer votre produit.
                Retrouvez-le dans votre portefeuille.
              </p>
              <Button variant="outline" onClick={() => { setSelectedProduct(null); setGeneratedQR(null); }}>
                Fermer
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
