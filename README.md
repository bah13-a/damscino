# Damascino Privilèges

Programme d'avantages Damascino : les collaborateurs des entreprises partenaires bénéficient de **−20 % sur un plat
éligible par jour**, sur présentation d'un **QR code personnel renouvelé toutes les 30 secondes**.

| Espace | Où | Pour qui |
|---|---|---|
| Bénéficiaire | **Application mobile** Damascino Privilèges (Android, iPhone) | Collaborateurs des partenaires (identifiant = téléphone) |
| Personnel | **Application mobile** → *Personnel Damascino* | Serveurs / caissiers (identifiant + code PIN) |
| Administration | Site web `/admin/connexion` → `/admin` | Équipe Damascino |

Le site affiche aux bénéficiaires et au personnel la page de téléchargement de l'application ; l'API refuse leur
connexion depuis un navigateur. Détails : [docs/APPLICATION_MOBILE.md](docs/APPLICATION_MOBILE.md).

## Manuel d'utilisation

[docs/manuel/MANUEL_UTILISATION.md](docs/manuel/MANUEL_UTILISATION.md) : guide pas à pas illustré pour l'administrateur,
le personnel de caisse et les bénéficiaires. Captures régénérables sur une base vierge :
`cd e2e && npx playwright test -c playwright.manual.config.ts`.

## Architecture

Microservices **Spring Boot 3 / Java 21** organisés en **CQRS** et communiquant par **événements** (RabbitMQ,
pattern *transactional outbox*), un site **React / Next.js 14** (administration) et une application mobile
**Expo / React Native** (bénéficiaires et personnel).

```mermaid
flowchart LR
  APP["Application mobile<br/>Expo (bénéficiaires, caisse)"] -- "https://…/api/*" --> WEB
  WEB["Site Next.js<br/>(administration)"] -- "/api/* (proxy)" --> GW["API Gateway<br/>Spring Cloud Gateway"]
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
- **Remise saisie dans la caisse existante** (rubrique Remise) : après validation du QR, la tablette indique au
  caissier la remise exacte à saisir (nom, % ou montant, code de validation), et le **rapprochement** compare l'export
  des ventes de la caisse (Excel ou CSV) avec les passages validés : remises sans QR validé, oublis, écarts de montant.
- **Intégration caisse** (optionnelle) : API `/api/pos/v1` (clé d'API par poste de caisse) pour que le logiciel de caisse applique
  lui-même la remise sur le bon plat du ticket, avec réservation le temps du ticket, confirmation idempotente,
  annulation / remboursement, correspondance des articles et simulateur de caisse. Guide pour l'éditeur :
  [docs/INTEGRATION_CAISSE.md](docs/INTEGRATION_CAISSE.md), spécification [OpenAPI](docs/api-caisse/openapi.yaml).
- **Sécurité web** : CSP à nonce, en-têtes anti-clickjacking / anti-sniffing / HSTS, saisies contenant du HTML ou
  du script refusées dans tous les services et les imports, exports CSV protégés contre l'injection de formules,
  limitation des échecs de connexion par adresse ([détails](docs/ARCHITECTURE.md#protections-web-xss-injection-force-brute)).
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

## Déploiement gratuit

Toute la stack (5 services, PostgreSQL, RabbitMQ, front) tient sur une seule machine avec Docker Compose (≈ 3 Go) :

- **GitHub Codespaces** (sans carte bancaire, démarrage automatique, URL HTTPS publique) :
  [ouvrir un Codespace](https://codespaces.new/bah13-a/damscino?ref=claude/serene-faraday-tqmxat) ;
- **Oracle Cloud « Always Free »** (serveur gratuit permanent) : `sudo bash infra/vps/deploy.sh` installe tout,
  avec HTTPS automatique (Caddy) et sauvegarde quotidienne ;
- **PC + tunnel Cloudflare** pour une démo ponctuelle.

Pas à pas : [docs/DEPLOIEMENT_GRATUIT.md](docs/DEPLOIEMENT_GRATUIT.md). Un Blueprint Render
([`render.yaml`](render.yaml), [guide](docs/DEPLOIEMENT_RENDER.md)) reste disponible pour un hébergement payant par service.

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
| `NEXT_PUBLIC_ANDROID_APP_URL`, `NEXT_PUBLIC_IOS_APP_URL` | frontend (build) | Liens de téléchargement de l'application (défaut Android : dernière release GitHub) |
| `SECURITY_MOBILE_ONLY_SPACES` | identity | `true` (défaut) : bénéficiaires et personnel ne se connectent que depuis l'application |
| `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_ALLOW_SERVER_CHANGE`, `EXPO_PUBLIC_STAFF_IDLE_MINUTES` | mobile (build) | Adresse du site, version de test (adresse modifiable), déconnexion du scanner |
| `SECURITY_LOGIN_THROTTLE_MAX_FAILURES`, `SECURITY_LOGIN_THROTTLE_WINDOW` | gateway | Échecs de connexion tolérés par adresse avant refus 429 (défaut 100 en `10m`) |
| `SECURITY_MAX_REQUEST_SIZE` | gateway | Taille maximale d'une requête (défaut `12MB`) |

## Tests

```bash
cd backend && mvn verify                 # tests unitaires (règles, QR, import, verrouillage, sessions)
cd frontend && npm run lint && npm run typecheck && npm run build
cd mobile && npm run typecheck
```

### Tests de bout en bout (Playwright)

54 scénarios sur le site, l'application mobile, la remise en caisse, le rapprochement et l'API caisse, contre une stack démarrée (locale, Codespace ou serveur) : connexion et changement de mot
de passe imposé, blocage, droits par rôle, partenaires et règles, catégories, import Excel/CSV et export des accès,
bénéficiaires, comptes, QR renouvelé toutes les 30 s, session unique, **scan par caméra** (QR injecté dans une caméra
simulée), refus (code falsifié, expiré, déjà utilisé, bénéficiaire ou partenaire inactif), quota hebdomadaire,
validations simultanées, déconnexion du scanner après inactivité, statistiques, journaux et exports, PWA et
affichage mobile, en-têtes de sécurité et CSP (aucune violation), refus des saisies contenant du script, exports
CSV sans formule exécutable.

```bash
docker compose up -d --build
cd e2e && npm ci && npx playwright install chromium
npm run build:app                        # export web de l'application mobile (tests uniquement)
npx playwright test                      # E2E_BASE_URL=https://<adresse> pour un serveur déployé
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
frontend/             site Next.js (administration, pages de téléchargement de l'application)
mobile/               application mobile Expo (bénéficiaires, personnel de caisse)
e2e/                  tests de bout en bout Playwright
infra/backup/         sauvegarde PostgreSQL chiffrée quotidienne (rétention 30 jours)
docs/                 architecture, déploiement
```
