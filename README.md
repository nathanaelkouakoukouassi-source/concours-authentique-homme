# Concours AUTHENTIQUE HOMME

Plateforme du concours AUTHENTIQUE HOMME — *La Parole de Dieu face aux réalités de l’homme.*
Ministère Porteur d’Amour · 3 Jours de Reconnaissance 2026.

- Page publique du concours : principe, sujet, étapes, travaux, évaluation, récompenses, règlement, candidats.
- Inscription en 4 étapes avec photo, contrôle automatique des conditions, numéro unique `AH26-XXXXXX`.
- Back-office `/admin` : candidatures (statuts Conforme / Non conforme / À vérifier / En attente / Présélectionné / Refusé, commentaires internes, recherche par nom ou église), photos privées visibles uniquement par le comité connecté, comptes du comité.
- E-mails : notification au comité, confirmation au candidat.

Technologies : Next.js 16, Payload 3, MongoDB, Vercel Blob, Resend.

---

## Mise en ligne sur Vercel — pas à pas

### 1. Importer le projet

1. Connecte-toi sur [vercel.com](https://vercel.com) avec ton compte GitHub.
2. **Add New… → Project**, choisis le dépôt `concours-authentique-homme`, puis **Import**.
3. Ne clique pas encore sur Deploy : ajoute d’abord la base et le stockage (étapes 2 et 3). Si le déploiement est déjà parti et a échoué, c’est normal, on le relancera.

### 2. Base de données (MongoDB Atlas)

1. Dans le projet Vercel : onglet **Storage → Create Database → MongoDB Atlas**, offre gratuite, région la plus proche (ex. Europe).
2. Relie-la au projet : la variable `MONGODB_URI` est ajoutée automatiquement.

### 3. Stockage des photos (Vercel Blob)

1. Onglet **Storage → Create → Blob**.
2. Choisis l’accès **Private** (les photos des candidats restent privées) et relie-le au projet.

### 4. Variables à saisir

**Settings → Environment Variables**, pour *Production*, *Preview* et *Development* :

| Nom | Valeur |
|---|---|
| `PAYLOAD_SECRET` | facultatif : à défaut, une clé est dérivée automatiquement de `MONGODB_URI` |
| `NEXT_PUBLIC_SITE_URL` | facultatif : à défaut, l’adresse de production Vercel est utilisée |
| `NEXT_PUBLIC_MINISTRY_URL` | l’adresse du site du Ministère (facultatif) |
| `RESEND_API_KEY` | la clé API créée sur [resend.com](https://resend.com) → API Keys |
| `MINISTRY_FROM_EMAIL` | `Concours Authentique Homme <onboarding@resend.dev>` au départ |
| `MINISTRY_DESTINATION_EMAIL` | l’adresse qui reçoit les nouvelles candidatures |

### 5. Déployer

**Deployments → Redeploy** (ou **Deploy** si c’est le premier). Compte quelques minutes.

### 6. Créer ton compte administrateur — tout de suite

Ouvre `https://<ton-site>/admin` : Payload demande de créer le **premier utilisateur**. Fais-le immédiatement après le premier déploiement, car le premier compte créé devient administrateur. Ajoute ensuite les membres du comité dans **Administration → Membres du comité**.

### 7. Tester

1. Fais une inscription test avec ta propre adresse.
2. Vérifie dans `/admin` → **Concours Authentique Homme → Candidatures** qu’elle apparaît avec le statut *Conforme* et sa photo.
3. Refais-la avec la même adresse : la seconde doit passer en *À vérifier* (doublon).
4. Supprime les candidatures de test avant l’ouverture officielle.

---

## E-mails : point important

Avec l’expéditeur de test `onboarding@resend.dev`, Resend n’envoie **qu’à l’adresse de ton compte Resend**. Pour que les candidats reçoivent leur confirmation :

1. Sur Resend : **Domains → Add Domain**, ajoute le domaine du Ministère et copie les enregistrements DNS chez ton hébergeur de domaine.
2. Une fois le domaine vérifié, remplace `MINISTRY_FROM_EMAIL` par par exemple `Concours Authentique Homme <concours@ton-domaine.com>` et redéploie.

Une candidature est **toujours enregistrée**, même si l’envoi d’e-mail échoue.

## Nom de domaine (facultatif)

**Settings → Domains** dans Vercel, ajoute par exemple `concours.ton-domaine.com` et suis les instructions DNS. Mets ensuite à jour `NEXT_PUBLIC_SITE_URL`.

## Réglages du concours

En haut de `src/app/(frontend)/contest-site.tsx`, l’objet `CONTEST_CONFIG` :

- `registrationsOpen` : ouvre ou ferme les inscriptions ;
- `registrationDeadline` : date limite affichée (ex. `'30 novembre 2026'`) ;
- `minimumAge` : âge minimum affiché dans les conditions (ex. `'18 ans'`) ;
- `candidatesPublished` : à passer à `true` quand les dix candidats seront publiés.

Chaque modification poussée sur GitHub est mise en ligne automatiquement par Vercel.

## Développement local

```bash
cp .env.example .env   # puis compléter
pnpm install
pnpm dev               # http://localhost:3000 et /admin
pnpm generate:types    # après une modification des collections
```

## Guide du comité — déroulé du concours

Tout se pilote depuis `/admin` → **Concours Authentique Homme → Pilotage du concours**.

1. **Inscriptions** : onglet « 1. Inscriptions » (ouvrir/fermer, date limite, âge minimum).
2. **Présélection automatique** : l’inscription comprend une épreuve (QCM biblique sur 50 + courte réflexion notée par l’IA sur 50). Fixez la *Clôture automatique des inscriptions* (onglet 1) : à cette date, le système ferme les inscriptions, classe les candidatures *Conforme*, présélectionne les 10 meilleures, publie la liste et envoie les codes. Onglet *Épreuve et sélection* : questions du QCM, consigne de la réflexion, compteurs, journal et bouton *Lancer la sélection maintenant*. Nécessite la variable Vercel `ANTHROPIC_API_KEY` (clé API Claude, console.anthropic.com).
3. **Dossier PDF** : onglet « 2. Présélection et dossier » → *Importer le PDF* (4 Mo max), renseignez la date limite, le WhatsApp officiel et les consignes.
4. **Codes d’accès** : bouton *Notifier les présélectionnés* — chacun reçoit par e-mail son code pour l’espace candidat (`/espace-candidat`), où il télécharge le dossier.
5. **Liste publique** : cochez *Publier la liste des candidats présélectionnés*.
6. **Travaux** : les présélectionnés déposent leur vidéo (80 Mo max) et leur PDF (10 Mo max) dans leur espace candidat ; les fichiers arrivent dans leur fiche (onglet *Travaux* : *Regarder*, *Ouvrir*, *Télécharger*), le statut passe à *Travaux reçus* et le comité est prévenu par e-mail. Ouvrez/fermez le dépôt dans l’onglet « 2. Présélection et dossier ». Pour la fiche publique, renseignez titre, résumé, références, texte intégral et le lien YouTube (non répertorié) de la vidéo, puis passez le statut à *Travaux publiés*. Stockage gratuit limité à 1 Go : un garde-fou refuse les dépôts au-delà.
7. **Vote** : onglet « 3. Vote du public » → *Vote ouvert* (ou dates automatiques). Un vote par adresse e-mail vérifiée par code ; les votes se consultent dans **Votes du public**.
8. **Jury** : créez les jurés dans **Comité et jury** (rôle *Membre du jury*). Chaque juré saisit ses fiches dans **Notes du jury** (phase *Présélection*, puis *Grande finale*).
9. **Résultats** : onglet « 4. Jury et résultats » — classement calculé en direct (80 % jury / 20 % public), verrouillage des délibérations, publication du classement, annonce des 3 finalistes, sujet de la finale, proclamation des lauréats.

Les e-mails (codes candidats, codes de vote, confirmations) partent de la boîte Gmail du Ministère : variables Vercel `GMAIL_USER` (adresse) et `GMAIL_APP_PASSWORD` (mot de passe d’application Google, après activation de la validation en deux étapes). Limite Gmail : environ 500 e-mails par jour. Resend (`RESEND_API_KEY`) reste possible en alternative.
