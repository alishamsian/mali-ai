#!/usr/bin/env node
/**
 * Google Maven is unreachable in some networks. Prepend Aliyun mirrors
 * inside the React Native included Gradle plugin so AGP can resolve.
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', 'node_modules', '@react-native', 'gradle-plugin');
const files = [
  'settings.gradle.kts',
  'react-native-gradle-plugin/build.gradle.kts',
  'settings-plugin/build.gradle.kts',
];

const marker = 'maven.aliyun.com/repository/google';

for (const rel of files) {
  const file = path.join(root, rel);
  if (!fs.existsSync(file)) {
    continue;
  }
  let src = fs.readFileSync(file, 'utf8');
  if (src.includes(marker)) {
    continue;
  }
  src = src.replace(
    /repositories \{\n(\s+)google\(\)/,
    `repositories {\n$1maven { url = uri("https://maven.aliyun.com/repository/google") }\n$1maven { url = uri("https://maven.aliyun.com/repository/public") }\n$1google()`,
  );
  fs.writeFileSync(file, src);
  console.log('patched', rel);
}

// RN 0.81 codegen still requires React.ElementRef, while screens 4.27 uses ComponentRef.
const screensFabric = path.join(
  __dirname,
  '..',
  'node_modules',
  'react-native-screens',
  'src',
  'fabric',
);
function walk(dir) {
  if (!fs.existsSync(dir)) {
    return;
  }
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) {
      walk(p);
      continue;
    }
    if (!p.endsWith('.ts')) {
      continue;
    }
    let src = fs.readFileSync(p, 'utf8');
    if (!src.includes('React.ComponentRef<')) {
      continue;
    }
    src = src.replaceAll('React.ComponentRef<', 'React.ElementRef<');
    fs.writeFileSync(p, src);
    console.log('patched screens codegen', path.relative(screensFabric, p));
  }
}
walk(screensFabric);

const formSheet = path.join(
  __dirname,
  '..',
  'node_modules',
  'react-native-screens',
  'android/src/main/java/com/swmansion/rnscreens/gamma/modals/formsheet/FormSheetContentView.kt',
);
if (fs.existsSync(formSheet)) {
  let kt = fs.readFileSync(formSheet, 'utf8');
  const next = kt.replace(
    'jsTouchDispatcher.onChildStartedNativeGesture(ev, eventDispatcher, themedReactContext)',
    'jsTouchDispatcher.onChildStartedNativeGesture(ev, eventDispatcher)',
  );
  if (next !== kt) {
    fs.writeFileSync(formSheet, next);
    console.log('patched screens FormSheetContentView for RN 0.81');
  }
}
