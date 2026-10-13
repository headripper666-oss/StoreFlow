// Tests de la logique de la page de démarrage : `node --test` dans apk/
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { isStoreFlowHealth, isNewer, apkFileName } = require('../www/logic.js');

test('isStoreFlowHealth reconnaît la réponse du serveur StoreFlow', () => {
  assert.equal(isStoreFlowHealth({ ok: true, clients: 0, githubRepo: 'headripper666-oss/storeflow-data' }), true);
  // Serveur pas encore configuré : githubRepo présent mais vide
  assert.equal(isStoreFlowHealth({ ok: true, clients: 0, githubRepo: null }), true);
  assert.equal(isStoreFlowHealth({ ok: true }), false);
  assert.equal(isStoreFlowHealth({ code: 200, message: 'API is healthy.' }), false);
  assert.equal(isStoreFlowHealth(null), false);
});

test('isNewer compare les versionCode', () => {
  assert.equal(isNewer({ versionCode: 1 }, { versionCode: 2 }), true);
  assert.equal(isNewer({ versionCode: 2 }, { versionCode: 2 }), false);
  assert.equal(isNewer({ versionCode: 3 }, { versionCode: 2 }), false);
  assert.equal(isNewer(null, { versionCode: 2 }), false);
});

test('apkFileName accepte seulement un nom StoreFlow-x.y.apk', () => {
  assert.equal(apkFileName({ file: 'StoreFlow-1.1.apk' }), 'StoreFlow-1.1.apk');
  assert.equal(apkFileName({ file: '../autre.apk' }), 'StoreFlow.apk');
  assert.equal(apkFileName({ file: 'CongeFlow-1.1.apk' }), 'StoreFlow.apk');
  assert.equal(apkFileName({}), 'StoreFlow.apk');
});
