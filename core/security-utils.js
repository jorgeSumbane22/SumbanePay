/* ============================================================
   SumbanePay — core/security-utils.js
   ------------------------------------------------------------
   Responsabilidade única: funções puras de sanitização/escaping
   de dados vindos do utilizador antes de irem para o DOM.

   Por que este ficheiro existe:
   Foi encontrado XSS armazenado em várias páginas (clientes.html,
   vendas.html, produtos.html e páginas do superadmin), onde
   campos como nome/email/morada do cliente iam directo para
   `innerHTML` sem qualquer escaping. Este módulo centraliza a
   solução para não depender de cada página lembrar de escapar
   manualmente.

   Carregar ANTES de qualquer script de página que manipule DOM
   com dados guardados:
       <script src="../core/security-utils.js"></script>
   ============================================================ */
(function (global) {
    'use strict';

    var ESCAPE_MAP = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
        '/': '&#x2F;'
    };

    /**
     * Escapa uma string para uso seguro dentro de HTML (innerHTML,
     * template literals injectados no DOM, atributos).
     * Uso: `<td>${escapeHtml(cliente.nome)}</td>`
     * @param {*} value valor a escapar (não-strings são convertidos)
     * @returns {string}
     */
    function escapeHtml(value) {
        if (value === null || value === undefined) return '';
        return String(value).replace(/[&<>"'/]/g, function (ch) {
            return ESCAPE_MAP[ch];
        });
    }

    /**
     * Sanitiza texto de formulário: remove tags, colapsa espaços,
     * limita comprimento. Usar ao GUARDAR dados (não substitui
     * escapeHtml ao RENDERIZAR — as duas camadas são necessárias:
     * sanitizeInput impede que a "sujeira" persista nos dados;
     * escapeHtml impede que o que já está guardado quebre o DOM).
     * @param {string} value
     * @param {number} [maxLength=500]
     * @returns {string}
     */
    function sanitizeInput(value, maxLength) {
        if (typeof value !== 'string') return '';
        maxLength = maxLength || 500;
        return value
            .replace(/<[^>]*>/g, '')
            .replace(/[<>]/g, '')
            .trim()
            .substring(0, maxLength);
    }

    /**
     * Comparação em tempo constante entre duas strings hex de
     * igual comprimento esperado — evita timing attacks ao
     * comparar hashes/tokens.
     * @param {string} a
     * @param {string} b
     * @returns {boolean}
     */
    function constantTimeEqual(a, b) {
        if (typeof a !== 'string' || typeof b !== 'string') return false;
        if (a.length !== b.length) return false;
        var diff = 0;
        for (var i = 0; i < a.length; i++) {
            diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
        }
        return diff === 0;
    }

    /**
     * Validação simples de e-mail (mesma regex já usada em
     * cadastro.html — extraída para reutilização).
     * @param {string} email
     * @returns {boolean}
     */
    function isValidEmail(email) {
        return typeof email === 'string' && email.length <= 150 &&
            /^[a-zA-Z0-9](?:[a-zA-Z0-9._%+-]{0,62}[a-zA-Z0-9])?@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/.test(email);
    }

    global.SPSecurity = {
        escapeHtml: escapeHtml,
        sanitizeInput: sanitizeInput,
        constantTimeEqual: constantTimeEqual,
        isValidEmail: isValidEmail
    };

})(window);
