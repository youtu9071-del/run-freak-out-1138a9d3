import { useState } from "react";
import { useAdmin } from "@/hooks/useAdmin";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Shield, Calendar, ShoppingBag, Users, LogOut, QrCode } from "lucide-react";
import AdminEvents from "./AdminEvents";
import AdminProducts from "./AdminProducts";
import AdminUsers from "./AdminUsers";
import AdminQRScanner from "./AdminQRScanner";

export default function AdminDashboard() {
  const { isAdmin, loading } = useAdmin();
  const { user, loading: authLoading, signOut } = useAuth();

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-12 h-12 rounded-full border-4 border-muted border-t-primary animate-spin" />
      </div>
    );
  }

  if (!user || !isAdmin) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield className="w-6 h-6 text-primary" />
          <h1 className="font-display font-bold text-xl">Admin Panel</h1>
        </div>
        <button onClick={signOut} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <LogOut className="w-4 h-4" /> Déconnexion
        </button>
      </header>

      <div className="max-w-6xl mx-auto p-6">
        <Tabs defaultValue="events">
          <TabsList className="w-full grid grid-cols-4 mb-6">
            <TabsTrigger value="events" className="flex items-center gap-2">
              <Calendar className="w-4 h-4" /> Événements
            </TabsTrigger>
            <TabsTrigger value="products" className="flex items-center gap-2">
              <ShoppingBag className="w-4 h-4" /> Produits
            </TabsTrigger>
            <TabsTrigger value="users" className="flex items-center gap-2">
              <Users className="w-4 h-4" /> Utilisateurs
            </TabsTrigger>
            <TabsTrigger value="qrcodes" className="flex items-center gap-2">
              <QrCode className="w-4 h-4" /> QR Codes
            </TabsTrigger>
          </TabsList>

          <TabsContent value="events"><AdminEvents /></TabsContent>
          <TabsContent value="products"><AdminProducts /></TabsContent>
          <TabsContent value="users"><AdminUsers /></TabsContent>
          <TabsContent value="qrcodes"><AdminQRScanner /></TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
