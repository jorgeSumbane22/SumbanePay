# Regras de segurança do Firestore — SumbanePay

No Firebase Console → **Firestore Database → Regras**, substitui o conteúdo por isto e publica:

```firestore
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function signedIn() {
      return request.auth != null;
    }

    function isSuperAdmin() {
      return signedIn() && request.auth.token.email == 'jsumbane22@gmail.com';
    }

    match /users/{userId} {
      allow get: if signedIn() &&
                    (request.auth.uid == userId || isSuperAdmin());
      allow list: if isSuperAdmin();
      allow create: if signedIn() && request.auth.uid == userId;
      allow update: if signedIn() &&
                       (request.auth.uid == userId || isSuperAdmin());
      allow delete: if isSuperAdmin();
    }

    match /user_data/{userId} {
      allow read, write: if signedIn() && request.auth.uid == userId;
    }

    match /admin_data/{documentId} {
      allow read, write: if isSuperAdmin();
    }
  }
}
```

## O que mudou

- `users/{uid}` continua a ser a fonte de verdade para login, registro e perfil.
- `user_data/{uid}` sincroniza clientes, produtos, vendas, faturas, pagamentos, empresa, relatórios e definições do vendedor.
- `admin_data/global` sincroniza os dados de todas as páginas do painel SuperAdmin.
- O código mantém um cache local compatível para abrir a aplicação rapidamente, mas cada alteração é enviada ao Firestore e os listeners actualizam as outras sessões automaticamente.

> Importante: estas regras têm de ser publicadas no projecto Firebase `sumbane-pay`. Sem elas, o SDK pode estar correctamente instalado mas o Firestore continuará a rejeitar as leituras/escritas com `permission-denied`.
