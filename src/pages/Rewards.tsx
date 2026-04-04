import { useState } from "react";
import { motion } from "framer-motion";
import { Gift, Calendar, Wallet, ShoppingBag } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import EventsContent from "@/components/rewards/EventsContent";
import WalletContent from "@/components/rewards/WalletContent";
import MarketContent from "@/components/rewards/MarketContent";

export default function Rewards() {
  return (
    <div className="min-h-screen pb-24 px-4 pt-6 max-w-lg mx-auto">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-4">
        <h1 className="font-display font-black text-2xl text-foreground">Récompenses 🎁</h1>
        <p className="text-sm text-muted-foreground">Événements, points & boutique</p>
      </motion.div>

      <Tabs defaultValue="events" className="w-full">
        <TabsList className="w-full grid grid-cols-3 mb-4">
          <TabsTrigger value="events" className="flex items-center gap-1.5 text-xs">
            <Calendar className="w-3.5 h-3.5" /> Événements
          </TabsTrigger>
          <TabsTrigger value="wallet" className="flex items-center gap-1.5 text-xs">
            <Wallet className="w-3.5 h-3.5" /> Portefeuille
          </TabsTrigger>
          <TabsTrigger value="market" className="flex items-center gap-1.5 text-xs">
            <ShoppingBag className="w-3.5 h-3.5" /> Market
          </TabsTrigger>
        </TabsList>

        <TabsContent value="events">
          <EventsContent />
        </TabsContent>
        <TabsContent value="wallet">
          <WalletContent />
        </TabsContent>
        <TabsContent value="market">
          <MarketContent />
        </TabsContent>
      </Tabs>
    </div>
  );
}
