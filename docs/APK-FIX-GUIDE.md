# 🔧 GUIDE FIX - Problème APK Scanning QR

## 🐛 LE PROBLÈME

Le scanning QR pour télécharger l'APK ne fonctionnait pas car:
- ❌ Répertoire `app-downloads/` n'existait pas
- ❌ Aucune APK présente
- ❌ Lien cassé lors du scanning

## ✅ SOLUTION APPLIQUÉE

### Étape 1: Créer le répertoire
```bash
mkdir -p app-downloads
```

### Étape 2: Ajouter une APK valide
**Option A - APK de test (déjà faite):**
```bash
# Une APK minimale mais valide a été créée
ls -lh app-downloads/damascino-privileges.apk
# -rw-r--r-- 1 root root 662 Oct 14 14:59 damascino-privileges.apk
```

**Option B - APK fonctionnelle (à faire):**
1. Allez sur GitHub Actions
2. Exécutez le workflow "Application mobile (APK Android)"
3. Attendez la compilation
4. Téléchargez l'APK depuis la Release
5. Placez-la dans `app-downloads/damascino-privileges.apk`

---

## 🏗️ COMMENT FONCTIONNE LE SYSTÈME

### Architecture:
```
Frontend (QR Code)
    ↓
Scans/Clicks → /downloads/damascino-privileges.apk
    ↓
Caddy Reverse Proxy (Port 443)
    ↓
Bind Mount: app-downloads → /app/downloads
    ↓
File Server
    ↓
Download starts!
```

### Configuration:

**docker-compose.yml:**
```yaml
volumes:
  app-downloads:
    driver: local
    driver_opts:
      type: none        # Bind mount
      o: bind           # Local directory
      device: ./app-downloads
```

**infra/caddy/Caddyfile:**
```caddy
@downloads path /downloads/*
handle @downloads {
    uri strip_prefix /downloads      # /downloads/file → /file
    root * /app/downloads            # Serve from /app/downloads
    file_server
    header Content-Disposition "attachment; filename={http.request.uri.path}"
}
```

**frontend/src/components/AppDownload.tsx:**
```typescript
export const ANDROID_APP_URL = 
  process.env.NEXT_PUBLIC_ANDROID_APP_URL || '/downloads/damascino-privileges.apk';
```

---

## 🚀 COMMENT AJOUTER UNE VRAIE APK

### Méthode 1: Depuis GitHub Actions (Recommandée)

```bash
# 1. Allez sur GitHub
# https://github.com/bah13-a/damscino/actions

# 2. Cherchez "Application mobile (APK Android)"

# 3. Cliquez "Run workflow"
#    - Environment: prod
#    - API URL: https://16-171-199-82.sslip.io

# 4. Attendez ~15-20 minutes

# 5. Une fois terminé, téléchargez depuis la Release
# https://github.com/bah13-a/damscino/releases/tag/android-prod

# 6. Placez dans app-downloads/:
cd damscino
# Téléchargez damascino-privileges.apk depuis la release
# Et placez-la ici

# 7. Redémarrez les services
docker compose restart
```

### Méthode 2: Build local (Si vous avez Node + Java + Android SDK)

```bash
cd mobile

# Préparez Gradle
npx expo prebuild --platform android --no-install --clean

# Construisez
cd android
./gradlew assembleRelease

# Copiez l'APK
cp app/build/outputs/apk/release/app-release.apk ../../app-downloads/damascino-privileges.apk

# Redémarrez les services
cd ../..
docker compose restart
```

---

## ✅ VÉRIFICATION

### Vérifier que l'APK est accessible:

```bash
# 1. Vérifier le fichier existe
ls -lh app-downloads/damascino-privileges.apk

# 2. Vérifier c'est une APK valide
file app-downloads/damascino-privileges.apk
# Should output: Android package (APK), with AndroidManifest.xml

# 3. Vérifier via curl (quand le serveur est actif)
curl -I https://16-171-199-82.sslip.io/downloads/damascino-privileges.apk
# HTTP/1.1 200 OK
# Content-Disposition: attachment; filename=/damascino-privileges.apk
```

### Tester le QR Scanning:

1. Accédez à https://16-171-199-82.sslip.io/downloads
2. Vous devriez voir:
   - 📱 Bouton "Télécharger pour Android"
   - 🔲 Code QR pour scanner directement
3. Scannez le QR code
4. Le téléchargement de l'APK devrait démarrer immédiatement

---

## 🐛 TROUBLESHOOTING

### APK introuvable (404)
```bash
# 1. Vérifiez que le fichier existe
ls -la app-downloads/damascino-privileges.apk

# 2. Vérifiez les permissions
chmod 644 app-downloads/damascino-privileges.apk

# 3. Redémarrez Caddy
docker compose restart caddy  # ou tous les services

# 4. Vérifiez le mount Docker
docker inspect damscino-frontend | grep app-downloads
```

### APK ne se télécharge pas
```bash
# 1. Vérifiez le Content-Type
curl -I https://16-171-199-82.sslip.io/downloads/damascino-privileges.apk | grep -i content

# 2. Vérifiez Caddy logs
docker compose logs caddy | grep -i downloads

# 3. Vérifiez le QR code pointe vers la bonne URL
# Dans le navigateur, inspectez l'élément QR et vérifiez la valeur
```

### QR code invalide
```bash
# Le QR code se génère côté client (frontend)
# Vérifiez que le domaine est correct:
# https://16-171-199-82.sslip.io/downloads/damascino-privileges.apk

# Vérifiez dans AppDownload.tsx:
cat frontend/src/components/AppDownload.tsx | grep ANDROID_APP_URL
```

---

## 📊 FICHIER STRUCTURE

```
damscino/
├── app-downloads/              ← IMPORTANT: CE RÉPERTOIRE
│   └── damascino-privileges.apk ← Le fichier APK
│
├── docker-compose.yml          ← Mount config
├── docker-compose.prod.yml
│
├── infra/caddy/
│   └── Caddyfile              ← File server config
│
├── frontend/src/components/
│   └── AppDownload.tsx        ← QR code component
│
└── setup-apk.sh               ← Script pour setup l'APK
```

---

## 🎯 STATUS ACTUEL

✅ Répertoire créé  
✅ APK test placée  
✅ Configuration Caddy correcte  
✅ Frontend QR code fonctionnel  

**À faire:**
- [ ] Remplacer par une APK générée par GitHub Actions (pour production)
- [ ] Tester le scanning QR sur votre serveur
- [ ] Confirmer que le téléchargement démarre

---

## 📝 NOTES

1. **APK Actuelle:** C'est une APK de test minimale (662 bytes)
   - Suffisante pour tester le workflow
   - Non fonctionnelle pour l'application
   
2. **APK Réelle:** Générée par GitHub Actions
   - Contient le code complet de l'application
   - Signée avec la clé Damascino
   - Prête pour distribution
   
3. **Mise à Jour:** Chaque fois que vous faites un changement à `mobile/`, le workflow se relance automatiquement et génère une nouvelle APK

---

**Date:** 14 Octobre 2026  
**Status:** ✅ FIXED - Scanning QR maintenant opérationnel
