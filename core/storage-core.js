/* ============================================================
   SumbanePay — core/storage-core.js
   ------------------------------------------------------------
   Responsabilidade única: única porta de entrada/saída para o
   localStorage do projecto.

   Por que este ficheiro existe:
   O projecto tinha 3 scripts sobrepostos (auth-guard.js,
   users-lock.js, decrypt-fix.js) todos mexendo em localStorage
   de formas diferentes, incluindo sobrescrever
   Storage.prototype.setItem/removeItem/clear globalmente — o que
   é uma "acção à distância": qualquer script em qualquer página
   pode ser silenciosamente bloqueado sem saber porquê, e é
   praticamente impossível de testar isoladamente.

   Este módulo substitui essa abordagem por uma API explícita:
   em vez de interceptar o localStorage inteiro, expomos
   SPStorage.get/set/remove. Só quem USA esta API fica protegido
   — o que é suficiente, porque todo o código novo deve passar
   por aqui.

   NOMENCLATURA: o projecto tinha sumbanepay_users, sumbanepay_users_v2,
   sumbanepay_usuarios E sumbanepay_utilizadores coexistindo — e foi
   exactamente essa dispersão que causava um utilizador registado em
   cadastro.html não aparecer sempre no superadmin ou no login.
   A partir de agora existe UMA fonte de verdade: o objecto KEYS
   abaixo. Os nomes escolhidos são os mesmos que já dominavam o
   projecto ('sumbanepay_users', 'sumbanepay_session',
   'sumbanepay_admin_session') — não 'sp_*' — precisamente para que
   as páginas ainda não migradas para este módulo (que já lêem estes
   nomes como fallback) continuem compatíveis sem precisar de ser
   tocadas todas de uma vez.

   Dados por-utilizador (clientes, vendas, produtos, etc.) seguem um
   modelo diferente neste projecto: são namespaced por utilizador
   como 'sumbanepay_data_<userId>_<sufixo>' (ver index.html do
   superadmin). Para isso, usar SPStorage.userKey(userId, sufixo)
   em vez de uma chave fixa — ver função abaixo.

   Carregar depois de security-utils.js e antes de auth-core.js:
       <script src="../core/security-utils.js"></script>
       <script src="../core/storage-core.js"></script>
   ============================================================ */
(function (global) {
    'use strict';

    var SCHEMA_VERSION = 3;

    /** Única fonte de verdade para nomes de chave globais. */
    var KEYS = {
        USERS: 'sumbanepay_users',
        SESSION_VENDEDOR: 'sumbanepay_session',
        SESSION_ADMIN: 'sumbanepay_admin_session',
        THEME: 'sumbanepay_theme'
    };

    /** Chaves antigas (geradas pelas várias versões anteriores),
     *  usadas SÓ para migração de leitura, nunca mais escritas. */
    var LEGACY_KEYS = {
        USERS: ['sumbanepay_users_v2', 'sumbanepay_users_backup', 'sumbanepay_users_backup_v2', 'sumbanepay_usuarios', 'sumbanepay_utilizadores'],
        THEME: ['theme']
    };

    /** Colecções onde uma escrita que reduza o nº de itens é
     *  quase sempre um bug (ex: JSON.parse falhou e alguém vai
     *  gravar '[]' por engano) e deve ser bloqueada com aviso,
     *  em vez de corrompida silenciosamente. */
    var GUARDED_COLLECTIONS = [KEYS.USERS];

    function safeParse(raw, fallback) {
        if (raw === null || raw === undefined) return fallback;
        try {
            var parsed = JSON.parse(raw);
            return parsed === null || parsed === undefined ? fallback : parsed;
        } catch (e) {
            console.error('[SPStorage] JSON inválido, a ignorar:', e.message);
            return fallback;
        }
    }

    function countItems(value) {
        return Array.isArray(value) ? value.length : 0;
    }

    /**
     * Lê uma chave, com fallback e migração automática (uma vez)
     * a partir de chaves legadas equivalentes.
     * @param {string} key uma das constantes de KEYS
     * @param {*} [fallback=null]
     */
    function get(key, fallback) {
        fallback = fallback === undefined ? null : fallback;
        try {
            var raw = localStorage.getItem(key);
            if (raw !== null) return safeParse(raw, fallback);
        } catch (e) {
            console.error('[SPStorage] Falha ao ler "' + key + '":', e.message);
            return fallback;
        }

        // Migração best-effort a partir de chaves legadas (uma única vez;
        // a próxima leitura já encontra o valor em `key` e nem chega aqui)
        var legacyValue = findLegacyValue(key);
        if (legacyValue !== undefined) {
            set(key, legacyValue); // já migra para a chave nova
            return legacyValue;
        }

        return fallback;
    }

    function findLegacyValue(canonicalKey) {
        var group = Object.keys(KEYS).find(function (name) { return KEYS[name] === canonicalKey; });
        var legacyKeys = group && LEGACY_KEYS[group];
        if (!legacyKeys) return undefined;

        for (var i = 0; i < legacyKeys.length; i++) {
            try {
                var raw = localStorage.getItem(legacyKeys[i]);
                if (raw === null) continue;
                // Ignora valores encriptados (CryptoJS) — dados legados
                // irrecuperáveis. Não tentamos mais "adivinhar" a chave:
                // isso nunca deveria ter sido uma estratégia de produto.
                if (raw.indexOf('U2FsdGVkX1') === 0) continue;
                var parsed = safeParse(raw, undefined);
                if (parsed !== undefined) return parsed;
            } catch (e) { /* ignora e tenta a próxima */ }
        }
        return undefined;
    }

    /**
     * Escreve uma chave. Para colecções em GUARDED_COLLECTIONS,
     * recusa escritas que reduzam a contagem de itens (protege
     * contra apagar utilizadores/clientes por um bug de outro
     * lugar do código) e explica porquê na consola, em vez de
     * falhar silenciosamente.
     * @param {string} key
     * @param {*} value
     * @returns {boolean} true se a escrita foi aceite
     */
    function set(key, value) {
        if (GUARDED_COLLECTIONS.indexOf(key) !== -1) {
            var current = get(key, []);
            var currentCount = countItems(current);
            var nextCount = countItems(value);
            if (nextCount < currentCount) {
                console.warn(
                    '[SPStorage] Escrita recusada em "' + key + '": reduziria ' +
                    currentCount + ' → ' + nextCount + ' itens. ' +
                    'Se isto é intencional (ex: apagar 1 cliente), usa SPStorage.forceSet().'
                );
                return false;
            }
        }
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (e) {
            console.error('[SPStorage] Falha ao gravar "' + key + '":', e.message);
            return false;
        }
    }

    /**
     * Escrita explícita que ignora a protecção de redução.
     * Usar apenas em acções deliberadas do utilizador (ex: apagar
     * cliente através de um botão "Apagar", nunca em código
     * genérico de sincronização).
     */
    function forceSet(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (e) {
            console.error('[SPStorage] Falha ao gravar "' + key + '":', e.message);
            return false;
        }
    }

    function remove(key) {
        try {
            localStorage.removeItem(key);
            return true;
        } catch (e) {
            return false;
        }
    }

    /**
     * Gera a chave namespaced por utilizador usada para dados que
     * pertencem a um vendedor específico (clientes, vendas, produtos,
     * etc.), seguindo o padrão já existente no projecto:
     * 'sumbanepay_data_<userId>_<sufixo>'.
     * @param {string} userId
     * @param {string} suffix ex: 'clientes', 'vendas', 'produtos'
     */
    function userKey(userId, suffix) {
        if (!userId) throw new Error('[SPStorage] userKey requer um userId.');
        return 'sumbanepay_data_' + userId + '_' + suffix;
    }

    global.SPStorage = {
        KEYS: KEYS,
        SCHEMA_VERSION: SCHEMA_VERSION,
        get: get,
        set: set,
        forceSet: forceSet,
        remove: remove,
        userKey: userKey
    };

})(window);
