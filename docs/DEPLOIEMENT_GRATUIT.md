# Déployer gratuitement Damascino Privilèges

L'application complète comprend 5 services Java, PostgreSQL, RabbitMQ et le front Next.js, soit environ 3 Go de
mémoire. Les hébergeurs « gratuits » par service (Render, Koyeb…) donnent 512 Mo par service et limitent le nombre
de services ou demandent une carte bancaire. Le plus simple est donc une **machine unique qui lance tout avec Docker
Compose**.

| Option | Coût | Carte bancaire | Disponible | Idéal pour |
|---|---|---|---|---|
| **1. GitHub Codespaces** | Gratuit (60 h/mois) | Non | Tant que le Codespace est ouvert (arrêt après 30 min d'inactivité) | Démo, recette, tests sur téléphone |
| **2. Oracle Cloud « Always Free »** | Gratuit, sans limite de durée | Oui, pour la vérification d'identité (aucun débit) | 24 h/24 | Pilote avec 1 à 2 partenaires |
| **3. Votre PC + tunnel Cloudflare** | Gratuit | Non | Tant que le PC est allumé | Démo ponctuelle |

Les trois options utilisent le même `docker-compose.yml` : RabbitMQ et PostgreSQL sont inclus, sans CloudAMQP ni base
externe. Toutes donnent une adresse **HTTPS**, nécessaire à la caméra du scanner.

---

## 1. GitHub Codespaces (le plus rapide, sans carte)

1. Ouvrir : **https://codespaces.new/bah13-a/damscino?ref=claude/serene-faraday-tqmxat**
   (ou sur GitHub : bouton **Code → Codespaces → Create codespace on …**).
2. Choisir une machine **2 cœurs / 8 Go** (quota gratuit : 120 h-cœur par mois, soit 60 h d'utilisation).
3. Attendre la fin du démarrage automatique (10 à 15 min la première fois, 1 à 2 min ensuite). Le terminal affiche :
   ```
   ✅ Application : https://<nom>-3000.app.github.dev
   ```
4. Si l'adresse demande une connexion GitHub sur le téléphone : onglet **PORTS** → clic droit sur 3000 →
   **Port Visibility → Public**.
5. Connexion administrateur : `/admin/connexion`, avec `admin` / `Damascino2026!` (nouveau mot de passe demandé).

Bon à savoir :
- Le Codespace s'arrête après 30 min sans activité dans l'éditeur. Il faut le rouvrir depuis
  https://github.com/codespaces, et l'application redémarre seule avec ses données.
- L'adresse reste la même tant que le Codespace existe.
- Pour arrêter la consommation du quota : https://github.com/codespaces → **Stop codespace**.

---

## 2. Oracle Cloud « Always Free » (serveur gratuit permanent)

Oracle offre à vie une machine **ARM Ampere A1 jusqu'à 4 cœurs et 24 Go de RAM**, largement suffisante.

### Créer le serveur (une fois, ≈ 15 min)

1. Créer un compte sur https://www.oracle.com/cloud/free/ (région conseillée : **Europe – Marseille** ou
   **Frankfurt**). La carte sert à vérifier l'identité : rien n'est débité tant que vous restez sur « Always Free ».
2. **Compute → Instances → Create instance** :
   - Image : **Ubuntu 22.04 ou 24.04** ;
   - Shape : **Ampere VM.Standard.A1.Flex**, **2 OCPU / 12 Go** (dans la limite gratuite) ;
   - Ajouter votre clé SSH (ou la faire générer et la télécharger).
3. Ouvrir les ports web : **Networking → Virtual cloud networks → votre VCN → Security Lists → Default** →
   **Add Ingress Rules** : source `0.0.0.0/0`, TCP, ports **80,443**.
4. Noter l'**adresse IP publique** de l'instance.

> Si Oracle indique « Out of capacity » pour Ampere, réessayez un peu plus tard ou dans un autre domaine de
> disponibilité : c'est fréquent sur l'offre gratuite.

### Installer l'application (une commande)

```bash
ssh ubuntu@<IP_PUBLIQUE>
# dépôt privé : fournir un jeton GitHub en lecture (Settings → Developer settings → Fine-grained tokens)
export GITHUB_TOKEN=<votre_jeton>
curl -fsSL -H "Authorization: token $GITHUB_TOKEN" \
  https://raw.githubusercontent.com/bah13-a/damscino/claude/serene-faraday-tqmxat/infra/vps/deploy.sh -o deploy.sh
sudo -E bash deploy.sh
```

Le script [`infra/vps/deploy.sh`](../infra/vps/deploy.sh) :
- installe Docker ;
- ouvre les ports 80 et 443 ;
- récupère le code ;
- génère des secrets aléatoires et le mot de passe administrateur, qu'il affiche une seule fois ;
- conserve le jeton GitHub dans `.env` (les mises à jour suivantes n'en ont plus besoin) ;
- télécharge l'application Android depuis la release `android-prod` (taille et SHA-256 vérifiés) dans
  `app-downloads/`, servie sur `https://<domaine>/downloads/damascino-privileges.apk` (le QR code de la page
  d'accueil) ;
- lance l'application derrière **Caddy**, qui obtient automatiquement un certificat HTTPS Let's Encrypt ;
- vérifie le site HTTPS, l'APK servie et l'accès depuis Internet ;
- programme une sauvegarde quotidienne de la base (`/var/backups/damascino`, 30 jours).

**AWS EC2** : dans le *Security Group* de l'instance, ouvrir en entrée TCP **80** et **443** (0.0.0.0/0), sinon le
certificat HTTPS ne peut pas être obtenu et le site reste inaccessible. Prévoir au moins 2 Go de RAM (le script
ajoute 4 Go de swap).

`deploy.sh` écrit `COMPOSE_FILE=docker-compose.yml:docker-compose.prod.yml` dans `.env` : dans `/opt/damascino`,
un simple `docker compose up -d`, `ps` ou `logs` inclut donc toujours Caddy (HTTPS).

**Mises à jour automatiques (recommandé)** : les images de l'application sont compilées par GitHub Actions
(workflow « Images Docker et déploiement serveur ») et publiées sur `ghcr.io`, puis le serveur est mis à jour par
SSH : il ne fait que télécharger les images (2 à 5 minutes au lieu de 15 à 30). L'APK de production est aussi
vérifiée (signature) puis copiée sur le serveur dès sa compilation. À configurer une fois dans GitHub →
Settings → Secrets and variables → Actions → *New repository secret* :

| Secret | Valeur |
|---|---|
| `SERVER_HOST` | IP publique du serveur (sur AWS, une **Elastic IP**, sinon elle change à chaque redémarrage) |
| `SERVER_SSH_KEY` | contenu complet du fichier `.pem` de la paire de clés EC2 |
| `SERVER_USER` | `ubuntu` (facultatif) |

Sans ces secrets, les images sont quand même publiées et un `sudo bash /opt/damascino/infra/vps/deploy.sh` sur le
serveur les télécharge (jeton GitHub avec la portée `read:packages`, sinon il compile sur place).

**Nouvelle version de l'application Android** (après le workflow GitHub Actions « Application mobile (APK
Android) », environnement `prod`) : `sudo bash /opt/damascino/infra/download-apk.sh` — sans redémarrage.

Sans nom de domaine, l'application est servie sur `https://<ip-avec-tirets>.sslip.io`
(ex. `https://141-145-12-34.sslip.io`).

**Avec un nom de domaine** (ex. `privileges.damascino.tn`) : créer un enregistrement DNS **A** vers l'IP du serveur,
puis :

```bash
sudo -E bash deploy.sh privileges.damascino.tn
```

**Mettre à jour** après une nouvelle version : relancer `sudo -E bash deploy.sh`. Les données et les secrets sont
conservés.

---

## 3. Votre PC + tunnel Cloudflare (démo ponctuelle)

1. Installer **Docker Desktop** (Windows ou Mac) ou Docker (Linux), puis dans le dossier du projet :
   ```bash
   docker compose up -d --build
   ```
   L'application tourne sur http://localhost:3000.
2. Installer `cloudflared` (https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/),
   puis :
   ```bash
   cloudflared tunnel --url http://localhost:3000
   ```
3. Cloudflare affiche une adresse `https://xxxx.trycloudflare.com` à ouvrir sur n'importe quel téléphone. Elle est
   gratuite, sans compte, mais change à chaque lancement.

---

## Après le déploiement : premier test

1. `/admin/connexion` → `admin` + mot de passe initial → choisir un nouveau mot de passe.
2. **Comptes** → créer un compte « Personnel scanner » (ex. `caisse1`, PIN `1234`).
3. **Partenaires** → créer un partenaire → **Ajouter** un bénéficiaire → noter l'accès généré.
4. Sur un téléphone : `/connexion` avec cet accès → changer le mot de passe → **Utiliser mon avantage**.
5. Sur un autre appareil : `/personnel` → scanner le QR code → saisir le prix → confirmer → reporter la remise
   indiquée dans la caisse.
6. Le lendemain : **Rapprochement** avec l'export des ventes de la caisse.
