# Concours AUTHENTIQUE HOMME

Plateforme du concours AUTHENTIQUE HOMME — *La Parole de Dieu face aux réalités de l’homme.*
Ministère Porteur d’Amour · 3 Jours de Reconnaissance 2026.

- Page publique du concours : principe, sujet, étapes, travaux, évaluation, récompenses, règlement, candidats.
- Inscription en 4 étapes avec photo, contrôle automatique des conditions, numéro unique `AH26-XXXXXX`.
- Back-office `/admin` : candidatures (statuts Conforme / Non conforme / À vérifier / En attente / Présélectionné / Refusé, commentaires internes, recherche par nom ou église), photos privées, comptes du comité.
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
2. Relie-le au projet : la variable `BLOB_READ_WRITE_TOKEN` est ajoutée automatiquement.

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

## Prochaines étapes (cahier des charges)

- Espace candidat sécurisé et téléchargement du dossier PDF (§7)
- Gestion des travaux reçus par WhatsApp (§8)
- Fiches publiques des dix candidats (§9)
- Vote public avec code SMS (§10) — nécessite un fournisseur d’envoi de SMS
- Espace jury, calcul 80 / 20 et résultats (§11 à §14)
