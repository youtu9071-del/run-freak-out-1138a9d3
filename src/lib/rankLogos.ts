import rookie1 from "@/assets/ranks/rookie-1.png";
import rookie2 from "@/assets/ranks/rookie-2.png";
import rookie3 from "@/assets/ranks/rookie-3.png";
import guerrier1 from "@/assets/ranks/guerrier-1.png";
import guerrier2 from "@/assets/ranks/guerrier-2.png";
import guerrier3 from "@/assets/ranks/guerrier-3.png";
import machine1 from "@/assets/ranks/machine-1.png";
import machine2 from "@/assets/ranks/machine-2.png";
import machine3 from "@/assets/ranks/machine-3.png";
import freak1 from "@/assets/ranks/freak-1.png";
import freak2 from "@/assets/ranks/freak-2.png";
import freak3 from "@/assets/ranks/freak-3.png";
import freakMaster from "@/assets/ranks/freak-master.png";

export const RANK_LOGOS: Record<string, string> = {
  "ROOKIE I": rookie1,
  "ROOKIE II": rookie2,
  "ROOKIE III": rookie3,
  "GUERRIER DES PAVÉS I": guerrier1,
  "GUERRIER DES PAVÉS II": guerrier2,
  "GUERRIER DES PAVÉS III": guerrier3,
  "MACHINE DE GUERRE I": machine1,
  "MACHINE DE GUERRE II": machine2,
  "MACHINE DE GUERRE III": machine3,
  "FREAK I": freak1,
  "FREAK II": freak2,
  "FREAK III": freak3,
  "FREAK MASTER": freakMaster,
};

export const RANK_DESCRIPTIONS: Record<string, string> = {
  "ROOKIE I": "Première foulée. Tu viens d'entrer dans l'arène — montre de quoi tu es fait.",
  "ROOKIE II": "Tu prends tes marques. Chaque kilomètre te forge un peu plus.",
  "ROOKIE III": "Le bouclier du débutant t'appartient. Tu n'es plus un simple novice.",
  "GUERRIER DES PAVÉS I": "Le bitume tremble sous tes pas. Tu rejoins les guerriers de la rue.",
  "GUERRIER DES PAVÉS II": "Battes croisées : tu défies la ville et personne ne t'arrête.",
  "GUERRIER DES PAVÉS III": "Lame circulaire. Vitesse et précision : tu domines le pavé.",
  "MACHINE DE GUERRE I": "Tu deviens une lame affûtée. La douleur n'a plus de prise.",
  "MACHINE DE GUERRE II": "Vitesse pure. Tes foulées découpent l'air comme une chaussure laser.",
  "MACHINE DE GUERRE III": "Chronomètre ailé : le temps lui-même travaille pour toi.",
  "FREAK I": "Le loup sauvage s'éveille. Tu cours par instinct, par rage.",
  "FREAK II": "Couronne royale. Tu règnes sur la piste et tu le sais.",
  "FREAK III": "Démon infernal. Plus rien d'humain dans ta cadence.",
  "FREAK MASTER": "Le crâne enflammé. Légende vivante. Personne ne te rattrapera.",
};
