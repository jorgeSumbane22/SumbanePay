/* ============================================================
   SumbanePay — core/auth-core.js
   ------------------------------------------------------------
   Responsabilidade única: hashing/verificação de password e
   guarda de sessão nas páginas protegidas.

   Por que este ficheiro existe:
   Substitui auth-guard.js + decrypt-fix.js. Duas mudanças de
   arquitectura importantes em relação à versão anterior:

   1. SEM fallback de password em texto simples "para sempre".
      Se encontrarmos uma conta com password em texto plano
      (herdada de uma versão antiga), fazemos a verificação UMA
      VEZ e imediatamente re-gravamos como PBKDF2, apagando o
      texto plano. Depois do primeiro login, a conta já está
      segura. Isto é diferente do código anterior, que aceitava
      texto plano indefinidamente.

   2. SEM tentativa de "adivinhar" chaves de encriptação
      perdidas (o que decrypt-fix.js fazia com uma lista de
      strings candidatas). Isso nunca foi uma solução válida —
      dados legados encriptados com uma chave desconhecida são
      considerados irrecuperáveis. A migração para PBKDF2 evita
      que isto volte a acontecer, porque não há chave nenhuma
      para perder: o hash não é reversível.

   Depende de: security-utils.js, storage-core.js,
   pbkdf2-fallback.js (carregar todos antes deste).
   ============================================================ */
(function (global) {
    'use strict';

    if (!global.SPStorage || !global.SPSecurity) {
        throw new Error('[SPAuth] Requer security-utils.js e storage-core.js carregados antes.');
    }
    if (!global.SPPbkdf2Fallback) {
        throw new Error('[SPAuth] Requer pbkdf2-fallback.js carregado antes (necessário para funcionar sem crypto.subtle).');
    }

    /* 150.000 iterações — deliberadamente mais baixo do que os
       600.000 recomendados pela OWASP para PBKDF2 nativo. É o
       mesmo algoritmo (RFC 8018) usado por dois motores possíveis:
       crypto.subtle (nativo, quando disponível) ou o fallback puro
       em pbkdf2-fallback.js (quando não está — ver hasSubtleCrypto()
       abaixo). Em JS puro, 150.000 iterações demoram <1s num
       portátil comum; 600.000 seria lento a mais num telemóvel
       mais fraco. Prioriza-se aqui "funcionar em qualquer
       navegador" sobre o máximo de robustez criptográfica —
       aceitável para uma aplicação local, sem backend. */
    var PBKDF2_ITERATIONS = 150000;
    var SESSION_DURATION_MS = 8 * 60 * 60 * 1000; // 8 horas

    var PUBLIC_PAGES = [
        'login.html',
        'cadastro.html',
        'recuperar-palavra-passe.html',
        'superadmin-login.html',
        '404.html',
        'suporte.html'
    ];

    /** crypto.subtle só existe em contexto seguro (HTTPS ou
     *  localhost). Como este projecto não tem servidor, é normal
     *  ser aberto via file:// ou HTTP simples — nesses casos isto
     *  devolve false, e usamos SPPbkdf2Fallback em vez de falhar
     *  (era esta a causa de "credenciais negadas" nalguns
     *  navegadores/contextos). */
    function hasSubtleCrypto() {
        try {
            return typeof crypto !== 'undefined' && !!crypto.subtle &&
                typeof crypto.subtle.importKey === 'function';
        } catch (e) {
            return false;
        }
    }

    function bytesToHex(bytes) {
        return Array.from(bytes).map(function (b) {
            return b.toString(16).padStart(2, '0');
        }).join('');
    }

    function hexToBytes(hex) {
        var matches = hex.match(/.{1,2}/g) || [];
        return Uint8Array.from(matches.map(function (b) { return parseInt(b, 16); }));
    }

    /** Gerador de aleatoriedade para o salt — usa
     *  crypto.getRandomValues quando disponível (quase sempre,
     *  mesmo sem crypto.subtle) e um fallback só para o caso
     *  extremo de nem isso existir. */
    function randomBytes(n) {
        if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
            return crypto.getRandomValues(new Uint8Array(n));
        }
        var out = new Uint8Array(n);
        for (var i = 0; i < n; i++) out[i] = Math.floor(Math.random() * 256);
        return out;
    }

    /**
     * Deriva `iterations` de PBKDF2-HMAC-SHA256 sobre
     * `password`/`salt`, usando crypto.subtle quando disponível e
     * caindo para o fallback puro em qualquer outro caso — inclui
     * falhas inesperadas da API nativa, não só a sua ausência. As
     * duas vias implementam o mesmo RFC 8018 e produzem o mesmo
     * resultado (validado bit-a-bit contra Node crypto).
     * @returns {Promise<Uint8Array>}
     */
    async function derivePbkdf2(password, salt, iterations) {
        if (hasSubtleCrypto()) {
            try {
                var enc = new TextEncoder();
                var keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
                var bits = await crypto.subtle.deriveBits(
                    { name: 'PBKDF2', salt: salt, iterations: iterations, hash: 'SHA-256' },
                    keyMaterial, 256
                );
                return new Uint8Array(bits);
            } catch (e) {
                console.warn('[SPAuth] crypto.subtle falhou, a usar fallback puro:', e.message);
            }
        }
        var passwordBytes = new TextEncoder().encode(password);
        return SPPbkdf2Fallback.derive(passwordBytes, salt, iterations, 32);
    }

    /**
     * Gera hash PBKDF2 no formato 'pbkdf2$iterações$saltHex$hashHex'.
     * Funciona em qualquer navegador — usa crypto.subtle quando
     * possível, e o fallback puro quando não (contexto não-seguro,
     * navegador antigo, etc.).
     * @param {string} password
     * @returns {Promise<string>}
     */
    async function hashPassword(password) {
        var salt = randomBytes(16);
        var derived = await derivePbkdf2(password, salt, PBKDF2_ITERATIONS);
        return 'pbkdf2$' + PBKDF2_ITERATIONS + '$' + bytesToHex(salt) + '$' + bytesToHex(derived);
    }

    async function verifyPbkdf2(plainPassword, hashString) {
        var parts = hashString.split('$');
        if (parts.length !== 4) return false;
        var iterations = parseInt(parts[1], 10) || PBKDF2_ITERATIONS;
        var salt = hexToBytes(parts[2]);
        var expected = parts[3];

        var derived = await derivePbkdf2(plainPassword, salt, iterations);
        var actual = bytesToHex(derived);
        return actual.length === expected.length && SPSecurity.constantTimeEqual(actual, expected);
    }

    /**
     * Verifica a password de um utilizador. Se a conta ainda tiver
     * password em texto plano (dado legado), verifica-a e, em caso
     * de sucesso, migra-a para PBKDF2 na mesma operação — a conta
     * nunca mais terá texto plano guardado depois deste login.
     * @param {string} plainPassword
     * @param {object} user objecto do utilizador (mutado em caso de migração)
     * @returns {Promise<boolean>}
     */
    async function verifyAndMigratePassword(plainPassword, user) {
        if (user.passwordHash && String(user.passwordHash).indexOf('pbkdf2$') === 0) {
            return verifyPbkdf2(plainPassword, user.passwordHash);
        }

        // Conta legada em texto plano: verificar e migrar imediatamente.
        if (user.password) {
            var matches = user.password === plainPassword;
            if (matches) {
                user.passwordHash = await hashPassword(plainPassword);
                delete user.password;
                persistMigratedUser(user);
            }
            return matches;
        }

        return false;
    }

    function persistMigratedUser(user) {
        var users = SPStorage.get(SPStorage.KEYS.USERS, []);
        var idx = users.findIndex(function (u) { return u.id === user.id || u.email === user.email; });
        if (idx !== -1) {
            users[idx] = user;
            SPStorage.forceSet(SPStorage.KEYS.USERS, users);
            console.log('[SPAuth] Password legada migrada para PBKDF2:', user.email);
        }
    }

    /* ---------------- Sessão ---------------- */

    function createSession(user, role) {
        var key = role === 'admin' ? SPStorage.KEYS.SESSION_ADMIN : SPStorage.KEYS.SESSION_VENDEDOR;
        var session = {
            userId: user.id,
            email: user.email,
            role: role,
            createdAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + SESSION_DURATION_MS).toISOString()
        };
        SPStorage.forceSet(key, session);
        return session;
    }

    function getActiveSession() {
        var admin = SPStorage.get(SPStorage.KEYS.SESSION_ADMIN, null);
        if (admin && isSessionValid(admin)) return { session: admin, role: 'admin' };

        var vendedor = SPStorage.get(SPStorage.KEYS.SESSION_VENDEDOR, null);
        if (vendedor && isSessionValid(vendedor)) return { session: vendedor, role: 'vendedor' };

        return null;
    }

    function isSessionValid(session) {
        if (!session || !session.expiresAt) return false;
        return new Date(session.expiresAt).getTime() > Date.now();
    }

    function clearSessions() {
        SPStorage.remove(SPStorage.KEYS.SESSION_ADMIN);
        SPStorage.remove(SPStorage.KEYS.SESSION_VENDEDOR);
    }

    function currentFileName() {
        var parts = window.location.pathname.toLowerCase().split('/');
        return parts[parts.length - 1] || '';
    }

    function isSuperAdminArea() {
        return window.location.pathname.toLowerCase().indexOf('/superadmin_sumbanepay/') !== -1;
    }

    /**
     * Chamar no topo de qualquer página protegida.
     * Redirecciona para o login correcto se não houver sessão válida,
     * ou se a área acedida (superadmin vs normal) não bater com o
     * papel da sessão activa.
     */
    function guardPage() {
        if (PUBLIC_PAGES.indexOf(currentFileName()) !== -1) return;

        var active = getActiveSession();
        var needsAdmin = isSuperAdminArea();

        if (active && ((needsAdmin && active.role === 'admin') || (!needsAdmin && active.role === 'vendedor'))) {
            return; // sessão válida e compatível com a área
        }

        clearSessions();
        var loginPage = needsAdmin ? 'superadmin-login.html' : 'login.html';
        var prefix = isSuperAdminArea() ? '' : (window.location.pathname.indexOf('/pages/') !== -1 ? '' : 'pages/');
        window.location.replace(prefix + loginPage + '?needLogin=1');
    }

    global.SPAuth = {
        hashPassword: hashPassword,
        verifyAndMigratePassword: verifyAndMigratePassword,
        createSession: createSession,
        getActiveSession: getActiveSession,
        clearSessions: clearSessions,
        guardPage: guardPage
    };

    // Executa a guarda automaticamente ao carregar, tal como o
    // auth-guard.js original — mantém o mesmo comportamento que
    // as ~40 páginas já esperam.
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', guardPage);
    } else {
        guardPage();
    }

})(window);
