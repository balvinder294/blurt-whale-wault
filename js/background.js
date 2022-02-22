let mk = null;
let id_win = null;
let key = null;
let confirmed = false;
let tab = null;
let request = null;
let request_id = null;
let accounts = null;

const LOCK_AFTER_SECONDS_IDLE = 15;
// Lock after the browser is idle for more than 10 minutes

let request_queue = [];

let bts_notices = {};

let alerts_chktm = 0;
let warn_domains = {};
let id_news = null;

let popup_callback = null;

let eos_contracts = {};

function getChainID(chain) {
    if (chain == "steem") return "stm"; else
    if (chain == "hive") return "hiv"; else
    if (chain == "blurt") return "blt"; else
    if (chain == "eos") return "eos"; else
    if (chain == "telos") return "tlo"; else
    if (chain == "worbli") return "wbi"; else
    if (chain == "uxnetwork") return "utx"; else
    if (chain == "wax") return "wax"; else
    if (chain == "cyberway") return "cyb"; else
    if (chain == "golos") return "gls"; else
    if (chain == "whaleshares") return "wls"; else
    if (chain == "smoke") return "smk"; else
    if (chain == "scorum") return "scr"; else
    if (chain == "vice") return "vit"; else
    if (chain == "bitshares") return "bts"; else
    if (chain == "graphene") return "gph"; else
    if (chain == "peerplays") return "ppy"; else
    if (chain == "uscoin") return "usc"; else
    if (chain == "other") return "oth"; else return chain.substring(0,3);
}

function txChainEvents(msg, selfObj) {
    if (msg.method && (msg.method == "notice")) {
        bts_notices[request_id] = msg;
    }
}

function waitFor(obj, prop, timeout) {
    if (!obj) return Promise.reject(new TypeError("waitFor expects an object"));
    var value = obj[prop];
    return new Promise(function(resolve, reject) {
         if (timeout)
             timeout = setTimeout(function() {
                 Object.defineProperty(obj, prop, {value: value, writable:true});
                 reject(new Error("waitFor timed out"));
             }, timeout);
         Object.defineProperty(obj, prop, {
             enumerable: true,
             configurable: true,
             get: function() { return value; },
             set: function(v) {
                 if (v != null) {
                     if (timeout) clearTimeout(timeout);
                     Object.defineProperty(obj, prop, {value: v, writable:true});
                     resolve(v);
                 } else {
                     value = v;
                 }
             }
         });
    });
    // could be shortened a bit using "native" .finally and .timeout Promise methods
}

//format: { "alerts": [ {"dt":"", title:"", url:""} ], "domains": { "domain": {"reason":"", "url": ""} } }
function update_alerts() {
  if (new Date().getTime() - alerts_chktm < 60000*60*3 /*3hrs*/ ) return;
  alerts_chktm = new Date().getTime();
  fetch('https://raw.githubusercontent.com/alexpmorris/crypto-playpen/master/whalevault/wv_alerts.json')
    .then(res => res.json())
    .then(data => { 
        //console.log(data);
        if (data != null && data.alerts && data.alerts.length > 0) {
            chrome.storage.local.get('last_alert_dt', function(items) {
                if (items.last_alert_dt != null && items.last_alert_dt != data.alerts[0].dt) {
                    createPopup(function(){
                        id_news = id_win;
                        chrome.runtime.sendMessage({command: "showNewsAlerts", alerts: data.alerts });
                    });
                }
                chrome.storage.local.set({ last_alert_dt: data.alerts[0].dt, events: data });
                warn_domains = data.domains;
            });
        } else {
            chrome.storage.local.get('events', function(items) {
                if (items.events) warn_domains = items.events.domains;
            });
        }
    })
    .catch(error => {
        console.log(error);
        chrome.storage.local.get('events', function(items) {
            if (items.events) warn_domains = items.events.domains;
        });
    })
}

// add or update an account with new private keys
function updateAccount(username, keys) {
    if (mk == null || !keys || !username || username == '') return;
    if (accounts == null) accounts = { list: [], hash: ''};

    let chain = username.substring(0,3).toLowerCase();
    let chain_prefix = Steem.config.networks[chain] ? Steem.config.networks[chain].address_prefix : chain.toUpperCase();
    let is_bts = chain.startsWith('bts') || chain == 'gph' || chain == 'ppy' || chain == 'usc';

    let account = accounts.list.find(e => e.name == username);
    if (account == null) {
        account = { name: username, keys: {} };
        accounts.list.push(account);
    }
    if (keys.active) {
        account.keys.active = keys.active;
        account.keys.activePubkey = chain_prefix+Steem.Auth.wifToPublic(keys.active).substring(3);
    }
    if (!is_bts && keys.posting) {
        account.keys.posting = keys.posting;
        account.keys.postingPubkey = chain_prefix+Steem.Auth.wifToPublic(keys.posting).substring(3);
    }
    if (keys.memo) {
        account.keys.memo = keys.memo;
        account.keys.memoPubkey = chain_prefix+Steem.Auth.wifToPublic(keys.memo).substring(3);
    }

    accounts.list.sort(function(a,b) { 
        if (a.name < b.name) return -1;
        if (a.name > b.name) return 1;
        return 0;
    });

    chrome.storage.local.set({
        accounts: encryptJson(accounts, mk)
    });
}

// Listen to the other parts of the extension
chrome.runtime.onMessage.addListener(function(msg, sender, sendResp) {
    // Send mk upon request from the extension popup.
    if (msg.command == "getMk") {
        chrome.runtime.sendMessage({
            command: "sendBackMk",
            mk: mk
        }, function(response) {});
    } else if (msg.command == "setRPC") {
    } else if (msg.command == "dialogReady") {
        if (popup_callback != null) {
            popup_callback();
            popup_callback = null;
        }
    } else if (msg.command == "popupNewsAlerts") {
        chrome.storage.local.get('events', function(items) {
            if (items.events && items.events.alerts && (request_queue.length == 0)) { 
                createPopup(function(){
                    id_news = id_win;
                    chrome.runtime.sendMessage({command: "showNewsAlerts", alerts: items.events.alerts });
                });
                chrome.runtime.sendMessage({command: "closeBasePopup" });
            }
        });
    } else if (msg.command == "popupBackupKeys") {
        createPopup(function(){
            id_news = id_win;
            chrome.runtime.sendMessage({command: "backupKeys" });
        });
        chrome.runtime.sendMessage({command: "closeBasePopup" });
    } else if (msg.command == "popupRestoreKeys") {
        createPopup(function(){
            id_news = id_win;
            chrome.runtime.sendMessage({command: "restoreKeys" });
        });
        chrome.runtime.sendMessage({command: "closeBasePopup" });
    } else if (msg.command == "sendMk") { //Receive mk from the popup (upon registration or unlocking)
            mk = msg.mk;
        } else if (msg.command == "sendAutolock") { //Receive autolock from the popup (upon registration or unlocking)
            autolock = JSON.parse(msg.autolock);
            if (autolock.type == "default")
                return;
            chrome.idle.setDetectionInterval(autolock.mn * 60);
            chrome.idle.onStateChanged.addListener(
                function(state) {
                    if ((autolock.type == "idle" && state === "idle") || state === "locked") {
                        mk = null;
                        request_queue = [];
                        chrome.browserAction.setIcon({ path: '/images/icons8-safe-50.png' });
                        chrome.browserAction.setTitle({ title: chrome.runtime.getManifest().name + ' :: locked'})
                    }
                }
            );
    } else if (msg.command == "sendRequest") { // Receive request (website -> content_script -> background)
        // create a window to let users confirm the transaction

        if (id_win != null || request_queue.length > 0) {
            var req_obj = { tab: sender.tab.id, msg };
            request_queue.push(req_obj);
            let message = {
                command: "queueStats",
                queue_len: request_queue.length
            };
            chrome.runtime.sendMessage(message);
            if (id_win != null && id_win > 0) chrome.windows.update(id_win, { state: 'minimized' });  // simulate on "alwaysOnTop" effect
            return;
        }

        tab = sender.tab.id;
        checkBeforeCreate(msg.request, tab, msg.domain);
        request = msg.request;
        request_id = msg.request_id;
        id_win = 0;

    } else if (msg.command == "unlockFromDialog") { // Receive unlock request from dialog
        chrome.storage.local.get(['accounts'], function(items) { // Check
            if (items.accounts == null || items.accounts == undefined) {
                sendErrors(msg.tab, "general_error", "no_wallet", "No wallet!", "", msg.data);
            } else {
                if (decryptToJson(items.accounts, msg.mk) != null) {
                    mk = msg.mk;
                    checkBeforeCreate(msg.data, msg.tab, msg.domain);
                } else {
                    chrome.runtime.sendMessage({
                        command: "wrongMk"
                    });
                }
            }
        });
    } else if (msg.command == "acceptTransaction") {
        if (msg.keep) {
            chrome.storage.local.get(['no_confirm'], function(items) {
                let keep = (items.no_confirm == null || items.no_confirm == undefined) ? {} : JSON.parse(items.no_confirm);
                if (keep[msg.data.username] == undefined) {
                    keep[msg.data.username] = {};
                }
                if (keep[msg.data.username][msg.domain] == undefined) {
                    keep[msg.data.username][msg.domain] = {};
                }

                var optypes = msg.data.optypes && msg.data.optypes.length > 0 ? msg.data.optypes : [""];
                for (var i = 0; i <= optypes.length-1; i++) {
                    var op = optypes[i] != "" ? ":"+optypes[i] : "";
                    var keyType = msg.data.method ? msg.data.method : msg.data.typeWif;
                    var txType = msg.data.type + ":" + keyType + ":" + msg.data.reason.replace(/ /g,'') + op;
                    keep[msg.data.username][msg.domain][txType] = true;
                }

                chrome.storage.local.set({
                    no_confirm: JSON.stringify(keep)
                });
            });
        }

        // substitute alternate one-off key for certain owner operations (experimental)
        if (msg.alt_key != "") {
            if (Steem.Auth.isWif(msg.alt_key)) key = msg.alt_key; else {
                chrome.tabs.sendMessage(tab, {
                    command: "answerRequest",
                    msg: {
                        success: false,
                        error: "user_cancel",
                        result: null,
                        data: msg.data,
                        message: "Invalid key provided",
                        request_id: request_id
                    }
                });
                // if canceled, clear way for next tx in queue...
                id_win = null;
                key = null;
                accounts = null;
                return;
            }
        }

        confirmed = true;
        performTransaction(msg.data, msg.tab);
        // upon receiving the confirmation from user, perform the transaction and notify content_script. Content script will then notify the website.
    }
});

async function performTransaction(data, tab) {
    try {
        var log_entry = null;
        switch (data.type) {
            case "pubkeys":
                try {

                    if (data.addKeys) updateAccount(data.username, data.addKeys);

                    var err_code = 'decode_error';
                    var err_str = "Could not retrieve pubKeys";

                    var user_arr = data.username.replace(/,/g, ' ').trim().split(' ');
                    var pubkeys = {};
                    for (var i = 0; i <= user_arr.length-1; i++) {
                        var username = user_arr[i];
                        if (username != "") {
                            let ac = accounts.list.find(function(e) {
                                return e.name == username
                            });
                            pubkeys[username] = {};
                            if (ac != null) {
                                for (var pk in ac.keys) {
                                    if (pk.endsWith('Pubkey')) {
                                        pubkeys[username][pk] = ac.keys[pk];
                                        var prefix = ac.keys[pk].substring(0,3);
                                        pubkeys[username][pk+"_K1"] = Steem.Utils.publicKeyToEosString(Steem.PublicKey.fromString(ac.keys[pk], prefix));
                                    }
                                }
                            }
                        }
                    }

                    let message = {
                        command: "answerRequest",
                        msg: {
                            success: true,
                            error: null,
                            result: pubkeys,
                            data: data,
                            message: "Pubkeys retrieved successfully",
                            request_id: request_id
                        }
                    };
                    chrome.tabs.sendMessage(tab, message);
                    chrome.runtime.sendMessage(message);
                    key = null;
                    accounts = null;
                } catch (err) {
                    let message = {
                        command: "answerRequest",
                        msg: {
                            success: false,
                            error: err_code,
                            result: null,
                            data: data,
                            message: err_str,
                            request_id: request_id
                        }
                    };
                    chrome.tabs.sendMessage(tab, message);
                    chrome.runtime.sendMessage(message);
                    key = null;
                    accounts = null;
                }
                break;
                case "encryptMemo":
                try {

                    var usePrefix = data.pubKey.substring(0,3).toUpperCase();
                    var prv_chain = Steem.config.address_prefix;
                    Steem.config.address_prefix = usePrefix;

                    var encrypted = "";
                    if (['stm','steem'].includes(data.memoType.toLowerCase())) {
                        var msg = data.message;
                        if (!msg.startsWith('#')) msg = '#'+msg;
                        encrypted = Steem.stmMemo.encode(key, data.pubKey, msg);
                    } else {
                        encrypted = Steem.btsMemo.encryptBTSmemo(key, data.pubKey, data.message, usePrefix);
                    }

                    Steem.config.address_prefix = prv_chain;

                    log_entry = { data };

                    let message = {
                        command: "answerRequest",
                        msg: {
                            success: true,
                            error: null,
                            result: encrypted,
                            data: data,
                            message: data.memoType+"Memo encoded successfully",
                            request_id: request_id
                        }
                    };
                    chrome.tabs.sendMessage(tab, message);
                    chrome.runtime.sendMessage(message);
                    key = null;
                    accounts = null;
                } catch (err) {
                    var err_str = err.message != null ? "Failed to encode memo ["+err.message.substring(0,100)+"]" : "Failed to encode memo";
                    let message = {
                        command: "answerRequest",
                        msg: {
                            success: false,
                            error: 'encode_error',
                            result: null,
                            data: data,
                            message: err_str,
                            request_id: request_id
                        }
                    };
                    chrome.tabs.sendMessage(tab, message);
                    chrome.runtime.sendMessage(message);
                    key = null;
                    accounts = null;
                }
                break;
                case "decryptMemo":
                try {

                    var memoType = 'stm';
                    var decrypted = "";
                    var msg = data.message;
                    if ((typeof msg == "string") && msg.startsWith('#')) {
                        // handle special case for steem where memos may be encrypted with posting or memo key
                        if (data.method == 'Posting') {
                            let memo_pubkeys = Steem.stmMemo.decode('', msg);
                            let account = accounts.list.find(e => e.name == data.username);
                            if (account != null && account.keys && account.keys.memoPubkey) {
                                if (account.keys.memoPubkey.substring(3) == memo_pubkeys.from.substring(3) || 
                                    account.keys.memoPubkey.substring(3) == memo_pubkeys.to.substring(3)) {
                                        data.method = 'Memo';
                                        key = account.keys.memo;
                                    }
                            }
                        }
                        decrypted = Steem.stmMemo.decode(key, msg);
                    } else {
                        memoType = 'bts';
                        if (typeof msg != "object") msg = JSON.parse(msg);
                        var usePrefix = msg.from.toString().substring(0,3);
                        decrypted = Steem.btsMemo.decryptBTSmemo(key, msg, usePrefix);
                    }

                    log_entry = { data };

                    let message = {
                        command: "answerRequest",
                        msg: {
                            success: true,
                            error: null,
                            result: decrypted,
                            data: data,
                            message: memoType+"Memo decoded successfully",
                            request_id: request_id
                        }
                    };
                    chrome.tabs.sendMessage(tab, message);
                    chrome.runtime.sendMessage(message);
                    key = null;
                    accounts = null;
                } catch (err) {
                    var err_str = err.message != null ? "Failed to decode memo ["+err.message.substring(0,100)+"]" : "Failed to decode memo";
                    let message = {
                        command: "answerRequest",
                        msg: {
                            success: false,
                            error: 'decode_error',
                            result: null,
                            data: data,
                            message: err_str,
                            request_id: request_id
                        }
                    };
                    chrome.tabs.sendMessage(tab, message);
                    chrome.runtime.sendMessage(message);
                    key = null;
                    accounts = null;
                }
                break;
            case "signBuffer":
                try {
                    var result_msg = "Message signed successfully";
                    let signed = null;
                    var trunc_buf = false;
                    if (typeof data.message == 'object') {
                        // if object, sigType is ignored, can be blank or "tx", or used for other reference
                        var tx_obj = data.message;

                        if (tx_obj.actions != null) {  //eos-style signature via eosjs
                            
                            var rpc_url = "";
                            var chain = data.username.substring(0,3);
                            var chainId = null;
                            if (tx_obj.network != null) {
                                var network = tx_obj.network;
                                if (network.chain != null) chain = network.chain.toLowerCase(); else
                                  if (network.blockchain != null) blockchain = getChainID(network.blockchain.toLowerCase());
                                if (network.chainId != null) chainId = network.chainId;
                                if (network.url) rpc_url = network.url; else
                                    if (network.protocol && network.host && network.port) {
                                        rpc_url = `${network.protocol}://${network.host}:${network.port}`;
                                    } else 
                                    if (network.protocol && network.host) {
                                        rpc_url = `${network.protocol}://${network.host}`;
                                    }
                            }
                            if (chainId == null) {
                                if (Steem.config.networks[chain] != null) chainId = Steem.config.networks[chain].chain_id;
                            }
                            if (rpc_url == '') {
                                rpc_url = 'https://eos.greymass.com';  //default to eos mainnet
                                if (chain == 'utx' || chain == 'uxnetwork') rpc_url = 'https://api.uxnetwork.io'; else
                                  if (chain == 'tlo' || chain == 'telos') rpc_url = 'https://telosapi.eosmetal.io'; else
                                   if (chain == 'wax') rpc_url = 'https://chain.wax.io'; else
                                    if (chain == 'cyb' || chain == 'cyberway') rpc_url = 'https://node-cyberway.golos.io';
                            }

                            if (rpc_url != null && chain != "") {
                                var rpc = new eosjs_jsonrpc.JsonRpc(rpc_url);
                                var jsig = new eosjs_jssig.JsSignatureProvider([key]);
                                var api = new eosjs_api.Api({rpc, signatureProvider: jsig, chainId, textDecoder: new TextDecoder(), textEncoder: new TextEncoder() });

                                if (eos_contracts[chainId]) {
                                    // restore cached contract data for same eos chain
                                    api.cachedAbis = eos_contracts[chainId].cachedAbis;
                                    api.contracts = eos_contracts[chainId].contracts;
                                }

                                if (tx_obj.expiration && tx_obj.ref_block_num && tx_obj.ref_block_prefix) {
                                    // in this case, return eos signature only (for use with transitAPI, JsSignatureProvider, etc)
                                    var trx = await api.transact(tx_obj, {
                                        broadcast: false
                                    });
                                    signed = trx.signatures[0];
                                } else {
                                    // otherwise, sign and transmit eos-style transaction
                                    var trx = await api.transact({
                                        actions: tx_obj.actions
                                    }, {
                                        blocksBehind: tx_obj.blocksBehind ? tx_obj.blocksBehind : 3,
                                        expireSeconds: tx_obj.expireSeconds ? tx_obj.expireSeconds : 30,
                                        broadcast: true
                                    });
                                    signed = trx;
                                }
                                console.log(trx);

                                if (chainId == api.chainId && api.contracts.size > 0) {
                                    // cache contract data for same eos chain
                                    if (eos_contracts[chainId] == null) eos_contracts[chainId] = {};
                                    eos_contracts[chainId].cachedAbis = api.cachedAbis;
                                    eos_contracts[chainId].contracts = api.contracts;
                                }

                            } else throw { message: "setUrlAndChain" };
                            result_msg = "Transaction completed successfully";
                        } else {
                            var chain = tx_obj.chain != null ? tx_obj.chain.toLowerCase() : data.username.substring(0,3);
                            var chainId = tx_obj.chainId != null ? tx_obj.chainId : "";
                            if (chainId == "" && Steem.config.networks[chain] != null) chainId = Steem.config.networks[chain].chain_id;
                            if (tx_obj.url != null && tx_obj.url != "" && 
                                tx_obj.ref_block_num == null && tx_obj.ref_block_prefix == null &&
                                tx_obj.jsonrpc == null && tx_obj.method == null) {

                                    // experimental, broadcasts tx for steem/bts chains if tx_obj.url is included
                                    // as with eos chains, successful result will include tx_id and block_num

                                    var is_bts = chain.startsWith('bts') || chain == 'gph' || chain == 'ppy' || chain == 'usc';
                                    var apid = tx_obj.apid != null ? tx_obj.apid : "";
                                    var temp_remote = new Steem.Remote({
                                        servers: [{ url: tx_obj.url, chain, apid }],
                                        notifyCallback: txChainEvents
                                    });
                                    Steem.setChain(temp_remote, chain);
                                    let p_timeout = new Promise((resolve, reject) => {
                                        let id = setTimeout(() => {
                                          clearTimeout(id);
                                          reject({message:'Connection timed out'});
                                        }, 15000);
                                      });
                                    let p_connect = new Promise((response) => {
                                        temp_remote.connect(function() { response(null); });
                                    });
                                    await Promise.race([p_connect, p_timeout]);
                                    var tx = new Steem.Transaction({ chain, chainId, remote: temp_remote });
                                    for (var i = 0; i <= data.message.operations.length-1; i++) {
                                        var op_type = data.message.operations[i][0];
                                        tx.addOperation(op_type, data.message.operations[i][1]);
                                    }
                                    tx.addSigningKey(key);
                                    var trx = await new Promise((response) => {
                                        if (is_bts) {
                                            tx.bts_broadcast_with_callback(function(err, result) { 
                                                if (err) response({err}); else response({result});
                                            });
                                        } else {
                                            tx.broadcast(function(err, result) { 
                                                if (err) response({err}); else response({result});
                                            });
                                        }
                                    }).catch(err => { response({err}); });
                                    console.log(trx);
                                    if (trx.err) {
                                        temp_remote.servers[0].disconnect();
                                        throw { json: trx.err };
                                    }
                                    if (is_bts) {
                                        await waitFor(bts_notices, request_id, 15000);
                                        const response = bts_notices[request_id];
                                        delete bts_notices[request_id];
                                        console.log(response);
                                        temp_remote.servers[0].disconnect();
                                        if (response == null) throw { message: "tx_no_response_verify_status" };
                                        if (response.error) throw { json: response.error };
                                        signed = response;
                                    } else signed = trx.result;
                                    result_msg = "Transaction completed successfully";
                            } else {
                                if (tx_obj.jsonrpc != null && tx_obj.method != null && tx_obj.params != null) {
                                    //rpc-auth: signedCall
                                    var account = data.username.split(':')[1];
                                    var constant_K_base = tx_obj.K != null ? tx_obj.K : 'steem_jsonrpc_auth';
                                    var auth_obj = Object.assign({}, tx_obj);
                                    delete auth_obj.K;
                                    delete auth_obj.url;
                                    signed = Steem.Utils.jsonRpcAuthRequest(auth_obj, account, key, data.sigType, constant_K_base);
                                    if (tx_obj.url != null && tx_obj.url.startsWith('https://')) {
                                        var trx = await new Promise((response) => {
                                            fetch(tx_obj.url, { method: 'POST', body: JSON.stringify(signed) })
                                            .then(res => res.json())
                                            .then(data => { 
                                                if (data.error) response({ err: data.error }); else
                                                    response({ result: data.result });
                                            })
                                            .catch(err => {
                                                response({ err });
                                            });
                                        });
                                        console.log(trx);
                                        if (trx.err) throw { json: trx.err };
                                        signed = trx;
                                    } else console.log(signed);
                                } else {
                                    tx_obj.expiration = Math.ceil(Date.now()/1000 + Steem.config.expire_in_secs);
                                    Steem.setChain(null, chain);
                                    var tx = new Steem.Transaction({ ref_block_num: tx_obj.ref_block_num,
                                                                    ref_block_prefix: tx_obj.ref_block_prefix,
                                                                    expiration: tx_obj.expiration,
                                                                    chain,
                                                                    chainId
                                                                });
                                    for (var i = 0; i <= data.message.operations.length-1; i++) {
                                        var op_type = data.message.operations[i][0];
                                        tx.addOperation(op_type, data.message.operations[i][1]);
                                    }
                                    tx.signWithPrikey(key);
                                    signed = tx.signatures[0].toString('hex');
                                    console.log(tx);
                                }
                            }
                        }
                    } else {
                        let isBuf = data.message.startsWith('{"type":"Buffer","data":[');
                        if (data.sigType == 'raw' || isBuf) {
                            let useBuf = isBuf ? JSON.parse(data.message) : data.message;
                            const sign_msg = Steem.newBuffer(useBuf, 'binary');
                            signed = Steem.Signature.signBuffer(sign_msg, key).toHex();
                            trunc_buf = true;
                        } else
                        if (data.sigType == 'hex') {
                            signed = Steem.Signature.signBuffer(data.message, key).toHex();
                        } else { // eos / SIG_K1 format (default)
                            signed = Steem.Utils.signEosMessage(data.message, key);
                        }
                    }

                    let message = {
                        command: "answerRequest",
                        msg: {
                            success: true,
                            error: null,
                            result: signed,
                            data: data,
                            message: result_msg,
                            request_id: request_id
                        }
                    };
                    chrome.tabs.sendMessage(tab, message);
                    chrome.runtime.sendMessage(message);
                    key = null;
                    accounts = null;

                    if (trunc_buf) {
                        const msg_len = data.message.length;
                        data.message = '('+msg_len+' bytes) ' + data.message.replace(/\n.|\r/g, " ");
                        if (msg_len > 1024) data.message = data.message.substring(0,1024)+' ...';
                    }
                    if (signed == null) signed = 'null'; else
                        if (typeof signed == 'object') signed = JSON.stringify(signed, null, 2);
                    log_entry = { data, result: '('+result_msg+')\n'+signed };

                } catch (err) {
                    if (typeof temp_remote != 'undefined' && temp_remote.servers.length > 0) temp_remote.servers[0]._shouldConnect = false;
                    console.log(err);
                    var err_str = err.json != null ? err.json : "Could not sign ["+err.message.substring(0,100)+"]";
                    var err_code = err.json != null ? "tx_error" : "sign_error";
                    if (err.json != null) {
                        log_entry = { data, result: '('+err_code+')\n'+JSON.stringify(err_str, null, 2), error: true };
                    }
                    let message = {
                        command: "answerRequest",
                        msg: {
                            success: false,
                            error: err_code,
                            result: null,
                            data: data,
                            message: err_str,
                            request_id: request_id
                        }
                    };
                    chrome.tabs.sendMessage(tab, message);
                    chrome.runtime.sendMessage(message);
                    key = null;
                    accounts = null;
                }
                break;
        }
    } catch (e) {
        console.log(e);
        sendErrors(tab, "transaction_error", "An unknown error has occurred", "An unknown error has occurred.", data);
    }

    if (log_entry != null) {
        chrome.storage.local.get(['tx_log'], function(items) {
            log_entry.dt = new Date().toLocaleString();
            var tx_log = items.tx_log;
            if (tx_log == null) tx_log = {};
            var name = log_entry.data.username;

            if (tx_log[name] == null) tx_log[name] = [];
            tx_log[name].unshift(log_entry);
            while (tx_log[name].length > 25) 
                tx_log[name].pop();

            var name = 'all';
            if (tx_log[name] == null) tx_log[name] = [];
            tx_log[name].unshift(log_entry);
            while (tx_log[name].length > 25) 
                tx_log[name].pop();    

            chrome.storage.local.set({
                tx_log
            });
          });
    }

}

function createPopup(callback) {
    let width = 350;
    confirmed = false;
    //Ensuring only one window is opened by the extension at a time
    if (id_win != null && id_win > 0) {
        chrome.windows.remove(id_win);
        id_win = null;
    }
    //Create new window on the top right of the screen
    chrome.windows.getCurrent(function(w) {
        chrome.windows.create({
            url: chrome.runtime.getURL("html/dialog.html"),
            type: "popup",
            height: 566,
            width: width,
            left: w.width - width + w.left,
            top: w.top
        }, function(win) {
            id_win = win.id;

            // message callback approach seems to solve timing issues with window creation
            popup_callback = function() {
                // Window create fails to take into account window size so it's updated afterwhile.
                chrome.windows.update(win.id, {
                    height: 566,
                    width: width,
                    top: w.top,
                    left: w.width - width + w.left
                });
                callback();
            };
        });
    });

}

chrome.windows.onRemoved.addListener(function(id) {
    if (id == id_news && key == null && accounts == null) {
        id_news = id_win = null;
        return;
    }
    if (id == id_win && !confirmed) {
        chrome.tabs.sendMessage(tab, {
            command: "answerRequest",
            msg: {
                success: false,
                error: "user_cancel",
                result: null,
                data: request,
                message: "Request was canceled by the user",
                request_id: request_id
            }
        });
        // if canceled, clear way for next tx in queue...
        id_win = null;
        key = null;
        accounts = null;
        onTimer();
    }
});

function checkBeforeCreate(request, tab, domain) {
    if (mk == null) { // Check if locked
        chrome.storage.local.get(['accounts'], function(items) { 
            if (items.accounts != null) {
                function callback() {
                    chrome.runtime.sendMessage({
                        command: "sendDialogError",
                        msg: {
                            success: false,
                            error: "locked",
                            result: null,
                            data: request,
                            message: "The wallet is locked!",
                            display_msg: '<b><font color=yellow>'+domain+'</font></b> is trying to send a request to the WhaleVault browser extension. Please enter your password below to unlock the wallet and continue.'
                        },
                        tab: tab,
                        domain: domain
                    });
                }
                createPopup(callback);
            } else {
                // user has not yet set a master password for wallet from registration form!
                chrome.windows.getCurrent(function(w) { 
                    width = 350; 
                    chrome.windows.create({
                        url: chrome.runtime.getURL("html/popup.html"),
                        type: "popup",
                        height: 596,
                        width: width,
                        left: w.width - width + w.left,
                        top: w.top
                    }); 
                });
                chrome.tabs.sendMessage(tab, {
                    command: "answerRequest",
                    msg: {
                        success: false,
                        error: "user_cancel",
                        result: null,
                        data: request,
                        message: "Set master password for WhaleVault!",
                        request_id: request_id
                    }
                });
                id_win = null;
            }
        });
    } else {
        chrome.storage.local.get(['accounts', 'no_confirm'], function(items) { // Check user
            if (!request.addKeys && (items.accounts == null || items.accounts == undefined)) {
                createPopup(function() {
                    sendErrors(tab, "general_error", "no_wallet", "No wallet!", "", request);
                });
            } else {
                // Check that user and wanted keys are in the wallet
                accounts = (items.accounts == undefined || items.accounts == {
                    list: []
                }) ? null : decryptToJson(items.accounts, mk);
                let account = null;
                if (request.type == "transfer") {
                    // removed
                } else {
                    if (request.type == 'pubkeys' && request.addKeys && (Object.keys(request.addKeys).length > 0)) {
                        var add_keys = [];
                        try {
                            let chain_id = request.username.split(':')[0].toUpperCase();
                            try { if (request.addKeys.active && Steem.Auth.wifToPublic(request.addKeys.active)) 
                                add_keys.push('activeKey: <font size=2 color=yellow>'+chain_id+Steem.Auth.wifToPublic(request.addKeys.active).substring(3,25)+' ...</font>'); 
                            } catch (e) { throw "Invalid activeKey"; }
                            try { if (request.addKeys.posting && Steem.Auth.wifToPublic(request.addKeys.posting)) 
                                add_keys.push('postingKey: <font size=2 color=yellow>'+chain_id+Steem.Auth.wifToPublic(request.addKeys.posting).substring(3,25)+' ...</font>');
                            } catch (e) { throw "Invalid postingKey"; }
                            try { if (request.addKeys.memo && Steem.Auth.wifToPublic(request.addKeys.memo)) 
                                add_keys.push('memoKey: <font size=2 color=yellow>'+chain_id+Steem.Auth.wifToPublic(request.addKeys.memo).substring(3,25)+' ...</font>');
                            } catch (e) { throw "Invalid memoKey"; }
                            if (Object.keys(add_keys).length == 0) throw "No keys to add";
                            let req = request;
                            function callback() {
                                if (chrome.runtime.lastError) console.warn(chrome.runtime.lastError.message);
                                chrome.runtime.sendMessage({
                                    command: "sendDialogConfirm",
                                    data: req,
                                    domain: domain,
                                    tab: tab,
                                    add_keys
                                });
                            }
                        } catch (e) {
                            function callback() {
                                sendErrors(tab, "user_cancel", "Request was canceled by the user", "<b><font color=yellow>"+request.domain+"</font></b> is requesting permission to add or update keys to account <font color=yellow><b>"+request.username+"</b></font> in WhaleVault, returning the following error:<br/><br/><b>"+e+"</b>", request);
                            }
                        }
                        createPopup(callback);
                    } else
                    if (request.type == 'pubkeys' && request.username.endsWith(':')) {
                        // app requesting user to choose identity
                        let chain_accounts = accounts.list.filter(e => e.name.startsWith(request.username));
                        if (chain_accounts.length == 0) {
                            function callback() {
                                let chain = request.username.substring(0,3);  // cleaned in web_interface.js
                                sendErrors(tab, "user_cancel", "Request was canceled by the user", "<b><font color=yellow>"+request.domain+"</font></b> is requesting you select an account from chain <b><font color=yellow>" + chain + "</font></b>.  However, no <b><font color=yellow>" + chain + "</font></b> chain accounts currently exist in WhaleVault.", request);
                            }
                        } else {
                            // Send the request to confirmation window
                            let chain_account_names = [];
                            chain_accounts.forEach(function(account) { chain_account_names.push(account.name); });
                            let req = request;
                            function callback() {
                                if (chrome.runtime.lastError) console.warn(chrome.runtime.lastError.message);
                                chrome.runtime.sendMessage({
                                    command: "sendDialogConfirm",
                                    data: req,
                                    domain: domain,
                                    tab: tab,
                                    chain_account_names
                                });
                            }
                        }
                        createPopup(callback);
                    } else
                    if (request.type != 'pubkeys' && !accounts.list.find(e => e.name == request.username)) {
                        function callback() {
                            let user = request.username;  // cleaned in web_interface.js
                            sendErrors(tab, "user_cancel", "Request was canceled by the user", "<b><font color=yellow>"+request.domain+"</font></b> is trying to send a request to the WhaleVault browser extension for account <b><font color=yellow>" + user + "</font></b> which has not been added to WhaleVault.", request);
                        }
                        createPopup(callback);
                    } else {
                        account = accounts.list.find(function(e) {
                            return e.name == request.username;
                        });
                        let typeWif = getRequiredWifType(request);
                        let req = request;

                        if (req.type == "custom")
                            req.method = typeWif;

                        if (req.type == "broadcast") {
                            req.typeWif = typeWif;
                        }

                        if (req.type == "signBuffer") {

                            var st_ops = null;
                            if (req.username.startsWith('bts:') || req.username.startsWith('gph:') || req.username.startsWith('ppy:') || req.username.startsWith('usc:')) st_ops = Steem.btsOperations.operation.st_operations; else
                             if (req.username.startsWith('wls:')) st_ops = Steem.wlsOperations.operation.st_operations; else
                              if (req.username.startsWith('smk:')) st_ops = Steem.smkOperations.operation.st_operations; else
                               if (req.username.startsWith('blt:')) st_ops = Steem.bltOperations.operation.st_operations; else
                                st_ops = Steem.stmOperations.operation.st_operations;

                            var auths = [];
                            var optypes = [];
                            var op = req.message;
                            if ((typeof op == 'object') && (op.operations || op.actions || op.method)) {
                                try {
                                    if (op.method) {
                                        optypes.push(op.method);
                                    } else {
                                        var ops = op.operations ? op.operations : op.actions;
                                        for (var j = 0; j <= ops.length-1; j++) {
                                            if (op.operations) {
                                                var op_type = typeof ops[j][0] == 'number' ? st_ops[ops[j][0]].operation_name : ops[j][0];
                                                ops[j][0] = op_type;  // assign op name versus id
                                            } else {
                                                var op_type = ops[j].name;
                                                if (ops[j].authorization && !auths.includes(ops[j].authorization[0].permission)) auths.push(ops[j].authorization[0].permission);
                                            }
                                            if (!optypes.includes(op_type)) optypes.push(op_type);
                                        }
                                    }
                                } catch(e) {}
                                optypes.sort();
                                auths.sort();
                            }
                            req.optypes = optypes;
                            req.auths = auths;

                        }

                        if (typeWif === 'owner') account.keys[typeWif] = ''; // popup owner-key request
                        if ((req.type != 'pubkeys') && (account.keys[typeWif] == undefined)) {
                            createPopup(function() {
                                let user = request.username;  // cleaned in web_interface.js
                                let keyName = typeWif == 'active' ? '<font color=red>ACTIVE KEY</font>' : typeWif.toUpperCase()+' KEY';
                                sendErrors(tab, "user_cancel", "Request was canceled by the user", "<b><font color=yellow>"+request.domain+"</font></b> is trying to send a request to the WhaleVault browser extension for account <b>" + user + "</b> using the private <b>" + keyName + "</b>, which has not been added to WhaleVault!", request);
                            });
                        } else {
                            key = (req.type == 'pubkeys') ? null : account.keys[typeWif];
                            req.warn_domain = warn_domains[domain];
                            if ((key != null) && (req.warn_domain || !hasNoConfirm(items.no_confirm, req, domain))) {
                                // Send the request to confirmation window
                                function callback() {
                                    if (chrome.runtime.lastError) console.warn(chrome.runtime.lastError.message);
                                    chrome.runtime.sendMessage({
                                        command: "sendDialogConfirm",
                                        data: req,
                                        domain: domain,
                                        tab: tab
                                    });
                                }
                                createPopup(callback);

                                // Update window queue stats
                                setTimeout(function () {
                                    let message = {
                                        command: "queueStats",
                                        queue_len: request_queue.length
                                    };
                                    chrome.runtime.sendMessage(message);
                                }, 500);
                            
                            } else {
                                
                                if (id_win != null && id_win > 0) { 
                                    chrome.windows.remove(id_win); 
                                } 
                                id_win = null;

                                performTransaction(req, tab);
                            }
                        }
                    }
                }
            }
        });
    }
}

function hasNoConfirm(arr, data, domain) {
    try {
        var optypes = data.optypes && data.optypes.length > 0 ? data.optypes : [""];

        var no_confs = JSON.parse(arr);

        var all_confs = 0;
        for (var i = 0; i <= optypes.length-1; i++) {
            var op = optypes[i] != "" ? ":"+optypes[i] : "";
            var keyType = data.method ? data.method : data.typeWif;
            var txType = data.type + ":" + keyType + ":" + data.reason.replace(/ /g,'') + op;
            try { if (no_confs[data.username][domain][txType]) all_confs++; } catch (e) {}
        }
        return (all_confs == optypes.length);

    } catch (e) {
        return false;
    }
}
// Send errors back to the content_script, it will forward it to website
function sendErrors(tab, error, message, display_msg, request) {
    chrome.runtime.sendMessage({
        command: "sendDialogError",
        msg: {
            success: false,
            error: error,
            result: null,
            data: request,
            message: message,
            display_msg: display_msg,
            request_id: request_id
        },
        tab: tab
    });
    key = null;
    accounts = null;
}

// Get the key needed for each type of transaction
function getRequiredWifType(request) {
    switch (request.type) {
        case "encryptMemo":
        case "decryptMemo":
        case "decode":
        case "signBuffer":
            return request.method.toLowerCase();
            break;
    }
}

function onTimer() {
  if (id_win != null && id_win > 0) {
      try {
        chrome.windows.get(id_win, function(win) { 
          if (chrome.runtime.lastError || (typeof win == 'undefined')) {
            if (id_win != null && id_win > 0) {
                id_win = null;
                onTimer();
            }
          } else {
            if (win && (win.state != 'normal'))
                chrome.windows.update(id_win, { state: 'normal' });
          }
        });
      } catch (e) { id_win = null; }
  }
  if ((mk == null) || (id_win != null) || (key != null) || (accounts != null)) return;
  if (request_queue.length == 0) {
      if (alerts_chktm == 0) update_alerts(); else {
        chrome.idle.queryState(60*5 /*5min*/, function(state) { 
            if (state == 'active') update_alerts();
        });
      }
      return;
  }

  try {
    var req_obj = request_queue.shift();
    checkBeforeCreate(req_obj.msg.request, req_obj.tab, req_obj.msg.domain);
    request = req_obj.msg.request;
    request_id = req_obj.msg.request_id;
    id_win = 0;
  } catch (e) { console.log(e); }
}

setInterval(onTimer.bind(this), 500);
