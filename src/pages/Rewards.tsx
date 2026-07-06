import { motion } from "framer-motion";
import { useMemo } from "react";
import { Calendar, Wallet, ShoppingBag, Sparkles, Gift } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import EventsContent from "@/components/rewards/EventsContent";
import WalletContent from "@/components/rewards/WalletContent";
import MarketContent from "@/components/rewards/MarketContent";
import { useAuth } from "@/contexts/AuthContext";

export default function Rewards() {
  const { profile } = useAuth();
  const fp = Number(profile?.total_fp || 0);

  const particles = useMemo(
    () =>
      Array.from({ length: 12 }).map(() => ({
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: Math.random() * 2 + 1,
        delay: Math.random() * 5,
        duration: 5 + Math.random() * 5,
      })),
    []
  );

  return (
    <div className="min-h-screen w-full max-w-lg mx-auto relative overflow-x-hidden px-3 sm:px-4 pt-[max(1.25rem,env(safe-area-inset-top))] pb-[calc(6rem+env(safe-area-inset-bottom))]">
      {/* Ambient background */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[140%] h-72 gradient-hero pointer-events-none -z-10 opacity-70" />
      <div className="absolute inset-0 pointer-events-none -z-10">
        {particles.map((p, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full bg-primary/40"
            style={{ left: `${p.x}%`, top: `${p.y}%`, width: p.size, height: p.size }}
            animate={{ y: [0, -20, 0], opacity: [0.15, 0.7, 0.15] }}
            transition={{ duration: p.duration, repeat: Infinity, delay: p.delay, ease: "easeInOut" }}
          />
        ))}
      </div>

      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative rounded-3xl border border-border/60 bg-card/70 backdrop-blur-md p-5 mb-4 overflow-hidden"
      >
        <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute -bottom-10 -left-10 w-32 h-32 rounded-full bg-accent/20 blur-3xl" />

        <div className="relative flex items-center gap-3">
          <motion.div
            animate={{ rotate: [0, 8, -8, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            className="w-14 h-14 rounded-2xl gradient-primary flex items-center justify-center neon-glow shrink-0"
          >
            <Gift className="w-7 h-7 text-primary-foreground" />
          </motion.div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] uppercase tracking-widest text-primary font-black flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> Freakout Rewards
            </p>
            <h1 className="font-display font-black text-2xl sm:text-3xl leading-tight text-gradient-primary">
              Récompenses
            </h1>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Événements · Portefeuille · Boutique
            </p>
          </div>
        </div>

        <div className="relative mt-4 flex items-center justify-between rounded-2xl bg-background/40 border border-border/60 px-4 py-3">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
              Solde disponible
            </p>
            <p className="font-display font-black text-2xl text-accent">
              {fp.toFixed(1)} <span className="text-xs text-muted-foreground">FP</span>
            </p>
          </div>
          <div className="w-10 h-10 rounded-full bg-accent/15 border border-accent/40 flex items-center justify-center accent-glow">
            <Wallet className="w-5 h-5 text-accent" />
          </div>
        </div>
      </motion.div>

      <Tabs defaultValue="events" className="w-full">
        <TabsList className="w-full grid grid-cols-3 mb-4 h-12 p-1 rounded-2xl bg-card/70 backdrop-blur-md border border-border/60">
          <TabsTrigger
            value="events"
            className="flex items-center justify-center gap-1.5 text-xs rounded-xl data-[state=active]:gradient-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg font-bold transition-all"
          >
            <Calendar className="w-3.5 h-3.5" /> Événements
          </TabsTrigger>
          <TabsTrigger
            value="wallet"
            className="flex items-center justify-center gap-1.5 text-xs rounded-xl data-[state=active]:gradient-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg font-bold transition-all"
          >
            <Wallet className="w-3.5 h-3.5" /> Portefeuille
          </TabsTrigger>
          <TabsTrigger
            value="market"
            className="flex items-center justify-center gap-1.5 text-xs rounded-xl data-[state=active]:gradient-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg font-bold transition-all"
          >
            <ShoppingBag className="w-3.5 h-3.5" /> Market
          </TabsTrigger>
        </TabsList>

        <motion.div
          key="events-tab"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        >
          <TabsContent value="events"><EventsContent /></TabsContent>
          <TabsContent value="wallet"><WalletContent /></TabsContent>
          <TabsContent value="market"><MarketContent /></TabsContent>
        </motion.div>
      </Tabs>
    </div>
  );
}
