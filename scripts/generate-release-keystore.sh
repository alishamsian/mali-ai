#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ANDROID_DIR="$ROOT/android"
KEYSTORE="$ANDROID_DIR/app/release.keystore"
PROPS="$ANDROID_DIR/keystore.properties"

if [[ -f "$PROPS" ]]; then
  echo "keystore.properties already exists — skip generation."
  exit 0
fi

if [[ ! -f "$KEYSTORE" ]]; then
  echo "Generating release.keystore..."
  keytool -genkeypair -v \
    -keystore "$KEYSTORE" \
    -alias maliai-release \
    -keyalg RSA -keysize 2048 -validity 10000 \
    -storepass maliai-dev-release \
    -keypass maliai-dev-release \
    -dname "CN=Polt Dev, OU=Mobile, O=MaliAI, L=Tehran, ST=Tehran, C=IR"
fi

cat > "$PROPS" <<EOF
storeFile=release.keystore
storePassword=maliai-dev-release
keyAlias=maliai-release
keyPassword=maliai-dev-release
EOF

echo "Created $PROPS and $KEYSTORE"
echo "For production, replace with your own keystore and passwords."
