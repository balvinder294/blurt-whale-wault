// AES implementation using cryptojs

var keySize = 256;
var ivSize = 128;
var iterations = 100;

function constant_time_str_cmp(str1, str2) {
    if (str1.length !== str2.length) { return false; }
    var result = 0;
    for (var i = 0; i < str1.length; i++) {
        result |= (str1.charCodeAt(i) ^ str2.charCodeAt(i));
    }
    return result === 0
}

// We add an HMAC-SHA hash to check if decryption is successful later on
function encryptJson(json, pwd) {
    json.hash = Steem.CryptoJS.HmacSHA256(json.list, pwd).toString();
    var msg = encrypt(JSON.stringify(json), pwd);
    return msg;
}

// Decrypt and check the HMAC-SHA hash to confirm the decryption
function decryptToJson(msg, pwd) {
    try {
        var decrypted = decrypt(msg, pwd).toString(Steem.CryptoJS.enc.Utf8);
        decrypted = JSON.parse(decrypted);
        if (decrypted.hash != null && 
            constant_time_str_cmp(decrypted.hash, Steem.CryptoJS.HmacSHA256(decrypted.list, pwd).toString()))
            return decrypted;
        else {
            return null;
        }
    } catch (e) {
        return null;
    }
}

// AES encryption with master password
function encrypt(msg, pass) {
    var salt = Steem.CryptoJS.lib.WordArray.random(128 / 8);
    var key = Steem.CryptoJS.PBKDF2(pass, salt, {
        keySize: keySize / 32,
        iterations: iterations
    });

    var iv = Steem.CryptoJS.lib.WordArray.random(128 / 8);

    var encrypted = Steem.CryptoJS.AES.encrypt(msg, key, {
        iv: iv,
        padding: Steem.CryptoJS.pad.Pkcs7,
        mode: Steem.CryptoJS.mode.CBC

    });
    // salt, iv will be hex 32 in length
    // append them to the ciphertext for use  in decryption
    var transitmessage = salt.toString() + iv.toString() + encrypted.toString();
    return transitmessage;
}

// AES decryption with master password
function decrypt(transitmessage, pass) {
    var salt = Steem.CryptoJS.enc.Hex.parse(transitmessage.substr(0, 32));
    var iv = Steem.CryptoJS.enc.Hex.parse(transitmessage.substr(32, 32))
    var encrypted = transitmessage.substring(64);

    var key = Steem.CryptoJS.PBKDF2(pass, salt, {
        keySize: keySize / 32,
        iterations: iterations
    });

    var decrypted = Steem.CryptoJS.AES.decrypt(encrypted, key, {
        iv: iv,
        padding: Steem.CryptoJS.pad.Pkcs7,
        mode: Steem.CryptoJS.mode.CBC

    })
    return decrypted;
}
