#!/bin/bash

# Setup script: Télécharge ou génère l'APK pour Damascino

set -e

echo "🔧 Configuration de l'APK pour Damascino..."
echo ""

REPO="bah13-a/damscino"
APK_DIR="app-downloads"
APK_FILE="$APK_DIR/damascino-privileges.apk"

# Créer le répertoire
mkdir -p "$APK_DIR"

echo "📍 Répertoire: $(pwd)"
echo "📁 APK directory: $APK_DIR"
echo ""

# Option 1: Télécharger depuis GitHub Release
echo "1️⃣  Tentative de téléchargement depuis GitHub Release..."

if command -v gh &> /dev/null; then
    echo "   Using GitHub CLI..."

    # Essayer de télécharger depuis la release android-prod
    if gh release download android-prod --repo "$REPO" --pattern "damascino-privileges.apk" -D "$APK_DIR" 2>/dev/null; then
        echo "✅ APK téléchargée avec succès depuis GitHub Release"
        ls -lh "$APK_FILE"
        echo ""
        echo "✅ Setup terminé! L'APK est maintenant disponible pour le scanning QR."
        exit 0
    else
        echo "⚠️  Release android-prod pas trouvée ou vide"
    fi
else
    echo "   GitHub CLI pas installée, tentative avec curl..."

    # Essayer avec curl
    RELEASE_API="https://api.github.com/repos/$REPO/releases/tags/android-prod"

    if curl -s "$RELEASE_API" | grep -q "damascino-privileges.apk"; then
        echo "✅ Release trouvée, téléchargement..."

        # Extraire le lien de téléchargement
        DOWNLOAD_URL=$(curl -s "$RELEASE_API" | grep -o '"browser_download_url":"[^"]*damascino-privileges.apk"' | cut -d'"' -f4)

        if [ -n "$DOWNLOAD_URL" ]; then
            curl -L "$DOWNLOAD_URL" -o "$APK_FILE"
            echo "✅ APK téléchargée avec succès"
            ls -lh "$APK_FILE"
            exit 0
        fi
    fi

    echo "⚠️  Impossible de télécharger depuis GitHub"
fi

echo ""
echo "2️⃣  Création d'une APK de test..."

# Si le téléchargement a échoué, créer une APK de test
# Une APK valide est un ZIP avec une structure spécifique

# Créer un répertoire temporaire
TEMP_DIR=$(mktemp -d)
trap "rm -rf $TEMP_DIR" EXIT

# Créer la structure minimale d'une APK
mkdir -p "$TEMP_DIR/res"
mkdir -p "$TEMP_DIR/lib"
mkdir -p "$TEMP_DIR/assets"

# Créer un AndroidManifest.xml minimal
cat > "$TEMP_DIR/AndroidManifest.xml" << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="tn.damascino.privileges"
    android:versionCode="1"
    android:versionName="1.0">

    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.CAMERA" />
    <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />

    <application
        android:label="Damascino Privileges"
        android:icon="@mipmap/ic_launcher">
        <activity
            android:name=".MainActivity"
            android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>
</manifest>
EOF

# Créer un fichier info
cat > "$TEMP_DIR/info.txt" << 'EOF'
Damascino Privileges - Test APK
Generated: $(date)
Package: tn.damascino.privileges
Version: 1.0.0

NOTE: This is a test/placeholder APK.
For production, download from GitHub Release or build via GitHub Actions.

Instructions:
1. Go to .github/workflows/mobile-apk.yml
2. Run the workflow with environment=prod
3. The APK will be published to GitHub Release
4. Download it and place in app-downloads/damascino-privileges.apk
EOF

# Créer l'APK (qui est en réalité un ZIP)
cd "$TEMP_DIR"
zip -r "$APK_FILE" . > /dev/null 2>&1 || \
    ( cd "$(pwd)" && tar -czf "$APK_FILE" . && \
      echo "📦 Created as gzip archive (fallback)" )

echo "✅ APK de test créée: $APK_FILE"
ls -lh "$APK_FILE"

echo ""
echo "📋 IMPORTANT - Pour une APK complète et fonctionnelle:"
echo ""
echo "   1. Accédez à GitHub:"
echo "      https://github.com/bah13-a/damscino/actions"
echo ""
echo "   2. Sélectionnez 'Application mobile (APK Android)'"
echo ""
echo "   3. Cliquez 'Run workflow'"
echo "      - Environment: prod"
echo "      - API URL: https://16-171-199-82.sslip.io"
echo ""
echo "   4. Attendez la compilation (15-20 minutes)"
echo ""
echo "   5. Une fois terminé, téléchargez l'APK depuis la Release"
echo ""
echo "   6. Placez-la dans: app-downloads/damascino-privileges.apk"
echo ""
echo "   7. Redémarrez les services:"
echo "      docker compose restart"
echo ""

echo "✅ Setup terminé!"
echo ""
echo "🚀 Le QR scanning pointera maintenant vers: /downloads/damascino-privileges.apk"
