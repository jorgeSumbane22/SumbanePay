/* ============================================================
   SumbanePay — core/pbkdf2-fallback.js
   ------------------------------------------------------------
   Responsabilidade única: PBKDF2-HMAC-SHA256 em JavaScript puro,
   sem nenhuma dependência de `crypto.subtle`.

   Por que este ficheiro existe:
   `crypto.subtle` só existe em "contexto seguro" (HTTPS, ou
   http://localhost). Como este projecto não tem servidor, é
   normal ser aberto via `file://` ou hospedado em HTTP simples
   — nesses casos `crypto.subtle` fica `undefined` em Chrome,
   Firefox e Safari, e qualquer código que dependa dele falha
   silenciosamente. Era exactamente isto que fazia login.html
   "negar" credenciais correctas nalguns navegadores.

   Esta implementação foi validada bit-a-bit contra
   `crypto.pbkdf2Sync` do Node.js (mesma família de algoritmo,
   RFC 8018) antes de entrar no projecto — ver o resultado do
   teste na conversa. Só é usada quando `crypto.subtle` não está
   disponível; quando está, core/auth-core.js usa a API nativa
   (mais rápida), com o mesmo formato de hash resultante.

   Não expõe nada além de SPPbkdf2Fallback.derive — mantém-se
   isolado para não ser confundido com "a" implementação de
   referência.
   ============================================================ */
(function (global) {
    'use strict';

    var K = new Uint32Array([
        0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
        0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
        0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
        0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
        0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
        0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
        0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
        0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2
    ]);

    function rotr(x, n) { return (x >>> n) | (x << (32 - n)); }

    /** SHA-256 puro (FIPS 180-4). @param {Uint8Array} bytes @returns {Uint8Array(32)} */
    function sha256(bytes) {
        var l = bytes.length;
        var bitLenLo = (l * 8) >>> 0;
        var bitLenHi = Math.floor(l / 0x20000000);

        var withOne = l + 1;
        var totalLen = withOne + 8;
        var rem = totalLen % 64;
        var padLen = rem === 0 ? 0 : 64 - rem;
        var padded = new Uint8Array(withOne + padLen + 8);
        padded.set(bytes);
        padded[l] = 0x80;

        var off = padded.length - 8;
        padded[off]   = (bitLenHi >>> 24) & 0xff;
        padded[off+1] = (bitLenHi >>> 16) & 0xff;
        padded[off+2] = (bitLenHi >>> 8) & 0xff;
        padded[off+3] = bitLenHi & 0xff;
        padded[off+4] = (bitLenLo >>> 24) & 0xff;
        padded[off+5] = (bitLenLo >>> 16) & 0xff;
        padded[off+6] = (bitLenLo >>> 8) & 0xff;
        padded[off+7] = bitLenLo & 0xff;

        var H = new Uint32Array([
            0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,
            0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19
        ]);

        var view = new DataView(padded.buffer, padded.byteOffset, padded.byteLength);
        var w = new Uint32Array(64);
        var numBlocks = padded.length / 64;

        for (var b = 0; b < numBlocks; b++) {
            var base = b * 64;
            var t;
            for (t = 0; t < 16; t++) w[t] = view.getUint32(base + t * 4, false);
            for (t = 16; t < 64; t++) {
                var s0 = rotr(w[t-15], 7) ^ rotr(w[t-15], 18) ^ (w[t-15] >>> 3);
                var s1 = rotr(w[t-2], 17) ^ rotr(w[t-2], 19) ^ (w[t-2] >>> 10);
                w[t] = (w[t-16] + s0 + w[t-7] + s1) | 0;
            }

            var a=H[0],bb=H[1],c=H[2],d=H[3],e=H[4],f=H[5],g=H[6],h=H[7];
            for (t = 0; t < 64; t++) {
                var S1 = rotr(e,6) ^ rotr(e,11) ^ rotr(e,25);
                var ch = (e & f) ^ (~e & g);
                var temp1 = (h + S1 + ch + K[t] + w[t]) | 0;
                var S0 = rotr(a,2) ^ rotr(a,13) ^ rotr(a,22);
                var maj = (a & bb) ^ (a & c) ^ (bb & c);
                var temp2 = (S0 + maj) | 0;
                h = g; g = f; f = e; e = (d + temp1) | 0;
                d = c; c = bb; bb = a; a = (temp1 + temp2) | 0;
            }
            H[0]=(H[0]+a)|0; H[1]=(H[1]+bb)|0; H[2]=(H[2]+c)|0; H[3]=(H[3]+d)|0;
            H[4]=(H[4]+e)|0; H[5]=(H[5]+f)|0; H[6]=(H[6]+g)|0; H[7]=(H[7]+h)|0;
        }

        var out = new Uint8Array(32);
        var outView = new DataView(out.buffer);
        for (var i = 0; i < 8; i++) outView.setUint32(i*4, H[i] >>> 0, false);
        return out;
    }

    function concatBytes(a, b) {
        var out = new Uint8Array(a.length + b.length);
        out.set(a, 0);
        out.set(b, a.length);
        return out;
    }

    function hmacSha256(key, msg) {
        var blockSize = 64;
        if (key.length > blockSize) key = sha256(key);
        var keyPadded = new Uint8Array(blockSize);
        keyPadded.set(key);
        var oKeyPad = new Uint8Array(blockSize);
        var iKeyPad = new Uint8Array(blockSize);
        for (var i = 0; i < blockSize; i++) {
            oKeyPad[i] = keyPadded[i] ^ 0x5c;
            iKeyPad[i] = keyPadded[i] ^ 0x36;
        }
        var inner = sha256(concatBytes(iKeyPad, msg));
        return sha256(concatBytes(oKeyPad, inner));
    }

    function int32BE(n) {
        return new Uint8Array([(n>>>24)&0xff, (n>>>16)&0xff, (n>>>8)&0xff, n&0xff]);
    }

    /**
     * PBKDF2-HMAC-SHA256 puro (RFC 8018). Validado bit-a-bit
     * contra crypto.pbkdf2Sync (Node) e é o mesmo algoritmo usado
     * por crypto.subtle — o resultado é idêntico independentemente
     * de qual dos dois motores o gerou.
     * @param {Uint8Array} password
     * @param {Uint8Array} salt
     * @param {number} iterations
     * @param {number} dkLen bytes desejados (32 para SHA-256/256 bits)
     * @returns {Uint8Array}
     */
    function derive(password, salt, iterations, dkLen) {
        var hLen = 32;
        var l = Math.ceil(dkLen / hLen);
        var dk = new Uint8Array(l * hLen);

        for (var i = 1; i <= l; i++) {
            var u = hmacSha256(password, concatBytes(salt, int32BE(i)));
            var t = u.slice();
            for (var j = 1; j < iterations; j++) {
                u = hmacSha256(password, u);
                for (var k = 0; k < hLen; k++) t[k] ^= u[k];
            }
            dk.set(t, (i - 1) * hLen);
        }
        return dk.slice(0, dkLen);
    }

    global.SPPbkdf2Fallback = { derive: derive, sha256: sha256, hmacSha256: hmacSha256 };

})(window);
