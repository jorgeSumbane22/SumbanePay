/* ============================================================
   SumbanePay — Firestore Realtime Bridge
   Firestore é a fonte de verdade. localStorage fica apenas como
   cache de compatibilidade para as páginas HTML legadas.

   Dados do vendedor: user_data/{uid}
   Perfis/utilizadores: users/{uid}
   Dados do SuperAdmin: admin_data/global
   ============================================================ */
(function (global) {
    'use strict';
    if (!global.SPFirebase || !SPFirebase.db || !SPFirebase.auth) {
        console.error('[SPRealtime] Firebase não inicializado.');
        return;
    }

    var db = SPFirebase.db;
    var auth = SPFirebase.auth;
    var originalSetItem = Storage.prototype.setItem;
    var originalRemoveItem = Storage.prototype.removeItem;
    var syncingRemote = false;
    var activeContext = null;
    var unsubscribeData = null;
    var unsubscribeUsers = null;
    var unsubscribeProfile = null;
    var hashes = {};
    var writeTimer = null;
    var pendingWrites = false;
    var startedUid = null;

    function isSessionOrTheme(key) {
        return /^(sumbanepay_(theme|session|admin_session|login_attempts|account_lock|registered_email)|theme|sz_theme|darkMode)$/.test(key);
    }
    function isSellerKey(key) {
        return key.indexOf('sumbanepay_data_') === 0;
    }
    function isUsersCacheKey(key) {
        return /^(sumbanepay_users|sumbanepay_users_backup|sumbanepay_users_backup_time)$/.test(key);
    }
    function isAdminKey(key) {
        return key.indexOf('sumbanepay_') === 0 && !isSessionOrTheme(key) && !isSellerKey(key) && !isUsersCacheKey(key);
    }
    function parse(raw) {
        try { return JSON.parse(raw); } catch (e) { return raw; }
    }
    function stringify(value) {
        try { return JSON.stringify(value); } catch (e) { return null; }
    }
    function hash(value) { return stringify(value) || String(value); }
    function readKeys(predicate) {
        var data = {};
        for (var i = 0; i < localStorage.length; i++) {
            var key = localStorage.key(i);
            if (key && predicate(key)) data[key] = parse(localStorage.getItem(key));
        }
        return data;
    }
    function sellerData(uid) {
        var prefix = 'sumbanepay_data_' + uid + '_';
        var data = {};
        for (var i = 0; i < localStorage.length; i++) {
            var key = localStorage.key(i);
            if (key && key.indexOf(prefix) === 0) data[key.slice(prefix.length)] = parse(localStorage.getItem(key));
        }
        return data;
    }
    function adminData() { return readKeys(isAdminKey); }
    function setLocal(key, raw) {
        syncingRemote = true;
        try { originalSetItem.call(localStorage, key, raw); } finally { syncingRemote = false; }
    }
    function removeLocal(key) {
        syncingRemote = true;
        try { originalRemoveItem.call(localStorage, key); } finally { syncingRemote = false; }
    }
    function patchStorage() {
        if (global.__SPRealtimeStoragePatched) return;
        global.__SPRealtimeStoragePatched = true;
        Storage.prototype.setItem = function (key, value) {
            var result = originalSetItem.call(this, key, value);
            if (this === localStorage && !syncingRemote && (isSellerKey(key) || isAdminKey(key))) queueWrite();
            return result;
        };
        Storage.prototype.removeItem = function (key) {
            var result = originalRemoveItem.call(this, key);
            if (this === localStorage && !syncingRemote && (isSellerKey(key) || isAdminKey(key))) queueWrite();
            return result;
        };
    }
    function currentData() {
        return activeContext.type === 'seller' ? sellerData(activeContext.uid) : adminData();
    }
    function dataRef() {
        return activeContext.type === 'seller'
            ? db.collection('user_data').doc(activeContext.uid)
            : db.collection('admin_data').doc('global');
    }
    function saveData() {
        if (!activeContext || syncingRemote) return;
        pendingWrites = false;
        var data = currentData();
        dataRef().set({ data: data, updatedAt: new Date().toISOString() }, { merge: true })
            .then(function () { hashes['data:' + activeContext.type + ':' + activeContext.uid] = hash(data); })
            .catch(function (e) { console.warn('[SPRealtime] Erro ao guardar dados:', e.message); });
    }
    function queueWrite() {
        if (!activeContext || syncingRemote) return;
        pendingWrites = true;
        clearTimeout(writeTimer);
        writeTimer = setTimeout(saveData, 250);
    }
    function applyData(data) {
        var prefix = activeContext.type === 'seller' ? 'sumbanepay_data_' + activeContext.uid + '_' : '';
        var predicate = activeContext.type === 'seller' ? isSellerKey : isAdminKey;
        var local = readKeys(predicate);
        Object.keys(local).forEach(function (key) {
            var name = activeContext.type === 'seller' ? key.slice(prefix.length) : key;
            if (!Object.prototype.hasOwnProperty.call(data || {}, name)) removeLocal(key);
        });
        Object.keys(data || {}).forEach(function (name) {
            var key = prefix + name;
            var raw = stringify(data[name]);
            if (raw !== null) setLocal(key, raw);
        });
    }
    function reloadForRemoteChange(context) {
        global.dispatchEvent(new CustomEvent('sp:realtime-update', { detail: { context: context } }));
        setTimeout(function () { global.location.reload(); }, 80);
    }
    function listenData(context) {
        var ref = context.type === 'seller' ? db.collection('user_data').doc(context.uid) : db.collection('admin_data').doc('global');
        var key = 'data:' + context.type + ':' + context.uid;
        unsubscribeData = ref.onSnapshot(function (snap) {
            if (!snap.exists) { saveData(); return; }
            var remote = snap.data().data || {};
            var first = hashes[key] === undefined;
            var changed = hash(remote) !== hash(currentData());
            hashes[key] = hash(remote);
            if (changed) {
                applyData(remote);
                if (!first && !pendingWrites) reloadForRemoteChange(context.type);
            }
        }, function (e) { console.warn('[SPRealtime] Listener de dados indisponível:', e.message); });
    }
    function listenUsers(context) {
        if (context.type === 'admin') {
            unsubscribeUsers = db.collection('users').onSnapshot(function (snap) {
                var users = [];
                snap.forEach(function (doc) { users.push(Object.assign({ id: doc.id }, doc.data())); });
                users.sort(function (a, b) { return String(a.createdAt || '').localeCompare(String(b.createdAt || '')); });
                var nextHash = hash(users);
                var first = hashes.users === undefined;
                var old = parse(localStorage.getItem('sumbanepay_users') || '[]');
                hashes.users = nextHash;
                if (hash(old) !== nextHash) {
                    setLocal('sumbanepay_users', stringify(users));
                    if (!first && !pendingWrites) reloadForRemoteChange('users');
                }
            }, function (e) { console.warn('[SPRealtime] Listener de utilizadores indisponível:', e.message); });
        } else {
            unsubscribeProfile = db.collection('users').doc(context.uid).onSnapshot(function (snap) {
                if (!snap.exists) return;
                var profile = Object.assign({ id: context.uid }, snap.data());
                var users = [profile];
                var old = parse(localStorage.getItem('sumbanepay_users') || '[]');
                var first = hashes.profile === undefined;
                hashes.profile = hash(profile);
                if (hash(old) !== hash(users)) {
                    setLocal('sumbanepay_users', stringify(users));
                    if (!first) reloadForRemoteChange('profile');
                }
            }, function (e) { console.warn('[SPRealtime] Listener do perfil indisponível:', e.message); });
        }
    }
    function getContext(user) {
        if (!user || !user.uid) return null;
        var isAdmin = String(user.email || '').toLowerCase() === String(SPFirebase.SUPERADMIN_EMAIL || '').toLowerCase();
        return { type: isAdmin ? 'admin' : 'seller', uid: user.uid };
    }
    function start(user) {
        var context = getContext(user);
        if (!context || startedUid === context.uid) return;
        startedUid = context.uid;
        activeContext = context;
        patchStorage();
        listenData(context);
        listenUsers(context);
        console.log('[SPRealtime] Firestore activo como fonte de verdade:', context.type, context.uid);
    }
    patchStorage();
    auth.onAuthStateChanged(start);
    setTimeout(function () { if (auth.currentUser) start(auth.currentUser); }, 1500);
    global.SPRealtime = { syncNow: saveData, getContext: function () { return activeContext; } };
})(window);
