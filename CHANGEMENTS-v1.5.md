# Boutique Telegram — v1.5 : architecture des changements

Le fichier unique `server.js` est conservé (même déploiement Render : on remplace `server.js` + `package.json`, rien à installer).
Aucune dépendance ajoutée. Le design néon existant est réutilisé (classes `glass`, `btn`, `sec card`, etc.).

## Vue d'ensemble

```
data/db.json
 ├─ settings      + signal, orderChannels {whatsapp, signal}, countryCode
 ├─ news[]        NOUVEAU  {id, title, body, image, link, tag, date, pinned, published}
 ├─ notices[]     NOUVEAU  {id, text, type, link, active, popup, until}
 ├─ customers{}   NOUVEAU  clé = "+33612345678" → {name, firstSeen, lastSeen, orders, total, channel, telegram, optIn}
 ├─ visits.days{} NOUVEAU  "2026-10-05" → {u: uniques, v: ouvertures, t: via Telegram, ids: [empreintes]}
 └─ orders[]      + channel, optIn, customer.phoneIntl

API publique                         API admin (Bearer)
GET  /api/shop   (+news, notices, channels)   PUT  /api/admin/news | /api/admin/notices
GET  /api/feed   (sondage 60 s)               GET  /api/admin/stats
POST /api/visit                               GET  /api/admin/customers?from&to&optIn
POST /api/order  (+channel, optIn)            DELETE /api/admin/customers/:phone
GET  /api/export/:jeton (5 min)               POST /api/admin/export-link {format: csv|txt|vcf}
```

Migration automatique : au premier démarrage, les collections manquantes sont créées et le fichier clients est **rempli à partir des commandes déjà existantes**.

---

## 1. Page News

**Serveur** : collection `news` normalisée par `normNews` (titre ≤100, texte ≤3000, image, lien https, type `news|promo|update`, date, épinglée, publiée). `publicFeed()` ne renvoie que les news publiées, épinglées d'abord puis par date.

**Client** : 5ᵉ onglet « News » dans la barre du bas (`index.html`, grille passée à 5 colonnes) ; `vNews()` affiche l'historique complet. Badge = nombre de news plus récentes que la dernière lue (`localStorage.newsSeen`).

**Admin** : onglet 📰 News — ajouter (en haut de liste), réordonner, épingler, dépublier, image et lien optionnels.

## 2. Notifications sur l'accueil

- Bandeaux sous l'en-tête, colorés par type (📢 info, 🔥 promo, ⚠️ alerte), fermables (mémorisé par client).
- **Pop-up** : affichée en grand une seule fois par client au démarrage.
- **Date de fin** : la notification disparaît automatiquement après le jour indiqué.
- **Temps réel** : `pollFeed()` interroge `/api/feed` toutes les 60 s (seulement si l'app est visible, et immédiatement au retour au premier plan). Une nouvelle notification apparaît sans recharger, avec une alerte et une vibration.

Choix technique : du sondage plutôt que des WebSockets, parce que Render gratuit met le service en veille et que `/api/feed` est minuscule. Ça suffit pour des annonces.

## 3. Commande WhatsApp ou Signal

**Admin → Général** : numéro Signal (ou lien `signal.me` d'un pseudo), cases pour activer chaque canal, indicatif pays.

**Panier** : sélecteur « Recevoir ma commande via » (choix mémorisé). Avec un seul canal actif, le sélecteur est masqué. Le bouton devient « Commander via WhatsApp » (vert) ou « via Signal » (bleu).

**Redirections** :

| Canal | Lien | Fonctionnement |
|---|---|---|
| WhatsApp | `https://wa.me/<num>?text=<récap>` | inchangé : message pré-rempli, ouverture automatique |
| Signal | `https://signal.me/#p/+<num>` | Signal **n'accepte pas de texte pré-rempli** : le récapitulatif est copié dans le presse-papiers, puis Signal s'ouvre ; le client colle et envoie (2 étapes expliquées à l'écran + bouton « Copier » de secours) |

Dans Telegram, les liens passent par `Telegram.WebApp.openLink` (navigateur externe → app). Le canal choisi figure dans le message de commande, dans la copie Telegram admin et dans l'onglet Commandes (avec des boutons « WhatsApp client » / « Signal client »).

## 4. Suivi des visiteurs

- Identifiant visiteur : ID Telegram vérifié (signature `initData`) si disponible, sinon un identifiant aléatoire stocké sur l'appareil, et en dernier recours IP + navigateur.
- Il est **haché** (SHA-256 tronqué) : aucune IP ni ID en clair n'est enregistré.
- Un unique par jour et par appareil ; « ouvertures » = lancements de l'app (au plus 1 toutes les 30 min). L'aperçu du panel admin n'est pas compté.
- Jours calculés dans le fuseau `TZ` (Europe/Paris), semaine du lundi au jour courant.
- Uniques **semaine / mois** dédoublonnés (un client venu 5 jours compte 1). Empreintes conservées 62 jours, totaux journaliers conservés pour toujours.
- **Performance** : les visites sont gardées en mémoire (Set par jour) et écrites sur disque toutes les 30 s, plus une sauvegarde à l'arrêt (SIGTERM de Render). Aucune écriture disque par visite.

**Admin → 📊 Visites** (onglet d'ouverture) : cartes Aujourd'hui (évolution vs hier) / Hier / Semaine (vs semaine passée) / Mois, histogramme 30 jours, tableau jour par jour avec la part Telegram.

## 5. Fichier des numéros clients

- `upsertCustomer()` est appelé à chaque commande : numéro normalisé au format international (`06 12…` → `+336 12…`, `0033…` → `+33…`), dédoublonné. Un même client = une ligne avec le nombre de commandes et le total.
- Les numéros restent même si la commande est supprimée (les commandes sont limitées à 5 000).
- Case **« J'accepte de recevoir les promotions »** dans le panier → colonne/filtre « Accepte les offres ».

**Admin → 📇 Clients** : compteurs, liste groupée par jour de collecte, recherche, suppression d'un numéro, filtres de dates.

**Téléchargements** (respectent les filtres, triés du plus récent au plus ancien) :

- **Excel (CSV)** : séparateur `;` + BOM UTF-8, ouvre directement dans Excel FR avec les accents. Colonnes : date de collecte, téléphone, nom, nb commandes, total €, dernière commande, canal, Telegram, accepte les offres, saisie d'origine.
- **Texte** : un numéro par ligne.
- **vCard** : import direct dans les contacts du téléphone (pratique pour les listes de diffusion).

Le téléchargement passe par un **lien signé valable 5 min** (`POST /api/admin/export-link`). C'est ce qui le rend possible depuis le panel ouvert dans Telegram (`WebApp.downloadFile`, ou ouverture dans le navigateur), où un téléchargement classique ne fonctionne pas.

---

## Étapes de mise en production

1. Remplacez `server.js` et `package.json` dans le dépôt GitHub (Upload files → Commit).
2. Render redéploie seul. Vérifiez la version : Admin → Intégrations → `1.5 — news, notifications, Signal, visites, clients`.
3. Admin → **Général** : renseignez le numéro Signal, vérifiez l'indicatif pays (33 par défaut) et les canaux actifs → Enregistrer.
4. Admin → **Notifications** puis **News** : créez un premier contenu, puis vérifiez-le dans la boutique.
5. Passez une commande test via chaque canal, puis contrôlez Admin → Clients → Excel (CSV).

## Points d'attention

- **Persistance** : sur Render gratuit (sans disque), `data/db.json` est remis à zéro à chaque redémarrage. Visites, news, notifications et numéros seraient perdus, comme les commandes aujourd'hui. Ajoutez un disque persistant monté sur le dossier `data`, ou téléchargez la liste clients régulièrement.
- **RGPD** : garder les numéros pour traiter les commandes est normal. Pour envoyer des promotions, n'utilisez que les clients « Accepte les offres » (filtre prévu) et supprimez un numéro sur demande (bouton ✕).
- **Volume** : les visites ne coûtent rien en disque. Le fichier clients est un dictionnaire (recherche instantanée) ; l'affichage admin est limité aux 2 000 plus récents, mais l'export contient tout. Au-delà de quelques dizaines de milliers de commandes, passer à SQLite serait l'étape suivante.
- Le nom de la boutique intégré est encore « SAM COFFEE SHOP » : changez-le en « Dan Kush » dans Admin → Général.
