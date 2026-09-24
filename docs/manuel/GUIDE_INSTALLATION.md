# Damascino Privilèges — Guide d'installation

Ce guide explique, pas à pas, comment **mettre en service** Damascino Privilèges : le serveur (site d'administration et
API) et l'**application mobile** des bénéficiaires et du personnel de caisse. L'utilisation au quotidien est décrite
dans le [Manuel d'utilisation](MANUEL_UTILISATION.md).

## Sommaire

- [1. Vue d'ensemble](#1-vue-densemble)
- [2. Environnement de test : GitHub Codespaces](#2-environnement-de-test--github-codespaces)
- [3. Environnement de production : serveur Oracle Cloud](#3-environnement-de-production--serveur-oracle-cloud)
- [4. Installer l'application sur les téléphones](#4-installer-lapplication-sur-les-téléphones)
- [5. Premiers réglages dans l'administration](#5-premiers-réglages-dans-ladministration)
- [6. Vérifier que tout fonctionne (recette)](#6-vérifier-que-tout-fonctionne-recette)
- [7. Publier une nouvelle version](#7-publier-une-nouvelle-version)
- [8. Dépannage](#8-dépannage)
- [9. Aide-mémoire](#9-aide-mémoire)

---

## 1. Vue d'ensemble

| Qui | Outil | Où |
|---|---|---|
| Équipe Damascino (administration) | **Site web** | `https://<adresse du site>/admin/connexion` |
| Serveurs, caissiers | **Application mobile**, espace *Personnel Damascino* | Téléphone ou tablette Android (iPhone : voir § 4.3) |
| Collaborateurs des partenaires | **Application mobile**, espace *Je suis bénéficiaire* | Leur téléphone |

Il existe **deux environnements**, totalement séparés :

| | **Test** | **Production** |
|---|---|---|
| Rôle | Essais, démonstrations, formation | Utilisation réelle par les clients |
| Serveur | GitHub Codespace (gratuit, s'arrête quand on ne s'en sert pas) | Serveur Oracle Cloud « Always Free » (gratuit, allumé en permanence) |
| Application | **Privilèges TEST** (bandeau orange « Environnement de test ») | **Damascino Privilèges** |
| Téléchargement de l'application | `…/releases/download/android-test/damascino-privileges-test.apk` | `…/releases/download/android-prod/damascino-privileges.apk` |
| Données | De test, effaçables | Réelles, sauvegardées chaque nuit |

Les deux applications peuvent être installées **sur le même téléphone** sans se mélanger : chacune parle à son propre
serveur, dont l'adresse est intégrée à l'application.

> Adresse complète des téléchargements : `https://github.com/bah13-a/damscino/releases/download/…`

---

## 2. Environnement de test : GitHub Codespaces

**Prérequis :** un compte GitHub avec accès au dépôt `bah13-a/damscino`.

### 2.1 Créer et démarrer le Codespace (une fois)

1. Ouvrir **https://codespaces.new/bah13-a/damscino?ref=claude/serene-faraday-tqmxat**
   (ou sur GitHub : bouton **Code → Codespaces → Create codespace**).
2. Choisir une machine **2 cœurs / 8 Go**, puis **Create codespace**.
3. Attendre la fin du démarrage automatique : **10 à 15 minutes la première fois** (compilation), 1 à 2 minutes
   ensuite. Le terminal affiche à la fin :
   ```
   ✅ Application : https://<nom-du-codespace>-3000.app.github.dev
   ```
4. **Rendre le site accessible aux téléphones** — étape indispensable :
   onglet **PORTS** (en bas) → ligne **3000** → clic droit → **Port Visibility → Public**.
5. Vérifier sur un téléphone : ouvrir `https://<nom-du-codespace>-3000.app.github.dev` → la page
   *« Votre avantage Damascino, dans votre poche »* s'affiche.

> **Adresse actuelle du Codespace de test :** `https://musical-goggles-7wqpvxv5jgq3pvqg-3000.app.github.dev` —
> c'est celle qui est intégrée dans l'application **Privilèges TEST**.

### 2.2 Rouvrir le Codespace les jours suivants

- Le Codespace **s'arrête après 30 minutes sans activité**. L'application mobile de test ne fonctionne alors plus
  (« Connexion impossible »).
- Pour le relancer : **https://github.com/codespaces** → cliquer sur le Codespace. L'application redémarre toute seule
  avec ses données, à la même adresse (1 à 2 minutes).
- Vérifier que le port 3000 est toujours **Public**.
- Quota gratuit : 60 heures d'utilisation par mois. Pour l'économiser : https://github.com/codespaces →
  **⋯ → Stop codespace**.

### 2.3 Mettre à jour le Codespace avec la dernière version

Dans le terminal du Codespace :
```bash
git pull
docker compose up -d --build
```

### 2.4 Si vous créez un nouveau Codespace

Un nouveau Codespace a une **nouvelle adresse**. Il faut alors l'indiquer à l'application de test :
GitHub → **Settings → Environments → test → Add variable** : `APP_API_URL` = `https://<nouveau-nom>-3000.app.github.dev`,
puis recompiler l'application (§ 7.2).

---

## 3. Environnement de production : serveur Oracle Cloud

Un serveur gratuit et permanent (4 cœurs ARM, 24 Go de RAM maximum dans l'offre « Always Free »).

### 3.1 Créer le serveur (une fois, ≈ 15 minutes)

1. Créer un compte sur **https://www.oracle.com/cloud/free/** (région conseillée : Europe – Marseille ou Frankfurt).
   La carte bancaire sert à vérifier l'identité : rien n'est débité tant que vous restez en « Always Free ».
2. **Compute → Instances → Create instance** :
   - Image : **Ubuntu 24.04** ;
   - Shape : **Ampere VM.Standard.A1.Flex**, **2 OCPU / 12 Go** ;
   - clé SSH : la générer et **télécharger la clé privée**.
3. Ouvrir les ports web : **Networking → Virtual cloud networks → votre VCN → Security Lists → Default** →
   **Add Ingress Rules** : source `0.0.0.0/0`, protocole TCP, ports `80,443`.
4. Noter l'**adresse IP publique** de l'instance.

> « Out of capacity » : fréquent sur l'offre gratuite, réessayer plus tard ou dans un autre *availability domain*.

### 3.2 Nom de domaine (recommandé)

Chez le fournisseur du domaine de Damascino, créer un enregistrement **DNS de type A** :
`privileges.damascino.tn` → l'adresse IP du serveur. Sans domaine, le serveur est quand même joignable sur
`https://<ip-avec-tirets>.sslip.io`.

### 3.3 Installer l'application (une commande)

1. Sur GitHub, créer un jeton de lecture du dépôt : **Settings → Developer settings → Fine-grained tokens →
   Generate new token** → dépôt `damscino`, permission **Contents : Read-only**.
2. Se connecter au serveur et lancer l'installation :
   ```bash
   ssh -i <cle-privee> ubuntu@<IP_PUBLIQUE>
   export GITHUB_TOKEN=<votre_jeton>
   curl -fsSL -H "Authorization: token $GITHUB_TOKEN" \
     https://raw.githubusercontent.com/bah13-a/damscino/claude/serene-faraday-tqmxat/infra/vps/deploy.sh -o deploy.sh
   sudo -E bash deploy.sh privileges.damascino.tn
   ```
3. Le script installe Docker, génère des secrets, obtient le certificat HTTPS et démarre tout (15 à 20 minutes).
   À la fin, il affiche **une seule fois** le mot de passe initial de l'administrateur : **notez-le**.
4. Vérifier : `https://privileges.damascino.tn` affiche la page de téléchargement de l'application.

Le serveur sauvegarde la base **chaque nuit** (`/var/backups/damascino`, 30 jours d'historique).

### 3.4 Relier l'application de production à ce serveur

1. GitHub → **Settings → Environments → prod** (créer l'environnement `prod` s'il n'existe pas) :
   - **variable** `APP_API_URL` = `https://privileges.damascino.tn` ;
   - **secrets** de signature (fortement recommandés, obligatoires pour Google Play) — voir § 7.3.
2. **Actions → Application mobile (APK Android) → Run workflow → environnement `prod` → Run workflow**.
3. 25 à 30 minutes plus tard, l'application **Damascino Privilèges** est disponible au téléchargement
   (`…/releases/download/android-prod/damascino-privileges.apk`) et le bouton du site de production pointe dessus.

### 3.5 Mettre à jour le serveur de production

```bash
ssh -i <cle-privee> ubuntu@<IP_PUBLIQUE>
sudo -E bash deploy.sh privileges.damascino.tn
```
Les données, les secrets et le mot de passe administrateur sont conservés.

---

## 4. Installer l'application sur les téléphones

### 4.1 Android (téléphones des bénéficiaires, téléphones ou tablettes de caisse)

1. Sur le téléphone, ouvrir le site (Test : l'adresse du Codespace ; Production : `https://privileges.damascino.tn`)
   et toucher **Télécharger pour Android** — ou ouvrir directement le lien de téléchargement (§ 1).
   *Dépôt GitHub privé : se connecter à GitHub dans le navigateur du téléphone avant de télécharger.*
2. Ouvrir le fichier téléchargé (notification *Téléchargement terminé*, ou application **Fichiers → Téléchargements**).
3. La première fois, Android demande d'autoriser l'installation depuis le navigateur :
   **Paramètres → Autoriser cette source**, puis revenir en arrière.
4. **Installer**. Si *Play Protect* avertit d'une application inconnue : **Plus de détails → Installer quand même**
   (l'application n'est pas encore publiée sur le Play Store).
5. L'icône **Privilèges TEST** ou **Damascino Privilèges** apparaît avec les autres applications.

**Mise à jour :** télécharger et installer la nouvelle version par-dessus l'ancienne, la session est conservée.
Si Android refuse (« conflit avec un paquet existant »), désinstaller l'ancienne version puis réinstaller.

### 4.2 Téléphone ou tablette de caisse

- Installer l'application comme ci-dessus sur l'appareil posé près de la caisse.
- À la première ouverture du scanner, **autoriser l'accès à la caméra**.
- Conseillé : désactiver la mise en veille automatique trop courte et garder l'appareil branché.

### 4.3 iPhone

Apple n'autorise pas l'installation directe d'un fichier comme l'APK. Il faut un compte **Apple Developer**
(99 $ par an), puis :
1. compiler la version iPhone avec EAS (`npx eas-cli build -p ios --profile production`, voir
   `docs/APPLICATION_MOBILE.md`) ;
2. la distribuer par **TestFlight** (tests, jusqu'à 10 000 personnes invitées par e-mail) puis sur l'**App Store**.

En attendant, les utilisateurs d'iPhone ne peuvent pas utiliser le programme.

---

## 5. Premiers réglages dans l'administration

À faire une fois par environnement, sur un ordinateur. Le détail de chaque écran est dans le
[Manuel d'utilisation, partie 1](MANUEL_UTILISATION.md#partie-1--administrateur-damascino).

1. **Première connexion** : `https://<adresse du site>/admin/connexion`, identifiant `admin`, mot de passe initial
   (Test : `Damascino2026!` ; Production : celui affiché par le script d'installation). Choisir un nouveau mot de
   passe **et le noter**.
2. **Comptes** → créer un compte **Personnel** par caissier (identifiant + code PIN de 4 à 8 chiffres), et
   éventuellement d'autres administrateurs.
3. **Catégories** → vérifier les catégories de la carte (Plats, Boissons, Desserts…).
4. **Caisses** → régler la **remise en caisse** : nom de la remise dans la caisse, en % sur la ligne ou en montant sur
   le ticket, prix du plat obligatoire ou non.
5. **Partenaires** → **Nouveau partenaire** (nom, dates de convention, contact) puis sa **règle** (pourcentage,
   catégories, nombre de passages par jour / semaine / mois).
6. Fiche du partenaire → **Importer une liste** (Excel ou CSV : Nom, Prénom, Téléphone ; **Télécharger le modèle**
   pour le format).
7. **Exporter les accès** (identifiants + mots de passe temporaires) et **Copier le lien** d'activation : les envoyer
   au responsable du partenaire avec la [partie 3 du manuel](MANUEL_UTILISATION.md#partie-3--guide-du-bénéficiaire-à-remettre-aux-collaborateurs).

---

## 6. Vérifier que tout fonctionne (recette)

Prévoir **deux téléphones Android** avec l'application installée (un « client », un « caisse ») : l'application ne
garde qu'un compte connecté à la fois.

| # | Où | Action | Résultat attendu |
|---|---|---|---|
| 1 | Administration | Créer un partenaire (convention en cours) et un bénéficiaire (**Ajouter**) | Fenêtre *Accès généré* avec identifiant et mot de passe temporaire |
| 2 | Administration | **Comptes** → créer `caisse1` / PIN `1234` | Compte dans la liste |
| 3 | Téléphone client | **Je suis bénéficiaire** → identifiant + mot de passe temporaire | Écran *Bienvenue !* : choix du mot de passe |
| 4 | Téléphone client | Choisir le mot de passe → **Enregistrer** | Espace avec **Disponible** et −20 % |
| 5 | Téléphone client | **Utiliser mon avantage** | QR code, compte à rebours, heure qui défile |
| 6 | Téléphone caisse | **Personnel Damascino** → `caisse1` / `1234` → autoriser la caméra | Scanner ouvert |
| 7 | Téléphone caisse | Viser le QR du client | Écran vert **Avantage valide** avec le nom du client |
| 8 | Téléphone caisse | Prix `40` → **Confirmer le passage** | **Passage validé**, consignes de remise (20 %, −8 DT, code à 6 chiffres) |
| 9 | Téléphone client | — | Passe seul à **Avantage utilisé** |
| 10 | Téléphone caisse | **Scanner un autre client** → rescanner le même QR | Écran rouge **Refusé – QR code déjà utilisé** |
| 11 | Administration | **Tableau de bord**, **Utilisations** | Le passage apparaît |
| 12 | Navigateur | Se connecter en bénéficiaire sur le site | Refusé : *« Connectez-vous depuis l'application mobile »* |

---

## 7. Publier une nouvelle version

### 7.1 Serveur

- Test : `git pull && docker compose up -d --build` dans le Codespace.
- Production : relancer `sudo -E bash deploy.sh privileges.damascino.tn` sur le serveur.

### 7.2 Application mobile

GitHub → **Actions → Application mobile (APK Android) → Run workflow** :
- environnement **test** : se fait aussi **automatiquement** à chaque modification de l'application ;
- environnement **prod** : uniquement à la main, quand la version test a été validée.

Compter 25 à 30 minutes. Le lien de téléchargement ne change pas ; les utilisateurs installent la nouvelle version
par-dessus l'ancienne.

### 7.3 Clé de signature (production)

Toutes les versions de production doivent être signées avec **la même clé** (sinon Android refuse la mise à jour,
et Google Play l'exige). À faire une fois, sur un ordinateur avec Java :
```bash
keytool -genkeypair -v -keystore damascino.keystore -alias damascino -keyalg RSA -keysize 2048 -validity 10000
base64 -w0 damascino.keystore
```
Puis GitHub → **Settings → Environments → prod → Add secret** :
`ANDROID_KEYSTORE_BASE64` (le texte affiché par `base64`), `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`
(`damascino`), `ANDROID_KEY_PASSWORD`. **Conservez le fichier et les mots de passe en lieu sûr.**

### 7.4 Publication sur Google Play (facultatif)

Compte Google Play Console (25 $ une fois), puis version *app bundle* avec EAS :
`npx eas-cli build -p android --profile production` et `npx eas-cli submit -p android`
(détails : `docs/APPLICATION_MOBILE.md`).

---

## 8. Dépannage

| Problème | Cause probable | Solution |
|---|---|---|
| Application : « Connexion impossible au serveur … » | Codespace arrêté, ou téléphone sans internet | Rouvrir le Codespace (§ 2.2) ; vérifier le Wi-Fi / 4G |
| Application : « Le serveur ne répond pas comme prévu… port 3000 en Public » | Port 3000 du Codespace resté **privé** | PORTS → 3000 → **Port Visibility → Public** |
| Application : « Service en cours de démarrage » | Le serveur démarre | Attendre 1 à 2 minutes |
| Site : « Connectez-vous depuis l'application mobile » | Compte bénéficiaire ou caissier utilisé sur le site | Utiliser l'application ; le site est réservé à l'administration |
| « Identifiant ou mot de passe incorrect » (admin) | Mot de passe déjà changé | Réinitialiser (ligne suivante) |
| « Compte temporairement bloqué » | 5 mots de passe faux | Attendre 15 minutes, ou réinitialiser |
| Mot de passe **admin** perdu | — | Test : `bash infra/reset-admin.sh` dans le Codespace ; Production : `sudo bash infra/reset-admin.sh` dans `/opt/damascino` sur le serveur. Données conservées |
| Mot de passe d'un **bénéficiaire** ou **caissier** perdu | — | Administration → **Bénéficiaires** → *Réinitialiser* ; **Comptes** → nouveau PIN |
| La caméra ne s'ouvre pas | Autorisation refusée | Paramètres Android → Applications → Privilèges → Autorisations → Caméra |
| « Trop de tentatives de connexion » | Plus de 100 échecs en 10 min depuis la même connexion | Attendre 10 minutes |
| Installation Android impossible | Source non autorisée, ou ancienne version signée autrement | Autoriser la source (§ 4.1) ; désinstaller l'ancienne version |

---

## 9. Aide-mémoire

| | Test | Production |
|---|---|---|
| Site / administration | `https://musical-goggles-7wqpvxv5jgq3pvqg-3000.app.github.dev/admin/connexion` | `https://privileges.damascino.tn/admin/connexion` |
| Application Android | `github.com/bah13-a/damscino/releases/download/android-test/damascino-privileges-test.apk` | `github.com/bah13-a/damscino/releases/download/android-prod/damascino-privileges.apk` |
| Admin initial | `admin` / `Damascino2026!` | `admin` / mot de passe affiché à l'installation |
| Démarrer | https://github.com/codespaces → ouvrir le Codespace | Toujours allumé |
| Mettre à jour le serveur | `git pull && docker compose up -d --build` | `sudo -E bash deploy.sh privileges.damascino.tn` |
| Nouvelle application | Automatique (ou *Run workflow* → test) | *Run workflow* → prod |
| Réinitialiser l'admin | `bash infra/reset-admin.sh` | `sudo bash infra/reset-admin.sh` |
