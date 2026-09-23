# Déploiement de test sur Render

Le fichier [`render.yaml`](../render.yaml) crée en une fois :

- une base **PostgreSQL** (`damascino-db`) — chaque microservice y crée son propre schéma au démarrage (Flyway) ;
- 5 services **Docker** : `damascino-identity`, `damascino-partner`, `damascino-privilege`, `damascino-reporting`,
  `damascino-gateway` ;
- le front **Node** `damascino-privileges` (Next.js), qui relaie `/api/*` vers la gateway.

Render ne propose pas de RabbitMQ : on utilise l'offre gratuite de **CloudAMQP**.

## 1. RabbitMQ (CloudAMQP)

1. Créer un compte sur https://www.cloudamqp.com, puis une instance **Little Lemur (free)**, région *EU (Frankfurt)*
   ou *EU (Ireland)*.
2. Copier l'**AMQP URL** (`amqps://utilisateur:motdepasse@host.rmq.cloudamqp.com/vhost`).

## 2. Blueprint Render

1. Pousser ce dépôt sur GitHub.
2. Render → **New → Blueprint** → choisir le dépôt → Render lit `render.yaml`.
3. Renseigner les valeurs demandées :
   - `RABBITMQ_URL` : l'URL CloudAMQP ;
   - `ADMIN_PASSWORD` : mot de passe initial du super-administrateur (changement imposé à la première connexion).
   `JWT_SECRET`, `QR_SECRET` et `CREDENTIALS_SECRET` sont générés automatiquement.
4. **Apply**. Le premier build Maven prend quelques minutes par service.

## 3. Vérifier les URL

Chaque service est joignable sur `https://<nom>.onrender.com`. Si Render a ajouté un suffixe à un nom déjà pris
(ex. `damascino-identity-x1y2.onrender.com`), corriger :

- sur `damascino-gateway` : `IDENTITY_URL`, `PARTNER_URL`, `PRIVILEGE_URL`, `REPORTING_URL` ;
- sur `damascino-privileges` : `API_URL` (puis **Manual Deploy → Clear build cache & deploy**, la valeur est prise
  en compte au build).

Contrôle rapide : `https://damascino-gateway.onrender.com/actuator/health` doit répondre `{"status":"UP"}`.

## 4. Premier test

1. `https://damascino-privileges.onrender.com/admin/connexion` → `admin` + `ADMIN_PASSWORD` → nouveau mot de passe.
2. **Comptes** → créer un compte *Personnel scanner* (ex. `caisse1`, PIN `1234`).
3. **Partenaires** → créer « Mall of Sfax » → **Télécharger le modèle** → remplir → **Choisir un fichier**.
4. **Exporter les accès** → se connecter sur un téléphone avec un identifiant / mot de passe temporaire.
5. Sur un autre appareil : `/personnel` → scanner le QR code du téléphone.

La caméra nécessite HTTPS (fourni par Render). La saisie manuelle du code reste possible depuis le scanner.

## Limites de l'offre gratuite (acceptables pour un test)

- Les services s'endorment après 15 min sans trafic ; le premier appel peut prendre ~1 min (la gateway et le proxy
  du front attendent jusqu'à 120 s). Juste après un import, si un service dormait, attendre quelques secondes que les
  événements soient traités avant la première connexion d'un bénéficiaire.
- 750 h d'instance gratuites par mois et par espace de travail, partagées entre les 6 services.
- La base PostgreSQL gratuite expire après 30 jours : pour la production, passer la base et les services sur une
  offre payante (et activer le réseau privé : les URL peuvent alors devenir `http://damascino-identity:10000`, etc.)
  ou utiliser le VPS prévu au cahier des charges avec `docker compose` et [`infra/backup/backup.sh`](../infra/backup/backup.sh).
