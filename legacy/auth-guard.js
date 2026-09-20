/* ============================================================
   AUTH GUARD — SUMBANEPAY v8.1.0
   ------------------------------------------------------------
   Localização: pages/auth-guard.js
   
   ESTRUTURA SUPORTADA:
   
   pages/
   ├── auth-guard.js          ← este ficheiro
   ├── dashboard.html          → <script src="auth-guard.js">
   ├── pagamentos.html         → <script src="auth-guard.js">
   ├── relatorios.html         → <script src="auth-guard.js">
   ├── ...
   │
   └── superadmin_sumbanepay/
       ├── index.html          → <script src="../auth-guard.js">
       ├── utilizadores.html   → <script src="../auth-guard.js">
       ├── pagamentos.html     → <script src="../auth-guard.js">
       ├── faturacao.html      → <script src="../auth-guard.js">
       ├── relatorios.html     → <script src="../auth-guard.js">
       ├── actividades.html    → <script src="../auth-guard.js">
       ├── configuracoes.html  → <script src="../auth-guard.js">
       ├── notificacoes.html   → <script src="../auth-guard.js">
       ├── comunicacao.html    → <script src="../auth-guard.js">
       ├── roles.html          → <script src="../auth-guard.js">
       ├── seguranca.html      → <script src="../auth-guard.js">
       ├── suporte.html        → <script src="../auth-guard.js">
       ├── empresas.html       → <script src="../auth-guard.js">
       └── superadmin-login.html → PÚBLICA (não precisa)
   
   ✔ Aceita QUALQUER sessão válida (Vendedor OU SuperAdmin)
   ✔ Redireciona para o login CORRETO
   ✔ NUNCA apaga 'sumbanepay_users' nem 'sumbanepay_users_v2'
   ✔ Deteta e ignora 'sumbanepay_users' encriptado (CryptoJS)
   ============================================================ */

(function () {
    'use strict';

    /* ============================================================
       1. CONSTANTES
       ============================================================ */

    /* Chaves NUNCA podem ser apagadas */
    var PROTECTED_KEYS = [
        'sumbanepay_users',
        'sumbanepay_users_v2',
        'sumbanepay_users_backup',
        'sumbanepay_theme',
        'theme'
    ];

    /* TODAS as chaves de sessão aceites (Vendedor + SuperAdmin) */
    var ALL_SESSION_KEYS = [
        /* SuperAdmin */
        'sumbanepay_admin_session',
        'sz_admin_session',
        'admin_session',
        'superadmin_session',
        'sumbanepay_superadmin_session',
        /* Vendedor */
        'sumbanepay_session',
        'sz_session',
        'sumbanepay_user_session'
    ];

    /* Páginas públicas (não exigem sessão) */
    var PUBLIC_PAGES = [
        'login.html',
        'cadastro.html',
        'recuperar-palavra-passe.html',
        'superadmin-login.html',
        '404.html',
        'suporte.html'
    ];

    /* Chaves de dados dos utilizadores */
    var USERS_KEY_OLD = 'sumbanepay_users';
    var USERS_KEY_V2  = 'sumbanepay_users_v2';
    var CRYPTOJS_MARK = 'U2FsdGVkX1'; // prefixo CryptoJS AES

    /* ============================================================
       2. PROTECÇÃO DE STORAGE
       ============================================================ */
    (function protectStorage() {
        var origRemove = localStorage.removeItem.bind(localStorage);
        var origClear = localStorage.clear.bind(localStorage);
        var origSet = localStorage.setItem.bind(localStorage);

        localStorage.removeItem = function (key) {
            if (PROTECTED_KEYS.indexOf(key) !== -1) {
                console.error('🛡️ auth-guard: BLOQUEADO removeItem("' + key + '")');
                return;
            }
            return origRemove(key);
        };

        localStorage.clear = function () {
            console.warn('🛡️ auth-guard: clear() interceptado');
            var backup = {};
            PROTECTED_KEYS.forEach(function (k) {
                var v = localStorage.getItem(k);
                if (v !== null) backup[k] = v;
            });

            /* Preservar também todas as chaves sumbanepay_data_* */
            try {
                for (var i = 0; i < localStorage.length; i++) {
                    var k = localStorage.key(i);
                    if (k && k.indexOf('sumbanepay_data_') === 0) {
                        backup[k] = localStorage.getItem(k);
                    }
                }
            } catch (_) {}

            origClear.call(localStorage);

            Object.keys(backup).forEach(function (k) {
                try { origSet.call(localStorage, k, backup[k]); } catch (_) {}
            });
        };
    })();

    /* ============================================================
       3. CONTEXTO — Onde estamos?
       ============================================================ */

    function getPath() {
        return window.location.pathname.toLowerCase().replace(/\\/g, '/');
    }

    function getFileName() {
        var parts = getPath().split('/');
        return parts[parts.length - 1] || '';
    }

    function isPublicPage() {
        return PUBLIC_PAGES.indexOf(getFileName()) !== -1;
    }

    function isInSuperAdminFolder() {
        return getPath().indexOf('/superadmin_sumbanepay/') !== -1;
    }

    function isInPagesFolder() {
        return getPath().indexOf('/pages/') !== -1;
    }

    /* ============================================================
       4. SESSÕES
       ============================================================ */

    function isValidSession(raw) {
        if (!raw) return false;
        try {
            var s = JSON.parse(raw);
            if (!s || typeof s !== 'object') return false;

            if (s.expiresAt) {
                var exp = new Date(s.expiresAt).getTime();
                if (!isNaN(exp) && Date.now() > exp) return false;
            }
            return true;
        } catch (e) {
            return false;
        }
    }

    function findAnySession() {
        for (var i = 0; i < ALL_SESSION_KEYS.length; i++) {
            var key = ALL_SESSION_KEYS[i];

            try {
                var raw = localStorage.getItem(key);
                if (raw && isValidSession(raw)) {
                    return { key: key, storage: 'localStorage' };
                }
                if (raw) {
                    try { localStorage.removeItem(key); } catch (_) {}
                }
            } catch (_) {}

            try {
                var raw2 = sessionStorage.getItem(key);
                if (raw2 && isValidSession(raw2)) {
                    return { key: key, storage: 'sessionStorage' };
                }
                if (raw2) {
                    try { sessionStorage.removeItem(key); } catch (_) {}
                }
            } catch (_) {}
        }
        return null;
    }

    /* ============================================================
       5. MIGRAÇÃO / DIAGNÓSTICO DOS UTILIZADORES
       ============================================================ */

    /**
     * Deteta o estado do sumbanepay_users antigo e do novo.
     * NÃO apaga nada. Só informa na consola e, se o antigo for
     * JSON simples e o novo estiver vazio, migra automaticamente.
     */
    function migrateOldUsersIfNeeded() {
        var oldRaw = null;
        var newRaw = null;

        try { oldRaw = localStorage.getItem(USERS_KEY_OLD); } catch (_) {}
        try { newRaw = localStorage.getItem(USERS_KEY_V2); } catch (_) {}

        /* 1. Se o novo já tem dados, nada a fazer */
        if (newRaw && newRaw.charAt(0) === '[') {
            try {
                var arr = JSON.parse(newRaw);
                if (Array.isArray(arr) && arr.length > 0) {
                    return; // já está tudo bem
                }
            } catch (_) {}
        }

        /* 2. Sem chave antiga → nada a fazer */
        if (!oldRaw) return;

        /* 3. Chave antiga encriptada (CryptoJS) → ignorar sem apagar */
        if (oldRaw.indexOf(CRYPTOJS_MARK) === 0) {
            console.warn(
                '🛡️ auth-guard: ' + USERS_KEY_OLD + ' está encriptado (CryptoJS). ' +
                'Ignorado — usa ' + USERS_KEY_V2 + ' a partir de agora.'
            );
            return;
        }

        /* 4. Chave antiga em JSON simples → migrar automaticamente */
        if (oldRaw.charAt(0) === '[') {
            try {
                var arrOld = JSON.parse(oldRaw);
                if (Array.isArray(arrOld) && arrOld.length > 0) {
                    try {
                        localStorage.setItem(USERS_KEY_V2, oldRaw);
                        console.log(
                            '✅ auth-guard: migrados ' + arrOld.length +
                            ' utilizadores de ' + USERS_KEY_OLD + ' → ' + USERS_KEY_V2
                        );
                    } catch (_) {}
                }
            } catch (e) {
                console.warn('⚠️ auth-guard: ' + USERS_KEY_OLD + ' parece JSON mas está inválido.');
            }
        }
    }

    /* ============================================================
       6. RESOLVER CAMINHO DO LOGIN
       ============================================================ */

    function resolveLoginPath() {
        var path = getPath();

        if (path.indexOf('/superadmin_sumbanepay/') !== -1) {
            return 'superadmin-login.html';
        }
        if (path.indexOf('/pages/') !== -1) {
            return 'login.html';
        }
        return 'pages/login.html';
    }

    function redirectToLogin() {
        var target = resolveLoginPath();

        console.log('🔒 auth-guard v8.1: sem sessão — redireccionar para ' + target);

        ALL_SESSION_KEYS.forEach(function (k) {
            try { localStorage.removeItem(k); } catch (_) {}
            try { sessionStorage.removeItem(k); } catch (_) {}
        });

        window.location.replace(target + '?needLogin=1&t=' + Date.now());
    }

    /* ============================================================
       7. LÓGICA PRINCIPAL
       ============================================================ */

    function boot() {
        var file = getFileName();
        var path = getPath();
        var isSuperAdmin = isInSuperAdminFolder();

        /* ---- 0. Migração / diagnóstico dos utilizadores ---- */
        migrateOldUsersIfNeeded();

        /* ---- 1. Página pública → deixar passar ---- */
        if (isPublicPage()) {
            console.log('✅ auth-guard v8.1: página pública — ' + file);
            return;
        }

        /* ---- 2. Procurar sessão válida ---- */
        var session = findAnySession();

        if (session) {
            console.log('✅ auth-guard v8.1: sessão válida — ' + file +
                        ' (' + session.key + ' em ' + session.storage +
                        ') | superadmin: ' + isSuperAdmin);
            return;
        }

        /* ---- 3. Sem sessão → redirecionar ---- */
        console.log('⚠️ auth-guard v8.1: NENHUMA sessão válida em ' + path);
        redirectToLogin();
    }

    /* ============================================================
       8. EXECUÇÃO
       ============================================================ */

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }

    /* ============================================================
       9. API PÚBLICA (para debug)
       ============================================================ */

    window.authGuard = {
        VERSION: 'v8.1.0',
        findAnySession: findAnySession,
        isPublicPage: isPublicPage,
        isInSuperAdminFolder: isInSuperAdminFolder,
        isInPagesFolder: isInPagesFolder,
        resolveLoginPath: resolveLoginPath,
        migrateOldUsersIfNeeded: migrateOldUsersIfNeeded,
        ALL_SESSION_KEYS: ALL_SESSION_KEYS,
        PROTECTED_KEYS: PROTECTED_KEYS,
        USERS_KEY_OLD: USERS_KEY_OLD,
        USERS_KEY_V2: USERS_KEY_V2
    };

    console.log('🛡️ auth-guard v8.1.0 activo em ' + getPath());

})();