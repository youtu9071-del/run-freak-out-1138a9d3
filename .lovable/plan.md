# Plan d'implémentation

Ce plan couvre 5 chantiers majeurs. Beaucoup de logique est déjà partiellement présente — je vais étendre l'existant plutôt que tout recréer.

## 1. PWA — Bouton "Installer" qui ne fonctionne pas sur téléphone

**Cause probable** : manifest incomplet (pas d'icônes valides 192/512), service worker absent ou non enregistré, ou `beforeinstallprompt` mal capturé. Sur mobile, Chrome exige un SW + manifest valide + HTTPS.

**Actions** :
- Vérifier/compléter `public/manifest.json` : `name`, `short_name`, `start_url`, `display: "standalone"`, `theme_color`, `background_color`, icônes 192x192 et 512x512 (PNG, type correct).
- Créer un service worker minimal (`public/sw.js`) et l'enregistrer dans `main.tsx`.
- Vérifier `InstallPrompt.tsx` : sauvegarder l'événement `beforeinstallprompt` et appeler `prompt()` au clic.
- Ajouter fallback iOS (instructions "Ajouter à l'écran d'accueil" via partage Safari).

## 2. Notifications — Badge sur l'onglet Profil

**Actuel** : la cloche en haut affiche un compteur, mais l'onglet "Profil" du `BottomNav` n'a pas d'indicateur.

**Actions** :
- Dans `BottomNav.tsx`, écouter le nombre de notifications non lues du user et afficher une pastille rouge avec compteur sur l'icône Profil.
- Realtime via la souscription Supabase déjà utilisée.

## 3. Défis d'équipe — "Mise FP par membre" au lieu de "Récompense FP"

**Changements DB** :
- Ajouter `stake_fp` (NUMERIC) sur `challenges` (mise par membre).
- Plafond distance : contrainte/validation `distance_km <= 10`.
- Mettre à jour `start_team_challenge(p_team_id, p_distance_km, p_stake_fp, p_end_date)` :
  - vérifier `distance_km <= 10`
  - prélever `stake_fp` à chaque membre accepté de team A (vérifier solde suffisant pour TOUS, sinon échec)
  - stocker dans un coffre (champ `coffre_amount` sur challenges)
- `accept_team_challenge` : prélever `stake_fp` à chaque membre de team B, ajouter au coffre.
- `finalize_team_challenge` : à la fin, garder `coffre_fee` (1 FP) côté plateforme, distribuer le reste aux gagnants (réparti par membre).

**Changements UI** (`Challenges.tsx`) :
- Renommer champ "Récompense FP" → "Mise FP par membre".
- Distance max 10 km (input max=10).
- Afficher le coffre et son montant total dans la carte du défi.

## 4. Défis 1v1 sécurisés avec coffre par niveau

**Niveaux & mises minimales** : ROOKIE I=5, ROOKIE II=10, STREET RACER=15, PRO RACER=20, ELITE RACER=30, LEGEND RACER=40, FREAK MASTER=50.

**Tables / colonnes** :
- Étendre `challenge_invites` ou créer table `duel_challenges` :
  - `challenge_level` TEXT
  - `fp_required` NUMERIC
  - `coffre_amount` NUMERIC
  - `coffre_fee` NUMERIC (default 1)
  - `winner_reward` NUMERIC
  - `challenge_status` TEXT (pending/accepted/completed/cancelled)
  - `challenger_rank`, `opponent_rank` TEXT

**Fonctions sécurisées (SECURITY DEFINER)** :
- `create_duel(p_opponent, p_distance, p_level)` :
  - calcule `fp_required` selon `p_level`
  - vérifie le rang du challenger >= niveau OU FP suffisants pour niveau supérieur (règle "Rookie I peut défier Freak Master s'il a 50 FP")
  - prélève les FP du challenger → coffre
  - crée l'invitation
- `accept_duel(p_invite_id)` :
  - vérifie solde adversaire >= `fp_required`
  - prélève → coffre
  - status = accepted
- `finalize_duel(p_invite_id, p_winner_id)` :
  - winner_reward = coffre - 1
  - crédite gagnant, garde 1 FP plateforme

**UI** :
- Sélecteur de niveau dans le formulaire de défi 1v1.
- Affichage du coffre dans la carte du défi (animation cyberpunk via framer-motion : pulse néon, ouverture du coffre à la fin).
- Section "Mon Coffre / Historique" dans `Profile.tsx`.

## 5. Courses d'équipe — FP par distance + coffre participation

**Tables / colonnes** :
- Étendre `challenges` : `participation_fp` NUMERIC, `coffre_amount` NUMERIC.
- Table existante `challenge_participations` : déjà a `distance_km`, `total_fp`. OK.
- Table `distance_rewards` (optionnelle) : barème km → FP. Réutiliser le calcul existant 10 km = 5 FP.

**Logique** :
- À la création/acceptation : prélever `participation_fp` par membre → coffre.
- À la fin :
  - chaque joueur reçoit FP automatiquement selon sa distance (déjà fait via `total_fp` d'activité).
  - équipe gagnante = bonus = coffre - 1 FP plateforme, réparti.
- Affichage profil : section "Récompenses par distance" + "Bonus d'équipe" séparées.

## Section technique (détails)

**Fichiers à créer/modifier** :
- `supabase/migrations/<new>.sql` : 
  - ALTER `challenges` (stake_fp, coffre_amount, coffre_fee, participation_fp, contrainte distance via trigger pour team challenges)
  - Nouvelle table `duel_challenges` + RLS
  - Fonctions `create_duel`, `accept_duel`, `finalize_duel`, mise à jour `start_team_challenge`, `accept_team_challenge`, `finalize_team_challenge`
  - Trigger de validation distance <= 10 sur team challenges (pas CHECK)
- `public/manifest.json`, `public/sw.js`, `src/main.tsx`, `src/components/InstallPrompt.tsx`
- `src/components/BottomNav.tsx` : badge notif sur Profil
- `src/pages/Challenges.tsx` : mise FP, distance max 10, sélecteur niveau 1v1, coffre UI animé
- `src/pages/Profile.tsx` : section coffre + historique défis
- `src/components/CoffreAnimation.tsx` (nouveau) : animation cyberpunk

**Sécurité** :
- Toutes les opérations FP via fonctions SECURITY DEFINER (verrouillage `FOR UPDATE` sur profile).
- RLS strictes sur duel_challenges.
- Validation des rangs côté serveur.

## Question avant de lancer

Le périmètre est gros (~5 migrations + ~8 fichiers UI). Je propose de procéder dans cet ordre, en validant à chaque étape : (1) PWA install + badge notif Profil, (2) défis équipe mise FP + coffre + distance 10km, (3) défis 1v1 sécurisés par niveau, (4) courses d'équipe FP par distance.

Confirme et je commence par l'étape 1, ou dis-moi si tu veux changer l'ordre / regrouper.