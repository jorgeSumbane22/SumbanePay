/*
 * SumbanePay — proteção de páginas autenticadas.
 * Incluir antes do conteúdo da página protegida:
 * <script src="../auth-guard.js"></script>
 */
(function (window) {
    'use strict';

    const CONFIG = {
        sessionKey: 'sumbanepay_session',
        legacySessionKey: 'sz_session',
        loginPath: './login.html'
    };

    function readSession() {
        const raw = window.sessionStorage.getItem(CONFIG.sessionKey)
            || window.localStorage.getItem(CONFIG.sessionKey);
        if (!raw) return null;

        try {
            const session = JSON.parse(raw);
            return session && session.userId ? session : null;
        } catch (_) {
            return null;
        }
    }

    function clearSession() {
        [CONFIG.sessionKey, CONFIG.legacySessionKey, 'sz_admin_session', 'sumbanepay_admin_session']
            .forEach(key => {
                window.sessionStorage.removeItem(key);
                window.localStorage.removeItem(key);
            });
    }

    function redirectToLogin(reason) {
        clearSession();
        const url = new URL(CONFIG.loginPath, window.location.href);
        url.searchParams.set('reason', reason || 'unauthorized');
        window.location.replace(url.href);
    }

    function requireAuthentication() {
        if (!readSession()) {
            redirectToLogin('unauthorized');
            return false;
        }
        return true;
    }

    function logout() {
        redirectToLogin('logout');
    }

    window.SumbanePayAuth = Object.freeze({
        readSession,
        clearSession,
        requireAuthentication,
        logout
    });

    // Bloqueia o acesso direto assim que o script for carregado.
    window.SumbanePayAuth.requireAuthentication();
})(window);
