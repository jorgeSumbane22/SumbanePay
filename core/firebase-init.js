/* ============================================================
   SumbanePay — core/firebase-init.js
   ------------------------------------------------------------
   Responsabilidade única: inicializar o Firebase (Auth +
   Firestore) uma única vez e expor `SPFirebase` com o que as
   páginas precisam.

   Por que este ficheiro existe:
   Antes, cada "sessão" e cada "utilizador" viviam só no
   localStorage de um browser — por isso um registo feito no
   telemóvel nunca aparecia no PC (localStorage nunca sincroniza
   entre dispositivos, mesmo com o código de auth correcto). O
   Firebase Authentication + Cloud Firestore resolvem isto: a
   conta e o perfil passam a existir na nuvem, não num dispositivo.

   Carregar (por esta ordem) antes de qualquer página que use
   SPFirebase:
       <script src="https://www.gstatic.com/firebasejs/11.10.0/firebase-app-compat.js"></script>
       <script src="https://www.gstatic.com/firebasejs/11.10.0/firebase-auth-compat.js"></script>
       <script src="https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore-compat.js"></script>
       <script src="../core/firebase-init.js"></script>

   IMPORTANTE — isto NÃO é um segredo: a firebaseConfig abaixo
   (apiKey incluída) é pública por definição no modelo do Firebase.
   Quem protege os dados são as REGRAS DE SEGURANÇA do Firestore
   (Firebase Console → Firestore Database → Regras), não esconder
   esta configuração. Ver FIRESTORE_RULES.md na raiz do projecto
   para as regras que este projecto espera.
   ============================================================ */
(function (global) {
    'use strict';

    if (typeof firebase === 'undefined') {
        throw new Error('[SPFirebase] SDK do Firebase não carregado. Inclui os <script> da CDN antes deste ficheiro.');
    }

    var firebaseConfig = {
        apiKey: "AIzaSyCgClpWAMIDYKp19wDldcymQI6mGiaM1CU",
        authDomain: "sumbane-pay.firebaseapp.com",
        projectId: "sumbane-pay",
        storageBucket: "sumbane-pay.firebasestorage.app",
        messagingSenderId: "748808915725",
        appId: "1:748808915725:web:9170f24011540d257bbe44"
    };

    // Evita "Firebase App named '[DEFAULT]' already exists" se este
    // ficheiro for incluído mais do que uma vez por engano.
    var app = firebase.apps.length ? firebase.apps[0] : firebase.initializeApp(firebaseConfig);

    global.SPFirebase = {
        app: app,
        auth: firebase.auth(),
        db: firebase.firestore(),
        SUPERADMIN_EMAIL: 'jsumbane22@gmail.com',

        /** Traduz os códigos de erro do Firebase Auth para
         *  mensagens em português, para não mostrar strings
         *  técnicas em inglês ao utilizador final. */
        translateAuthError: function (error) {
            var map = {
                'auth/email-already-in-use': 'Este email já está registado.',
                'auth/invalid-email': 'Email inválido.',
                'auth/weak-password': 'Password demasiado fraca (mínimo 6 caracteres).',
                'auth/user-not-found': 'Email ou password incorrectos.',
                'auth/wrong-password': 'Email ou password incorrectos.',
                'auth/invalid-credential': 'Email ou password incorrectos.',
                'auth/invalid-login-credentials': 'Email ou password incorrectos.',
                'auth/too-many-requests': 'Demasiadas tentativas. Tenta novamente daqui a alguns minutos.',
                'auth/network-request-failed': 'Sem ligação à internet. Verifica a tua rede e tenta novamente.',
                'auth/user-disabled': 'Esta conta foi desactivada.'
            };
            return map[error && error.code] || ('Erro: ' + (error && error.message ? error.message : 'desconhecido'));
        }
    };

})(window);
