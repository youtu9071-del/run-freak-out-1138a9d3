import { motion } from "framer-motion";
import { ShoppingBag, Zap, Tag, Package } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  category: string | null;
  fp_discount_rate: number;
  max_fp_discount: number;
  in_stock: boolean;
}

export default function Market() {
  const { user, profile } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [fpToUse, setFpToUse] = useState(0);

  const userFp = profile?.total_fp || 0;

  useEffect(() => {
    supabase
      .from("products")
      .select("*")
      .eq("in_stock", true)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (data) setProducts(data as Product[]);
        setLoading(false);
      });
  }, []);

  const calculateDiscount = (product: Product, fp: number) => {
    const maxFpUsable = Math.min(fp, userFp, product.max_fp_discount);
    const discount = maxFpUsable * product.fp_discount_rate;
    return { discount: Math.min(discount, product.price * 0.5), fpUsed: maxFpUsable };
  };

  const handleBuy = async (product: Product, useFp: boolean) => {
    if (!user) return;
    const { discount, fpUsed } = useFp ? calculateDiscount(product, fpToUse) : { discount: 0, fpUsed: 0 };
    const finalPrice = Math.max(product.price - discount, 0);

    const { error } = await supabase.from("orders").insert({
      user_id: user.id,
      product_id: product.id,
      total_price: finalPrice,
      fp_used: fpUsed,
      discount_amount: discount,
    });

    if (error) {
      toast.error("Erreur lors de la commande");
      return;
    }

    // Deduct FP if used
    if (fpUsed > 0 && profile) {
      await supabase
        .from("profiles")
        .update({ total_fp: Math.max((profile.total_fp || 0) - fpUsed, 0) })
        .eq("user_id", user.id);
    }

    toast.success(`Commande passée ! ${fpUsed > 0 ? `(-${fpUsed} FP)` : ""} 🛍️`);
    setSelectedProduct(null);
    setFpToUse(0);
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
        <h1 className="font-display font-black text-2xl text-foreground mb-1">🛍️ Market</h1>
        <p className="text-sm text-muted-foreground mb-2">Utilise tes FP pour des réductions</p>
        <div className="flex items-center gap-2 bg-primary/10 px-3 py-1.5 rounded-full w-fit mb-6">
          <Zap className="w-4 h-4 text-primary" />
          <span className="text-sm font-bold text-primary">{userFp} FP disponibles</span>
        </div>
      </motion.div>

      {products.length === 0 ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-16">
          <ShoppingBag className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground text-lg font-medium">Boutique bientôt disponible</p>
          <p className="text-muted-foreground text-sm mt-1">Des produits arrivent !</p>
        </motion.div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {products.map((product, i) => (
            <motion.div
              key={product.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.05 }}
            >
              <Card
                className="overflow-hidden border-border cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => { setSelectedProduct(product); setFpToUse(0); }}
              >
                <div className="h-28 bg-secondary flex items-center justify-center overflow-hidden">
                  {product.image_url ? (
                    <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                  ) : (
                    <Package className="w-10 h-10 text-muted-foreground" />
                  )}
                </div>
                <CardContent className="p-3 space-y-1">
                  <h3 className="font-bold text-sm text-foreground line-clamp-1">{product.name}</h3>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-foreground">{product.price.toFixed(2)} €</span>
                    <span className="text-[10px] text-primary flex items-center gap-0.5">
                      <Tag className="w-3 h-3" /> -{(product.fp_discount_rate * 100).toFixed(0)}%/FP
                    </span>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Product Detail Dialog */}
      <Dialog open={!!selectedProduct} onOpenChange={() => setSelectedProduct(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display">{selectedProduct?.name}</DialogTitle>
          </DialogHeader>
          {selectedProduct && (
            <div className="space-y-4">
              {selectedProduct.image_url && (
                <div className="h-40 bg-secondary rounded-lg overflow-hidden">
                  <img src={selectedProduct.image_url} alt={selectedProduct.name} className="w-full h-full object-cover" />
                </div>
              )}
              {selectedProduct.description && (
                <p className="text-sm text-muted-foreground">{selectedProduct.description}</p>
              )}

              <div className="space-y-2 bg-secondary/50 p-3 rounded-lg">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Prix</span>
                  <span className="font-bold text-foreground">{selectedProduct.price.toFixed(2)} €</span>
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Utiliser des FP (max {Math.min(userFp, selectedProduct.max_fp_discount)})</label>
                  <Input
                    type="number"
                    min={0}
                    max={Math.min(userFp, selectedProduct.max_fp_discount)}
                    value={fpToUse}
                    onChange={(e) => setFpToUse(Math.max(0, Math.min(parseInt(e.target.value) || 0, Math.min(userFp, selectedProduct.max_fp_discount))))}
                  />
                </div>

                {fpToUse > 0 && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-primary">Réduction FP</span>
                      <span className="text-primary font-bold">
                        -{calculateDiscount(selectedProduct, fpToUse).discount.toFixed(2)} €
                      </span>
                    </div>
                    <div className="flex justify-between text-sm font-bold">
                      <span className="text-foreground">Total</span>
                      <span className="text-foreground">
                        {Math.max(selectedProduct.price - calculateDiscount(selectedProduct, fpToUse).discount, 0).toFixed(2)} €
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => handleBuy(selectedProduct, false)}>
                  Acheter
                </Button>
                {userFp > 0 && (
                  <Button className="flex-1" onClick={() => handleBuy(selectedProduct, true)}>
                    <Zap className="w-4 h-4 mr-1" /> Avec FP
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
