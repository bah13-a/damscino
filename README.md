# Damascino Privilèges

Plateforme web mobile (PWA) du programme d'avantages Damascino : les collaborateurs des entreprises partenaires
bénéficient de **−20 % sur un plat éligible par jour**, sur présentation d'un **QR code personnel renouvelé toutes
les 30 secondes**.

| Espace | URL | Pour qui |
|---|---|---|
| Bénéficiaire | `/connexion` → `/espace` | Collaborateurs des partenaires (identifiant = téléphone) |
| Personnel | `/personnel` → `/personnel/scanner` | Serveurs / caissiers (identifiant + code PIN) |
| Administration | `/admin/connexion` → `/admin` | Équipe Damascino |

## Architecture

Microservices **Spring Boot 3 / Java 21** organisés en **CQRS** et communiquant par **événements** (RabbitMQ,
pattern *transactional outbox*), avec un front **React / Next.js 14** installable (PWA).

```mermaid
flowchart LR
  PWA["PWA Next.js<br/>(3 espaces)"] -- "/api/* (même origine)" --> GW["API Gateway<br/>Spring Cloud Gateway"]
  GW --> ID["identity-service<br/>comptes, JWT, sessions"]
  GW --> PA["partner-service<br/>partenaires, règles,<br/>bénéficiaires, import"]
  GW --> PR["privilege-service<br/>QR dynamique,<br/>validation en caisse"]
  GW --> RE["reporting-service<br/>statistiques, journaux,<br/>exports (côté lecture)"]
  PA -- événements --> MQ[(RabbitMQ<br/>damascino.events)]
  ID -- événements --> MQ
  PR -- événements --> MQ
  MQ --> ID & PA & PR & RE
  ID & PA & PR & RE --- DB[(PostgreSQL<br/>1 schéma par service)]
```

- **Commandes / requêtes** : chaque service expose ses cas d'usage via un `CommandBus` (écriture) et un `QueryBus`
  (lecture). `reporting-service` est un modèle de lecture dédié, reconstruit uniquement à partir des événements.
- **Outbox** : chaque changement d'état et l'événement correspondant sont écrits dans la même transaction, puis relayés
  vers RabbitMQ ; aucun événement n'est perdu si le broker est indisponible.
- **Une base par service** (schéma PostgreSQL dédié, migrations Flyway) : `identity`, `partner`, `privilege`,
  `reporting`.

Détails : [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Fonctionnalités (V1)

- Import Excel / CSV des bénéficiaires avec contrôle des doublons, génération des identifiants (téléphone) et des
  mots de passe temporaires, export des accès par partenaire, modèle d'import téléchargeable.
- Changement de mot de passe obligatoire à la première connexion, blocage 15 min après 5 échecs, réinitialisation par
  l'administration, **une seule session active** par bénéficiaire.
- QR code signé (HMAC-SHA256), valable 40 s, renouvelé toutes les 30 s, **à usage unique**, révoqué si le compte se
  connecte sur un autre appareil.
- Scanner caméra : écran vert « Avantage valide » / rouge « Refusé » avec motif, saisie facultative du prix du plat,
  confirmation sous verrou (deux scans simultanés ne valident jamais deux fois).
- Règles configurables par partenaire : pourcentage, catégories éligibles / exclues, nombre d'utilisations par jour,
  semaine ou mois (fuseau Africa/Tunis), période de convention.
- Statistiques (autorisés, comptes activés, utilisateurs actifs, passages, remises en DT) filtrables par partenaire,
  période et bénéficiaire ; journal des passages, des refus et des actions d'administration ; exports Excel et CSV.

## Démarrage local

Prérequis : Docker.

```bash
docker compose up --build
```

Ouvrir http://localhost:3000/admin/connexion — identifiant `admin`, mot de passe `Damascino2026!` (changement imposé).
Console RabbitMQ : http://localhost:15672 (guest / guest).

### Sans Docker (développement)

PostgreSQL 16 (base `damascino`, utilisateur `damascino` / `damascino`) et RabbitMQ doivent tourner en local.

```bash
cd backend && mvn install            # build + tests
java -jar identity-service/target/identity-service.jar    # :8081
java -jar partner-service/target/partner-service.jar      # :8082
java -jar privilege-service/target/privilege-service.jar  # :8083
java -jar reporting-service/target/reporting-service.jar  # :8084
java -jar gateway/target/gateway.jar                      # :8080

cd frontend && npm install && npm run dev                 # :3000
```

## Déploiement de test sur Render

Un Blueprint [`render.yaml`](render.yaml) décrit la base PostgreSQL, les 5 services backend (Docker) et le front
(Node). Pas à pas : [docs/DEPLOIEMENT_RENDER.md](docs/DEPLOIEMENT_RENDER.md).

## Configuration

| Variable | Service | Rôle |
|---|---|---|
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | backend | PostgreSQL (`DB_URL_PARAMS` pour ajouter p. ex. `&sslmode=require`) |
| `RABBITMQ_URL` | backend | `amqp://` ou `amqps://user:pass@host/vhost` |
| `JWT_SECRET` | backend | Signature des jetons d'accès (identique pour tous les services) |
| `QR_SECRET` | privilege | Signature des QR codes |
| `CREDENTIALS_SECRET` | partner | Chiffrement AES-GCM des mots de passe temporaires jusqu'à l'activation |
| `ADMIN_USERNAME`, `ADMIN_PASSWORD` | identity | Super-administrateur créé au premier démarrage |
| `IDENTITY_URL`, `PARTNER_URL`, `PRIVILEGE_URL`, `REPORTING_URL` | gateway | Adresses des services |
| `API_URL` | frontend (build) | Adresse de la gateway, utilisée par le proxy `/api/*` |
| `NEXT_PUBLIC_STAFF_IDLE_MINUTES` | frontend | Déconnexion automatique du scanner (défaut 5 min) |

## Tests

```bash
cd backend && mvn verify                 # tests unitaires (règles, QR, import, verrouillage, sessions)
cd frontend && npm run lint && npm run typecheck && npm run build
```

### Tests de bout en bout (Playwright)

36 scénarios sur les trois espaces, contre une stack démarrée (locale ou Render) : connexion et changement de mot
de passe imposé, blocage, droits par rôle, partenaires et règles, catégories, import Excel/CSV et export des accès,
bénéficiaires, comptes, QR renouvelé toutes les 30 s, session unique, **scan par caméra** (QR injecté dans une caméra
simulée), refus (code falsifié, expiré, déjà utilisé, bénéficiaire ou partenaire inactif), quota hebdomadaire,
validations simultanées, déconnexion du scanner après inactivité, statistiques, journaux et exports, PWA et
affichage mobile.

```bash
docker compose up -d --build
cd e2e && npm ci && npx playwright install chromium
npx playwright test                      # E2E_BASE_URL=https://damascino-privileges.onrender.com pour Render
npx playwright show-report
```

Les tests créent leurs propres données (noms uniques) ; au premier lancement ils remplacent le mot de passe initial
de `admin` par `E2E_ADMIN_PASSWORD` (défaut `Admin-E2E-2026`, mot de passe initial lu dans
`E2E_ADMIN_INITIAL_PASSWORD`).

## Arborescence

```
backend/
  common/             CQRS (bus), événements, outbox, sécurité JWT, exports Excel/CSV
  gateway/            Spring Cloud Gateway
  identity-service/   comptes, authentification, sessions
  partner-service/    partenaires, règles, catégories, bénéficiaires, import
  privilege-service/  QR dynamique, contrôle et validation des passages
  reporting-service/  statistiques, journaux, exports
frontend/             PWA Next.js (espaces bénéficiaire, personnel, administration)
e2e/                  tests de bout en bout Playwright
infra/backup/         sauvegarde PostgreSQL chiffrée quotidienne (rétention 30 jours)
docs/                 architecture, déploiement
```
