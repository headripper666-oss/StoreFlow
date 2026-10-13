// Logique pure de la page de démarrage (testée par apk/test/logic.test.js avec `node --test`).
// Chargée dans l'appli par <script src="logic.js"> (objet global StoreLogic) et dans Node par require().
(function (exports) {
  // Vrai si la réponse de /health vient bien du serveur StoreFlow
  // (et pas d'un autre appareil qui aurait la même adresse sur un réseau inconnu)
  function isStoreFlowHealth(data) {
    return Boolean(data) && data.ok === true && Object.prototype.hasOwnProperty.call(data, 'githubRepo');
  }

  // Vrai si le serveur propose une version plus récente que celle installée
  function isNewer(installed, available) {
    return Boolean(installed && available) && Number(available.versionCode) > Number(installed.versionCode);
  }

  // Nom du fichier APK à télécharger : versionné (StoreFlow-1.1.apk) pour que Chrome
  // ne propose pas de rouvrir un ancien téléchargement ; nom fixe en repli
  function apkFileName(available) {
    const file = available && available.file;
    return /^StoreFlow-[0-9][0-9.]*\.apk$/.test(String(file)) ? file : 'StoreFlow.apk';
  }

  exports.isStoreFlowHealth = isStoreFlowHealth;
  exports.isNewer = isNewer;
  exports.apkFileName = apkFileName;
})(typeof module !== 'undefined' ? module.exports : (window.StoreLogic = {}));
