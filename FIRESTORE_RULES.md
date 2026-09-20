# Regras de segurança do Firestore — SumbanePay

Vai a **Firebase Console → Firestore Database → Regras** e substitui o
conteúdo por isto (depois clica em "Publicar"):

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    match /users/{userId} {

      // Um utilizador pode ler o SEU PRÓPRIO perfil; o superadmin
      // (identificado pelo email, sem precisar de custom claims)
      // pode ler o perfil de qualquer um.
      allow get: if request.auth != null &&
                    (request.auth.uid == userId ||
                     request.auth.token.email == 'jsumbane22@gmail.com');

      // Listar TODOS os utilizadores (usado por
      // superadmin_sumbanepay/utilizadores.html) — só o superadmin.
      allow list: if request.auth != null &&
                     request.auth.token.email == 'jsumbane22@gmail.com';

      // Um utilizador só pode criar o SEU PRÓPRIO documento de
      // perfil (logo a seguir a criar a conta no Auth).
      allow create: if request.auth != null && request.auth.uid == userId;

      // Um utilizador pode actualizar o seu próprio perfil; o
      // superadmin pode actualizar qualquer um (ex: activar/
      // desactivar uma conta).
      allow update: if request.auth != null &&
                       (request.auth.uid == userId ||
                        request.auth.token.email == 'jsumbane22@gmail.com');

      // Só o superadmin pode apagar contas.
      allow delete: if request.auth != null &&
                       request.auth.token.email == 'jsumbane22@gmail.com';
    }
  }
}
```

## Porque estas regras e não outras

- **`get` vs `list` são regras separadas de propósito.** `get` é ler UM documento (ex: o teu próprio perfil ao entrares); `list` é pedir a colecção inteira (ex: o superadmin a ver todos os utilizadores). Se fossem a mesma regra, ou davas a toda a gente acesso à lista completa, ou impedias até o superadmin de a ver.
- **O superadmin é identificado pelo email no token** (`request.auth.token.email`), não por um campo dentro do próprio documento — um campo `role: "superadmin"` dentro do documento poderia ser alterado por quem tivesse permissão de `update` sobre esse documento, criando um ciclo de auto-promoção. O email vem do token de autenticação assinado pelo Firebase, não é editável pelo cliente.
- **Sem estas regras, o Firestore em "modo produção" nega tudo por omissão** — é por isso que, sem isto, o registo/login vai parecer "não fazer nada" mesmo com o código correcto.

## Testar que ficou bem aplicado

Depois de publicares as regras, na aba **Regras** da consola Firebase
tens um separador "Simulador de regras" onde podes testar sem sair do
browser: escolhe `get`, caminho `/users/algumId`, e testa autenticado
vs não-autenticado para confirmar o comportamento esperado.
