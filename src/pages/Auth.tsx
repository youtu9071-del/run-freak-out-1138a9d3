import { useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useNavigate } from "react-router-dom";
import { Mail, Lock, User, Eye, EyeOff, ArrowRight, Trophy, Award, Users, ShieldCheck, ChevronRight } from "lucide-react";
import authHero from "@/assets/auth-hero.png.asset.json";

export default function Auth() {
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogle = async () => {
    setError(null);
    setGoogleLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) {
        setError("Connexion Google impossible. Réessaie.");
        setGoogleLoading(false);
        return;
      }
      if (result.redirected) return;
      navigate("/");
    } catch {
      setError("Connexion Google impossible. Réessaie.");
      setGoogleLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const cleanUsername = username.trim();
        const { data: available, error: checkError } = await supabase.rpc(
          "is_username_available" as any,
          { p_username: cleanUsername }
        );
        if (checkError) throw checkError;
        if (available === false) {
          setError("Username déjà utilisé");
          setLoading(false);
          return;
        }

        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { username: cleanUsername } },
        });
        if (error) throw error;
      }
    } catch (err: any) {
      const msg = String(err?.message || "");
      setError(
        /USERNAME_TAKEN|profiles_username_lower_unique|duplicate key/i.test(msg)
          ? "Username déjà utilisé"
          : msg
      );
    } finally {
      setLoading(false);
    }
  };

  const features = [
    { icon: Trophy, t: "COMPÉTITIONS", d: "Affronte les meilleurs et grimpe au classement" },
    { icon: Award, t: "RÉCOMPENSES", d: "Gagne des prix exclusifs et des avantages" },
    { icon: Users, t: "COMMUNAUTÉ", d: "Rejoins une communauté de passionnés" },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      <div className="mx-auto w-full max-w-md pb-10">
        {/* HERO */}
        <div className="relative">
          <img
            src={authHero.url}
            alt="Athlète FREAK OUT en pleine course"
            className="w-full object-cover select-none pointer-events-none"
          />
          <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-background to-transparent" />
        </div>

        <div className="px-5 -mt-6 relative">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-6"
          >
            <div className="flex items-center justify-center gap-3 mb-2">
              <span className="h-px w-8 bg-primary/50" />
              <span className="text-[10px] tracking-[0.35em] text-primary font-bold">
                {isLogin ? "BIENVENUE" : "INSCRIPTION"}
              </span>
              <span className="h-px w-8 bg-primary/50" />
            </div>
            <h1 className="font-display font-black text-3xl leading-tight">
              {isLogin ? (
                <>Content de <span className="text-primary">te revoir !</span></>
              ) : (
                <>Rejoins la <span className="text-primary">compétition</span></>
              )}
            </h1>
            <p className="text-sm text-muted-foreground mt-1.5">
              {isLogin ? "Connecte-toi pour reprendre la compétition." : "Crée ton compte et deviens une légende."}
            </p>
          </motion.div>

          {/* FORM CARD */}
          <motion.form
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 }}
            onSubmit={handleSubmit}
            className="rounded-3xl border border-primary/25 bg-card/60 backdrop-blur-xl p-5 space-y-4 shadow-[0_0_40px_-12px_hsl(var(--primary)/0.35)]"
          >
            {!isLogin && (
              <div className="flex items-center gap-3 rounded-2xl border border-border/70 bg-background/60 px-3 py-2.5">
                <div className="w-9 h-9 rounded-full border border-primary/40 flex items-center justify-center shrink-0">
                  <User className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <label className="block text-[10px] font-bold tracking-[0.15em] text-primary">NOM D'UTILISATEUR</label>
                  <input
                    type="text"
                    placeholder="ton pseudo"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required={!isLogin}
                    className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
                  />
                </div>
              </div>
            )}

            <div className="flex items-center gap-3 rounded-2xl border border-border/70 bg-background/60 px-3 py-2.5">
              <div className="w-9 h-9 rounded-full border border-primary/40 flex items-center justify-center shrink-0">
                <Mail className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <label className="block text-[10px] font-bold tracking-[0.15em] text-primary">ADRESSE E-MAIL</label>
                <input
                  type="email"
                  placeholder="ton@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-2xl border border-border/70 bg-background/60 px-3 py-2.5">
              <div className="w-9 h-9 rounded-full border border-primary/40 flex items-center justify-center shrink-0">
                <Lock className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <label className="block text-[10px] font-bold tracking-[0.15em] text-primary">MOT DE PASSE</label>
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
                />
              </div>
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="shrink-0 w-9 h-9 rounded-full border border-border flex items-center justify-center">
                {showPassword ? <EyeOff className="w-4 h-4 text-muted-foreground" /> : <Eye className="w-4 h-4 text-muted-foreground" />}
              </button>
            </div>

            {error && <p className="text-sm text-destructive text-center">{error}</p>}

            <motion.button
              whileTap={{ scale: 0.97 }}
              type="submit"
              disabled={loading}
              className="relative w-full rounded-2xl gradient-primary py-4 font-display font-black tracking-wider text-primary-foreground neon-glow disabled:opacity-50 flex items-center justify-center"
            >
              <ChevronRight className="w-4 h-4 absolute left-4 opacity-60" />
              <ChevronRight className="w-4 h-4 absolute left-7 opacity-80" />
              {loading ? "..." : isLogin ? "SE CONNECTER" : "S'INSCRIRE"}
              <span className="absolute right-3 w-8 h-8 rounded-full bg-background/25 flex items-center justify-center">
                <ArrowRight className="w-4 h-4" />
              </span>
            </motion.button>

            <div className="flex items-center gap-3">
              <span className="h-px flex-1 bg-border" />
              <span className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">ou</span>
              <span className="h-px flex-1 bg-border" />
            </div>

            <motion.button
              whileTap={{ scale: 0.97 }}
              type="button"
              onClick={handleGoogle}
              disabled={googleLoading}
              className="w-full rounded-2xl bg-background/70 border border-border py-3.5 font-semibold text-sm text-foreground flex items-center justify-center gap-3 hover:bg-muted/40 transition-colors disabled:opacity-50"
            >
              <svg className="w-5 h-5" viewBox="0 0 48 48" aria-hidden="true">
                <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.9 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.4-.4-3.5z"/>
                <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
                <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.1-11.3-7.5l-6.5 5C9.6 39.6 16.2 44 24 44z"/>
                <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.2-4.1 5.6l6.2 5.2C39.9 35.9 44 30.6 44 24c0-1.2-.1-2.4-.4-3.5z"/>
              </svg>
              {googleLoading ? "Connexion..." : "Continuer avec Google"}
            </motion.button>

            <p className="text-center text-sm text-muted-foreground">
              {isLogin ? "Pas encore de compte ?" : "Déjà un compte ?"}{" "}
              <button type="button" onClick={() => { setIsLogin(!isLogin); setError(null); }} className="text-primary font-semibold inline-flex items-center gap-1">
                {isLogin ? "Créer un compte" : "Se connecter"} <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </p>
          </motion.form>

          {/* FEATURES */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.16 }}
            className="mt-4 rounded-3xl border border-border/70 bg-card/40 backdrop-blur-md grid grid-cols-3 divide-x divide-border/60"
          >
            {features.map((f) => (
              <div key={f.t} className="p-3 text-center">
                <f.icon className="w-6 h-6 text-primary mx-auto mb-1.5" />
                <p className="text-[11px] font-display font-bold">{f.t}</p>
                <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">{f.d}</p>
              </div>
            ))}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.22 }}
            className="mt-3 rounded-2xl border border-border/70 bg-card/40 backdrop-blur-md px-4 py-3 flex items-center gap-3"
          >
            <ShieldCheck className="w-5 h-5 text-primary shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">SÉCURISÉ ET FIABLE</p>
              <p className="text-[11px] text-muted-foreground">Données chiffrées et 100% protégées</p>
            </div>
            <Lock className="w-4 h-4 text-primary/70" />
          </motion.div>

          <p className="mt-5 text-center text-[11px] text-muted-foreground flex items-center justify-center gap-1.5">
            <Lock className="w-3 h-3" /> FREAK OUT © 2026 – Tous droits réservés
          </p>
        </div>
      </div>
    </div>
  );
}
