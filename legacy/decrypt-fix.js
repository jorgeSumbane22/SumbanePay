/* ============================================================
   SumbanePay — decrypt-fix.js
   Tenta migrar sumbanepay_users (encriptado) → sumbanepay_users_v2 (JSON simples).
   Se não conseguir desencriptar, não faz nada. Seguro correr sempre.
   ============================================================ */
(function () {
  'use strict';

  var OLD_KEY  = 'sumbanepay_users';
  var NEW_KEY  = 'sumbanepay_users_v2';
  var BACKUP   = 'sumbanepay_users_backup';
  var MARK     = 'U2FsdGVkX1';

  // Chaves prováveis no teu projeto
  var CANDIDATES = [
    'sumbanepay', 'SumbanePay', 'SumbanePay2024', 'SumbanePay2025',
    'sumbanepay_secret', 'sumbanepay_key', 'sumbanepay2024', 'sumbanepay2025',
    'sz_secret', 'sz_key', 'sumbane', 'jsumbane22',
    'sumbanepay_admin', 'admin', 'secret', 'SumbanePay2023'
  ];

  function isEncrypted(v) {
    return typeof v === 'string' && v.indexOf(MARK) === 0;
  }

  function isValidJson(s) {
    if (!s) return false;
    var t = s.replace(/^\uFEFF/, '').trim();
    if (t.charAt(0) !== '[' && t.charAt(0) !== '{') return false;
    try { JSON.parse(t); return true; } catch (e) { return false; }
  }

  function tryDecrypt(raw, key) {
    if (typeof CryptoJS === 'undefined') return null;
    try {
      var plain = CryptoJS.AES.decrypt(raw, key).toString(CryptoJS.enc.Utf8);
      return isValidJson(plain) ? plain.trim() : null;
    } catch (e) { return null; }
  }

  function migrate() {
    // Se já existe v2 com dados, não fazer nada
    try {
      var existing = localStorage.getItem(NEW_KEY);
      if (existing && isValidJson(existing) && existing !== '[]') {
        console.log('✅ ' + NEW_KEY + ' já existe. Nada a migrar.');
        return;
      }
    } catch (e) {}

    var raw = null;
    try { raw = localStorage.getItem(OLD_KEY); } catch (e) {}

    if (!raw) {
      console.log('ℹ️ ' + OLD_KEY + ' vazio. Nada a migrar.');
      return;
    }

    // Se já é JSON simples, migrar diretamente
    if (!isEncrypted(raw)) {
      if (isValidJson(raw)) {
        try {
          localStorage.setItem(NEW_KEY, raw);
          console.log('✅ ' + OLD_KEY + ' já era JSON simples → copiado para ' + NEW_KEY);
        } catch (e) {}
      }
      return;
    }

    // Está encriptado — tentar desencriptar
    console.log('🔓 ' + OLD_KEY + ' encriptado. A tentar chaves candidatas...');

    if (typeof CryptoJS === 'undefined') {
      console.warn('⚠️ CryptoJS não carregado. Não é possível desencriptar agora.');
      return;
    }

    for (var i = 0; i < CANDIDATES.length; i++) {
      var plain = tryDecrypt(raw, CANDIDATES[i]);
      if (plain) {
        try {
          localStorage.setItem(NEW_KEY, plain);
          console.log('✅ CHAVE ENCONTRADA: "' + CANDIDATES[i] + '"');
          console.log('✅ Migrados ' + JSON.parse(plain).length + ' utilizadores para ' + NEW_KEY);
        } catch (e) {}
        return;
      }
    }

    console.warn('❌ Não foi possível desencriptar. Utilizadores antigos ficam inacessíveis.');
    console.warn('   Solução: criar contas novas via cadastro.html.');
  }

  // Aguardar CryptoJS se ainda não estiver disponível
  var tries = 0;
  var timer = setInterval(function () {
    tries++;
    if (typeof CryptoJS !== 'undefined' || tries > 20) {
      clearInterval(timer);
      migrate();
    }
  }, 100);
})();