import { useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useNavigate } from "react-router-dom";
import { Mail, Lock, User, Eye, EyeOff } from "lucide-react";
import freakoutLogo from "@/assets/freakout-logo.png";

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


  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-background">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-8"
      >
        <img src={freakoutLogo} alt="FREAK OUT logo" className="w-32 h-32 object-contain mx-auto mb-2 drop-shadow-[0_0_30px_hsl(145_80%_50%/0.4)]" />
        <h1 className="sr-only">FREAK OUT</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {isLogin ? "Content de te revoir !" : "Rejoins la communauté 🔥"}
        </p>
      </motion.div>

      <motion.form
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-4"
      >
        {!isLogin && (
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Nom d'utilisateur"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required={!isLogin}
              className="w-full rounded-xl bg-card border border-border pl-10 pr-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        )}

        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full rounded-xl bg-card border border-border pl-10 pr-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type={showPassword ? "text" : "password"}
            placeholder="Mot de passe"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            className="w-full rounded-xl bg-card border border-border pl-10 pr-10 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2">
            {showPassword ? <EyeOff className="w-4 h-4 text-muted-foreground" /> : <Eye className="w-4 h-4 text-muted-foreground" />}
          </button>
        </div>

        {error && (
          <p className="text-sm text-destructive text-center">{error}</p>
        )}

        <motion.button
          whileTap={{ scale: 0.97 }}
          type="submit"
          disabled={loading}
          className="w-full rounded-xl gradient-primary py-3 font-display font-bold text-primary-foreground neon-glow disabled:opacity-50"
        >
          {loading ? "..." : isLogin ? "SE CONNECTER" : "S'INSCRIRE"}
        </motion.button>

        <div className="flex items-center gap-3 py-1">
          <span className="h-px flex-1 bg-border" />
          <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">ou</span>
          <span className="h-px flex-1 bg-border" />
        </div>

        <motion.button
          whileTap={{ scale: 0.97 }}
          type="button"
          onClick={handleGoogle}
          disabled={googleLoading}
          className="w-full rounded-xl bg-card border border-border py-3 font-semibold text-sm text-foreground flex items-center justify-center gap-3 hover:bg-muted/50 transition-colors disabled:opacity-50"
        >
          <svg className="w-4 h-4" viewBox="0 0 48 48" aria-hidden="true">
            <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.9 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.4-.4-3.5z"/>
            <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
            <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.1-11.3-7.5l-6.5 5C9.6 39.6 16.2 44 24 44z"/>
            <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.2-4.1 5.6l6.2 5.2C39.9 35.9 44 30.6 44 24c0-1.2-.1-2.4-.4-3.5z"/>
          </svg>
          {googleLoading ? "Connexion..." : "Continuer avec Google"}
        </motion.button>


        <p className="text-center text-sm text-muted-foreground">
          {isLogin ? "Pas de compte ?" : "Déjà un compte ?"}{" "}
          <button type="button" onClick={() => { setIsLogin(!isLogin); setError(null); }} className="text-primary font-semibold">
            {isLogin ? "S'inscrire" : "Se connecter"}
          </button>
        </p>
      </motion.form>
    </div>
  );
}
