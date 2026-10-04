# Ficheiros arquivados

Estes ficheiros foram substituídos pelos módulos em `../core/`
(`security-utils.js`, `storage-core.js`, `auth-core.js`) e **já não são
carregados por nenhuma página**. Mantidos aqui só como histórico.

| Ficheiro | Porque foi substituído |
|---|---|
| `auth-guard.js` | Intercepta `Storage.prototype` globalmente (acção-à-distância difícil de depurar) e **não distinguia sessão de Vendedor de sessão de SuperAdmin** — uma falha de autorização real. Substituído por `core/auth-core.js`. |
| `users-lock.js` | Também intercepta `Storage.prototype` globalmente. Nunca foi carregado automaticamente por nenhuma página — dependia do `install-lock.bat`. |
| `decrypt-fix.js` | Tentava "adivinhar" a chave de encriptação de `sumbanepay_users` a partir de uma lista de strings fixas. Isto era um remendo para um bug noutro sítio (ver abaixo) — nunca deveria ter sido necessário. |
| `install-lock.bat` | Script Windows que injectava manualmente a tag `<script>` do `users-lock.js` em cada página HTML. Frágil e não multiplataforma. |
| `test-auth-flow.js` | Script de debug manual (executado à mão na consola), não uma suite de testes automatizada. |

## Correcção adicional: "credenciais negadas nalguns navegadores"

`hashPassword`/`verifyPbkdf2` dependiam exclusivamente de `crypto.subtle`,
que só existe em **contexto seguro** (HTTPS, ou `http://localhost`). Como
este projecto não tem servidor, é normal ser aberto via `file://` ou
hospedado em HTTP simples — nesses casos `crypto.subtle` fica
`undefined` em Chrome, Firefox e Safari, e o login falhava sempre,
mesmo com a password certa.

Foi adicionado `core/pbkdf2-fallback.js`: uma implementação de
PBKDF2-HMAC-SHA256 em JavaScript puro, sem nenhuma dependência do
navegador, validada bit-a-bit contra `crypto.pbkdf2Sync` do Node.js.
`core/auth-core.js` agora usa `crypto.subtle` quando disponível
(mais rápido) e este fallback em qualquer outro caso — os dois
produzem exactamente o mesmo resultado para os mesmos dados, por
isso um hash criado num navegador com Web Crypto é verificado
correctamente noutro sem ele, e vice-versa (testado).

## Migração para Firebase — "registei no telemóvel, não entra no PC"

Toda a secção acima resolvia bugs *dentro* do modelo "tudo em
`localStorage`" — mas esse modelo tem um limite físico: `localStorage`
nunca sincroniza entre dispositivos, mesmo com o código de auth
perfeito. Um registo feito no telemóvel nunca poderia aparecer no PC
enquanto a "base de dados" fosse o `localStorage` de cada aparelho.

A solução foi migrar autenticação e perfis de utilizador para
**Firebase Authentication + Cloud Firestore** (`core/firebase-init.js`,
ver `FIRESTORE_RULES.md` na raiz do projecto para as regras de
segurança). `cadastro.html`, `login.html` e
`superadmin_sumbanepay/utilizadores.html` foram reescritos para usar
isto — o último, inclusive, com sincronização em **tempo real**
(`onSnapshot`), por isso um registo aparece no superadmin
instantaneamente, sem sequer recarregar a página.

Nesta migração, o PBKDF2 do `core/auth-core.js` (secção acima) deixou
de ser o mecanismo principal de autenticação — o Firebase Auth trata
disso agora, no servidor da Google. `core/auth-core.js` continua a
existir para o que ainda não foi migrado.

### Duas falhas de segurança adicionais encontradas e corrigidas nesta fase

Ao mexer no login do SuperAdmin, encontrei a password fixa **duas
vezes**, escrita de duas formas diferentes:

1. Em `superadmin-login.html`, codificada em Base64 (`atob(_p1) + atob(_p2)`)
   — o Base64 não é encriptação, é trivialmente reversível por
   qualquer pessoa que abra as ferramentas de programador.
2. Em `recuperar-palavra-passe.html`, **em texto simples**, dentro de
   uma constante `FIXED_PASSWORD` — e o fluxo de "recuperar senha"
   para utilizadores normais gerava uma password nova e **enviava-a
   também em texto simples por email**.

As duas foram removidas. `superadmin-login.html` agora autentica via
Firebase Auth (com arranque automático: a primeira password submetida
com o email de SuperAdmin cria a conta permanentemente). 
`recuperar-palavra-passe.html` agora usa
`firebase.auth().sendPasswordResetEmail()` — o Firebase envia um link
seguro e temporário; nunca vemos nem enviamos nenhuma password.

## A causa raiz que estes ficheiros tentavam contornar

A função `ensureSuperAdminExists()` em
`pages/superadmin_sumbanepay/superadmin-login.html` gravava a lista de
utilizadores através de um pipeline que **encriptava o array inteiro
com CryptoJS AES** (e, pior, espalhava o array dentro de um objecto
antes disso, destruindo a sua estrutura). Isto corrompia
`sumbanepay_users` sempre que uma sessão de SuperAdmin era criada —
exactamente o cenário que `decrypt-fix.js` tentava reverter às
cegas. Foi corrigido na origem: essa função agora usa `SPStorage`
directamente, em JSON simples, tal como `cadastro.html`, `login.html`
e `utilizadores.html`.
