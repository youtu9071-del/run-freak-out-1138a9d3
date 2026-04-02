import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { ChevronRight, User, Dumbbell, Target } from "lucide-react";

interface QuestionOption {
  value: string;
  label: string;
  emoji: string;
  description: string;
}

interface Question {
  id: string;
  title: string;
  subtitle: string;
  icon: any;
  options: QuestionOption[];
}

const questions: Question[] = [
  {
    id: "gender",
    title: "Tu es...",
    subtitle: "Dis-nous en plus sur toi",
    icon: User,
    options: [
      { value: "homme", label: "Homme", emoji: "🙋‍♂️", description: "Je suis un homme" },
      { value: "femme", label: "Femme", emoji: "🙋‍♀️", description: "Je suis une femme" },
    ],
  },
  {
    id: "fitness_level",
    title: "Ton niveau ?",
    subtitle: "On adapte l'expérience pour toi",
    icon: Dumbbell,
    options: [
      { value: "debutant", label: "Débutant", emoji: "🌱", description: "Je découvre le fitness" },
      { value: "intermediaire", label: "Intermédiaire", emoji: "💪", description: "Activités faciles à modérées" },
      { value: "avance", label: "Avancé", emoji: "🔥", description: "J'aime me dépasser" },
      { value: "pro", label: "Pro", emoji: "🏆", description: "Athlète professionnel(le)" },
    ],
  },
  {
    id: "goal",
    title: "Ton objectif ?",
    subtitle: "On te guide vers la réussite",
    icon: Target,
    options: [
      { value: "perdre_poids", label: "Perdre du poids", emoji: "⚡", description: "Brûler des calories et s'affiner" },
      { value: "endurance", label: "Endurance", emoji: "🏃", description: "Courir plus loin, plus longtemps" },
      { value: "performance", label: "Performance", emoji: "🚀", description: "Battre mes records" },
      { value: "bien_etre", label: "Bien-être", emoji: "🧘", description: "Me sentir bien dans mon corps" },
    ],
  },
];

export default function Onboarding() {
  const navigate = useNavigate();
  const { user, refreshProfile } = useAuth();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const currentQuestion = questions[step];
  const progress = ((step + 1) / questions.length) * 100;

  const handleSelect = async (value: string) => {
    const newAnswers = { ...answers, [currentQuestion.id]: value };
    setAnswers(newAnswers);

    if (step < questions.length - 1) {
      setTimeout(() => setStep(step + 1), 300);
    } else {
      setSaving(true);
      await supabase
        .from("profiles")
        .update({
        gender: newAnswers.gender as any,
          fitness_level: newAnswers.fitness_level as any,
          goal: newAnswers.goal as any,
          onboarding_completed: true,
        })
        .eq("user_id", user?.id);
      await refreshProfile();
      setSaving(false);
      navigate("/");
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background px-6 pt-12 pb-8">
      {/* Progress */}
      <div className="w-full max-w-sm mx-auto mb-8">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs text-muted-foreground font-medium">{step + 1}/{questions.length}</p>
          <p className="text-xs text-primary font-bold">{Math.round(progress)}%</p>
        </div>
        <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
          <motion.div
            className="h-full rounded-full gradient-primary"
            animate={{ width: `${progress}%` }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
          />
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 60 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -60 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="flex-1 flex flex-col items-center max-w-sm mx-auto w-full"
        >
          {/* Icon */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", delay: 0.1 }}
            className="w-20 h-20 rounded-2xl gradient-primary flex items-center justify-center mb-6 neon-glow-strong"
          >
            <currentQuestion.icon className="w-10 h-10 text-primary-foreground" />
          </motion.div>

          <h1 className="font-display font-black text-3xl text-foreground text-center mb-2">
            {currentQuestion.title}
          </h1>
          <p className="text-sm text-muted-foreground text-center mb-8">
            {currentQuestion.subtitle}
          </p>

          {/* Options */}
          <div className="w-full space-y-3">
            {currentQuestion.options.map((option, i) => (
              <motion.button
                key={option.value}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 + i * 0.08 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => handleSelect(option.value)}
                disabled={saving}
                className={`w-full rounded-2xl bg-card border p-4 flex items-center gap-4 text-left transition-all ${
                  answers[currentQuestion.id] === option.value
                    ? "border-primary neon-glow"
                    : "border-border hover:border-primary/30"
                }`}
              >
                <span className="text-3xl">{option.emoji}</span>
                <div className="flex-1">
                  <p className="font-display font-bold text-foreground">{option.label}</p>
                  <p className="text-xs text-muted-foreground">{option.description}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </motion.button>
            ))}
          </div>
        </motion.div>
      </AnimatePresence>

      {saving && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 bg-background/80 flex items-center justify-center z-50"
        >
          <div className="text-center">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
              className="w-12 h-12 rounded-full border-4 border-muted border-t-primary mx-auto mb-4"
            />
            <p className="font-display font-bold text-foreground">Préparation en cours...</p>
          </div>
        </motion.div>
      )}
    </div>
  );
}
