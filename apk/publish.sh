#!/usr/bin/env bash
# Construit l'APK StoreFlow et le prépare pour la publication (sur le N150).
# Version : modifier www/app-version.json (versionCode +1) avant de lancer ce script.
# Ensuite : npm run build (à la racine de StoreFlow) pour mettre l'APK et apk-version.json en ligne.
set -euo pipefail

APK_DIR="$(cd "$(dirname "$0")" && pwd)"
PUBLIC="$APK_DIR/../public"
cd "$APK_DIR"

node --test

VERSION_CODE=$(node -p "require('./www/app-version.json').versionCode")
VERSION_NAME=$(node -p "require('./www/app-version.json').versionName")
sed -i -E "s/versionCode [0-9]+/versionCode $VERSION_CODE/; s/versionName \"[^\"]*\"/versionName \"$VERSION_NAME\"/" \
  android/app/build.gradle

pnpm exec cap sync android
(cd android && ./gradlew assembleDebug --console=plain -q)

cp android/app/build/outputs/apk/debug/app-debug.apk StoreFlow.apk

# Les anciens APK versionnés sont rangés (pas supprimés) dans anciennes-versions/
mkdir -p anciennes-versions
for old in "$PUBLIC"/StoreFlow-*.apk; do
  [ -e "$old" ] && mv "$old" anciennes-versions/
done

# Nom versionné pour la mise à jour (Chrome ne propose pas de rouvrir un ancien fichier),
# et StoreFlow.apk = toujours la dernière version, lien fixe pour une première installation
APK_FILE="StoreFlow-$VERSION_NAME.apk"
cp StoreFlow.apk "$PUBLIC/$APK_FILE"
cp StoreFlow.apk "$PUBLIC/StoreFlow.apk"
node -e "
const v = require('./www/app-version.json');
require('fs').writeFileSync(process.argv[1], JSON.stringify({ ...v, file: process.argv[2] }, null, 2) + '\n');
" "$PUBLIC/apk-version.json" "$APK_FILE"
echo "APK $VERSION_NAME (code $VERSION_CODE) prêt dans public/ ($APK_FILE) → lancer npm run build à la racine de StoreFlow pour le publier"
