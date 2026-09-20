# SumbanePay

Frontend estático reorganizado conforme a especificação. `index.html` fica na raiz; todas as páginas da aplicação ficam em `pages/`; os ativos ficam em `img/`.

Abra `index.html` diretamente no navegador ou sirva a pasta com qualquer servidor HTTP local. As páginas existentes mantêm os seus componentes Bootstrap/Chart.js e foram corrigidos os caminhos internos. `suporte.html` e `404.html` foram criadas nesta versão.

## ⚠️ Antes de usar: configurar o Firestore

Registo, login e a lista de utilizadores no superadmin usam **Firebase
Authentication + Cloud Firestore** (`core/firebase-init.js`) — não
`localStorage` — precisamente para que uma conta criada num
dispositivo funcione em qualquer outro. Para isto funcionar:

1. As regras de segurança do Firestore têm de estar publicadas — ver
   **`FIRESTORE_RULES.md`** nesta pasta. Sem isto, o Firestore em modo
   produção recusa todas as leituras/escritas por omissão.
2. "Authentication → Sign-in method → Email/Password" tem de estar
   activado na consola Firebase.

Clientes, vendas, produtos, pagamentos e faturas continuam por agora
em `localStorage` (por dispositivo) — ver `legacy/README.md` para o
histórico completo desta migração e das falhas de segurança
encontradas e corrigidas pelo caminho.

## Responsividade mobile

Todas as 31 páginas incluem `responsive.css` e `mobile.js`. A camada responsiva adiciona menu lateral recolhível em telas pequenas, adaptação de tabelas com rolagem horizontal, formulários e ações empilhados, espaçamento fluido, tipografia ajustada, suporte a safe areas e redução de movimento. O comportamento desktop existente foi preservado.

## Dark mode

O tema escuro está disponível através dos controles de tema existentes e é persistido em `localStorage` com a chave `sumbanepay_theme`. O arquivo compartilhado `darkmode.css` uniformiza o tema em formulários, tabelas, modais, dropdowns, cartões, menu lateral e controles mobile. A preferência é restaurada automaticamente ao navegar entre páginas, e a interface também informa a cor de tema ao navegador mobile.
