/* ============================================================
   SumbanePay — users-lock.js
   ------------------------------------------------------------
   Impede que qualquer script apague, esvazie ou reduza a lista
   de utilizadores gravada em 'sumbanepay_users' e
   'sumbanepay_users_v2'.

   • Só permite escrita se a nova lista for >= à atual
   • Bloqueia '[]', '', 'null', 'undefined' e valores encriptados
   • Bloqueia qualquer tentativa de redução de utilizadores

   TEM DE SER CARREGADO ANTES DE QUALQUER OUTRO <script>.
   ============================================================ */
(function () {
    'use strict';

    if (window.__spUsersLock) return;
    window.__spUsersLock = true;

    var WATCHED = ['sumbanepay_users', 'sumbanepay_users_v2'];
    var CRYPTOJS_MARK = 'U2FsdGVkX1';

    function countUsers(raw) {
        if (!raw || typeof raw !== 'string') return 0;
        if (raw.indexOf(CRYPTOJS_MARK) === 0) return 0;
        try {
            var parsed = JSON.parse(raw);
            if (!Array.isArray(parsed)) return 0;
            return parsed.filter(function (u) {
                return u && typeof u === 'object' && u.email;
            }).length;
        } catch (e) { return 0; }
    }

    function isBadValue(value) {
        if (typeof value !== 'string') return true;
        if (value === '' || value === '[]' || value === 'null' || value === 'undefined') return true;
        if (value.indexOf(CRYPTOJS_MARK) === 0) return true;
        return false;
    }

    var origSet = Storage.prototype.setItem;

    Storage.prototype.setItem = function (key, value) {
        if (WATCHED.indexOf(key) === -1) {
            return origSet.apply(this, arguments);
        }

        var atual = null;
        try { atual = this.getItem(key); } catch (e) {}
        var atualCount = countUsers(atual);

        // Bloqueia escrita inválida se já existem utilizadores
        if (isBadValue(value) && atualCount > 0) {
            console.warn('🛡️ users-lock: bloqueada escrita inválida em "' + key +
                         '" (tinha ' + atualCount + ' utilizadores)');
            return;
        }

        // Bloqueia redução da lista
        var novaCount = countUsers(value);
        if (novaCount < atualCount) {
            console.warn('🛡️ users-lock: bloqueada redução em "' + key +
                         '" (' + atualCount + ' → ' + novaCount + ')');
            return;
        }

        return origSet.apply(this, arguments);
    };

    console.log('🛡️ users-lock activo — protegendo ' + WATCHED.join(', '));
})();