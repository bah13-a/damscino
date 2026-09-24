# Intégration de Damascino Privilèges dans la caisse

Ce document s'adresse à l'éditeur ou à l'intégrateur du logiciel de caisse de Damascino. Il décrit comment la
caisse applique elle-même l'avantage « Damascino Privilèges » (−20 % sur un plat éligible) sur le ticket du client.

- Spécification technique : [`api-caisse/openapi.yaml`](api-caisse/openapi.yaml) (OpenAPI 3, importable dans
  Postman, Insomnia ou Swagger UI).
- Environnement de test : `https://damascino-privileges.onrender.com` (adresse à confirmer par Damascino).
- Outil de recette : **Administration → Caisses → Simulateur de caisse**, qui fait exactement les appels attendus
  et affiche les requêtes et réponses JSON.

## 1. Parcours en caisse

```
Commande saisie ─► QR du client scanné (douchette 2D) ─► POST /api/pos/v1/preview
                                                         ◄─ VALID : ligne « Damascino Privilèges −20 % … −8,000 DT »
                                                         ◄─ REFUSED : message à afficher au caissier
Paiement ────────────────────────────────────────────► POST /api/pos/v1/confirm   (passage enregistré)
Annulation / remboursement du ticket ────────────────► POST /api/pos/v1/cancel    (avantage rendu au client)
```

Exemple du cahier des charges : eau 4 DT + Azmari Kebab 40 DT + kunafa 15 DT = 59 DT. La caisse reçoit
« −8,000 DT sur la ligne Azmari Kebab », le client paie 51 DT.

## 2. Mise en place

| # | Action | Qui |
|---|---|---|
| 1 | Créer un **poste de caisse** par caisse physique : Administration → Caisses → « Ajouter la caisse ». La clé d'API (`dpk_…`) n'est affichée qu'une fois : la transmettre à l'éditeur par un canal sûr | Damascino |
| 2 | Déclarer les **articles** si la caisse n'envoie pas la catégorie de chaque ligne : référence → catégorie (Plats, Boissons, Desserts…), un par un ou par import CSV `référence;libellé;catégorie` | Damascino |
| 3 | Brancher une **douchette 2D** (lecture des QR codes) sur chaque caisse | Damascino |
| 4 | Développer les 3 appels ci-dessous dans la caisse, et tester avec `GET /api/pos/v1/ping` | Éditeur |
| 5 | Recette avec le simulateur et de vrais comptes de test (voir §6) | Tous |
| 6 | Pilote sur une caisse, puis déploiement sur les autres | Damascino |

## 3. Les appels

Toutes les requêtes sont en HTTPS et en JSON, avec l'en-tête `X-Api-Key: dpk_…`.

### `POST /api/pos/v1/preview` — au scan du QR code

```json
{
  "code": "DP1.eyJiIjoiNTIz…",
  "ticketId": "T-2026-000123",
  "cashier": "Sami",
  "lines": [
    { "lineId": "1", "sku": "EAU-50",  "label": "Eau 0,5 L",    "category": "BOISSONS", "unitPrice": 4.000,  "quantity": 1 },
    { "lineId": "2", "sku": "KEB-AZM", "label": "Azmari Kebab", "category": "PLATS",    "unitPrice": 40.000, "quantity": 1 },
    { "lineId": "3", "sku": "DES-KUN", "label": "Kunafa",       "category": "DESSERTS", "unitPrice": 15.000, "quantity": 1 }
  ]
}
```

Réponse `VALID` : ajouter au ticket une ligne de remise de `discount.amount` (libellé conseillé :
« Damascino Privilèges −20 % – Azmari Kebab ») et mémoriser `reservationId`.

```json
{
  "status": "VALID",
  "reservationId": "3f0c2a4e-8d6b-4a7e-9d51-0b2f5a8c1e77",
  "reservedUntil": "2026-09-24T11:45:00Z",
  "beneficiary": { "name": "Amira Ben Salah", "partner": "Mall of Sfax" },
  "discount": { "lineId": "2", "label": "Azmari Kebab", "category": "PLATS", "unitPrice": 40.0, "percent": 20, "amount": 8.0 },
  "totalBefore": 59.0,
  "totalAfter": 51.0
}
```

Réponse `REFUSED` : afficher `message` au caissier, sans remise. Le nom du bénéficiaire est renvoyé quand il est
connu, pour limiter le prêt d'accès.

### `POST /api/pos/v1/confirm` — au paiement

```json
{ "reservationId": "3f0c2a4e-…", "ticketId": "T-2026-000123", "paidAt": "2026-09-24T11:32:10Z" }
```

Réponse `CONFIRMED`, avec un `validationCode` à 6 chiffres qui peut être imprimé sur le ticket.

### `POST /api/pos/v1/cancel` — ticket annulé ou remboursé

```json
{ "ticketId": "T-2026-000123", "reason": "Remboursement" }
```

Réponse `CANCELLED`, ou `NOTHING_TO_CANCEL` si aucune remise Damascino n'existe sur ce ticket.

## 4. Règles à respecter

| Règle | Détail |
|---|---|
| **Réservation** | Le QR code du client n'est valable que 40 s (anti-capture d'écran), mais un ticket peut rester ouvert. `preview` réserve l'avantage pour le ticket pendant **15 min** ; `confirm` fonctionne même si le QR a expiré entre-temps. Sans confirmation, la réservation expire et l'avantage est rendu. |
| **Ticket modifié** | Rappeler `preview` avec le même `ticketId` et le même QR : la remise est recalculée sur la même réservation. |
| **Un avantage par ticket** | Un second QR sur le même ticket est refusé (`TICKET_ALREADY_DISCOUNTED`). |
| **Choix du plat** | Un seul plat remisé : le plus cher parmi les catégories éligibles (Plats), hors catégories exclues (Boissons, Desserts). La caisse peut imposer une ligne avec `preferredLineId`. Règles configurables par partenaire dans l'administration. |
| **Catégories** | Envoyer `category` si la caisse la connaît ; sinon la référence (`sku`) doit être déclarée dans Administration → Caisses. Une ligne sans catégorie connue n'est jamais remisée. |
| **Idempotence** | `confirm` et `cancel` peuvent être rejoués sans risque (coupure réseau) : même réponse, pas de double passage. |
| **Montants** | En dinars, arrondis au millime (3 décimales), prix TTC. |
| **Délais** | Prévoir un délai d'attente de 10 s. En test sur l'offre gratuite de Render, le premier appel après une période d'inactivité peut prendre jusqu'à 1 min. |
| **Sans internet** | La caisse ne peut pas valider l'avantage. Politique à décider par Damascino : pas de remise, ou validation avec la tablette « Espace personnel » (mode de secours) et saisie manuelle de la remise avec le code de validation. |

## 5. Motifs de refus

| `reason` | Message | Conduite à tenir |
|---|---|---|
| `INVALID_QR` | QR code invalide | Ce n'est pas un QR Damascino Privilèges |
| `QR_EXPIRED` | QR code expiré | Demander au client d'afficher le code actuel (il change toutes les 30 s) |
| `QR_ALREADY_USED` | QR code déjà utilisé | Code déjà présenté sur un autre ticket |
| `SESSION_REPLACED` | Compte connecté sur un autre appareil | Le client doit se reconnecter |
| `UNKNOWN_ACCOUNT` | Compte inconnu | — |
| `BENEFICIARY_INACTIVE` | Bénéficiaire désactivé | — |
| `PARTNER_INACTIVE` | Partenaire inactif | — |
| `CONVENTION_NOT_STARTED` / `CONVENTION_EXPIRED` | Convention hors période | — |
| `QUOTA_REACHED` | Avantage déjà utilisé pour cette période | 1 plat par jour (règle V1) |
| `NO_ELIGIBLE_ITEM` | Aucun plat éligible sur ce ticket | Le QR reste utilisable, ajouter un plat puis rescanner |
| `TICKET_ALREADY_DISCOUNTED` | Remise déjà appliquée sur ce ticket | Un seul avantage par ticket |
| `RESERVATION_NOT_FOUND` / `RESERVATION_EXPIRED` | Réservation introuvable ou expirée | Rescanner le QR code du client |

Codes HTTP : `401` pour une clé absente, invalide ou révoquée ; `400` pour une requête invalide (aucune ligne, n° de
ticket manquant). Toutes les autres réponses sont en `200` avec `status`.

## 6. Recette

1. Créer un poste « Caisse recette » et un bénéficiaire de test (Administration).
2. Sur un téléphone, se connecter à `/connexion` avec ce bénéficiaire et ouvrir « Utiliser mon avantage ».
3. Côté caisse, dérouler les cas suivants, chacun étant vérifié dans Administration → Utilisations (canal
   « Caisse », n° de ticket, plat remisé) et Journal :

| Cas | Résultat attendu |
|---|---|
| Ticket eau + kebab + kunafa | −8 DT sur le kebab, total 51 DT, passage enregistré au paiement |
| Même QR rescanné sur un autre ticket | `QR_ALREADY_USED` |
| Deuxième passage le même jour | `QUOTA_REACHED` |
| Ticket boissons + desserts uniquement | `NO_ELIGIBLE_ITEM` |
| Ticket modifié puis rescanné | Remise recalculée (ex. mixed grill 52 DT → −10,400 DT) |
| Confirmation envoyée deux fois | Un seul passage, même `validationCode` |
| Ticket remboursé → `cancel` | Passage « Annulé », le client peut de nouveau utiliser son avantage |
| Clé révoquée dans l'administration | `401` |

## 7. Si la caisse ne peut pas appeler d'API

- **Remise assistée** : le caissier valide le QR avec la tablette « Espace personnel » (déjà disponible), applique
  dans la caisse une remise « Damascino Privilèges 20 % » créée une fois pour toutes, et reporte sur le ticket le
  **code de validation** à 6 chiffres affiché par la tablette. L'export des utilisations (Excel ou CSV, avec ce
  code) permet de rapprocher chaque jour les remises de la caisse et les passages validés.
- **Caisse avec API de lecture des ventes** (sans remise en direct) : même principe, avec un rapprochement
  automatique des tickets à développer selon l'API de l'éditeur.
