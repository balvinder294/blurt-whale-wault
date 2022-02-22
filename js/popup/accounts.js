// All functions regarding the handling of a particular account

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
    if (chain == "other") return "oth"; else return escapeHtml(chain.substring(0,3));
}

function escapeHtml(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
}

// Load account information
function loadAccount(name) {
    $('#tx_log').text('');
    let account = accounts_json.list.filter(function(obj, i) {
        return obj.name === name;
    })[0];
    var is_all = name.startsWith("ALL ");
    if (is_all || (account != null && account != undefined)) {
        active_account = account;

        chrome.storage.local.get(['tx_log'], function(items) {
            var tx_log = items.tx_log;
            var name = is_all ? 'all' : account.name;

            if (tx_log != null && tx_log[name] != null) {
                for (var i = 0; i <= tx_log[name].length-1; i++) {

                    var msg = tx_log[name][i];
                    var key_str = msg.data.method+"Key";
                    if (key_str.startsWith('Active')) {
                        if (msg.data.auths && msg.data.auths.includes('owner')) key_str = 'OWNER KEY'; else key_str = 'ACTIVE KEY';
                        key_str = '<font color=red><b>'+key_str+'</b></font>';
                    }
                    var ops_str = msg.data.optypes && msg.data.optypes.length > 0 ? ' ['+msg.data.optypes.join(', ')+']' : "";
      
                    if (typeof msg.data.message == 'object') var payload = JSON.stringify(msg.data.message, null, 2); else {
                        var payload = msg.data.message.toString();
                        try {
                            var payload_obj = JSON.parse(payload);
                            payload = JSON.stringify(payload_obj, null, 2);
                        } catch (e) {}
                    }
                    payload = escapeHtml(payload).replace(/\'/g,'');
                    var result = msg.result != null ? escapeHtml(msg.result).replace(/\'/g,'') : "";
                    var result_color = msg.error ? "<font color=#f2c5c5>" : "<font color=#cdefb3>";

                    var user = escapeHtml(msg.data.username);
                    if ((typeof msg.data.message == 'object') && msg.data.message.chain && (msg.data.message.chain != user.substring(0,3)))
                        user += ' <font color=yellow>⟶ ' + escapeHtml(msg.data.message.chain) + '</font>';

                    var html = [];
                    html.push('<span style="color:lightgray;font-style:italic;font-size:0.65em">'+msg.dt+'</span>');
                    html.push('<table style="line-height:0.75">');
                    if (is_all) html.push('<tr><th style="color:lightgray;font-style:italic;">user:</th><th>'+user+'</th></tr>');
                    if (msg.data.warn_domain && msg.data.warn_domain.reason && msg.data.warn_domain.reason  != "") {
                        var site_color = 'fuchsia';
                        var str_warn = escapeHtml(msg.data.warn_domain.reason.substring(0,25).toLowerCase());
                        if (msg.data.warn_domain.url && msg.data.warn_domain.url != '') {
                            str_warn = '<a href="'+escapeHtml(msg.data.warn_domain.url)+'" target="_blank" style="color:yellow;text-decoration:none;">'+str_warn+'</a>';
                        }
                        var alt_domain = '<font color=yellow> ['+str_warn+']</font>';
                    } else {
                        var site_color = 'yellow';
                        var alt_domain = '';
                    }        
                    html.push('<tr><th style="color:lightgray;font-style:italic;">site:</th><th style="color:'+site_color+';" title="'+msg.data.domain.toUpperCase()+'">'+msg.data.domain+alt_domain+'</th></tr>');
                    html.push('<tr><th style="color:lightgray;font-style:italic;">auth:</th><th title=\''+payload+'\'>'+key_str+' ['+msg.data.type+']</th></tr>');
                    html.push('<tr><th style="color:lightgray;font-style:italic;">reason:</th><th title=\''+result+'\'>'+result_color+escapeHtml(msg.data.reason+ops_str)+'</font></th></tr>');
                    html.push('</table><div style="margin-top:10px;"/>');
                    $('#tx_log').append(html.join(''));
                }
            }
          });

    }
}

// Adding accounts. Private keys can be entered individually or by the mean of the
// master key, in which case user can chose which keys to store, mk will then be
// discarded.
$("#check_add_account").click(function() {
    $("#master_check").css("display", "none");
    var chain = getChainID($("#chain").val().toLowerCase());
    if (chain.length < 3) chain = 'stm';
    const username = $("#username").val();
    var pwd_active = $("#pwd_active").val();
    var pwd_posting = $("#pwd_posting").val();
    var pwd_memo = $("#pwd_memo").val();
    var keys = {};
    if (pwd_active != "" && !Steem.Auth.isWif(pwd_active)) {
        let pub_key_check = Steem.PublicKey.fromString(pwd_active, pwd_active.substring(0,3));
        if (pub_key_check != null) {
            showError("Password appears to be a PUBLIC Key.  Master Password or PRIVATE ActiveKey is required."); $("#pwd_active").val(''); return;
        }
        if (chain == 'uos' && pwd_active.includes(' ')) {  // uos brainkey
            let owner_key = Steem.PrivateKey.fromSeed(pwd_active);
            let active_key = Steem.PrivateKey.fromSeed(owner_key.toString());
            let active_pubkey = active_key.toPublicKey().toString();
            let social_key = Steem.PrivateKey.fromSeed(active_key.toString());
            let social_pubkey = social_key.toPublicKey().toString();
            keys.active = active_key.toString();
            keys.activePubkey = active_pubkey;
            keys.posting = social_key.toString();
            keys.postingPubkey = social_pubkey;
        } else {
            if (chain.startsWith('bts') || chain == 'gph' || chain == 'ppy' || chain == 'usc') {
                var auths = ["active", "memo"]; 
                pwd_posting = "";
            } else var auths = ["posting", "active", "memo"];
            keys = Steem.Auth.getPrivateKeys(username, pwd_active, auths, chain/*seedType*/, chain.toUpperCase());
        }
    } else {
        if (chain.startsWith('bts') || chain == 'gph' || chain == 'ppy' || chain == 'usc') {
            pwd_posting = "";
            $("#pwd_posting").val('');
        }
        if (pwd_active != "") {
            try { 
                let pubKey = Steem.Auth.wifToPublic(pwd_active);
                keys.active = pwd_active;
                keys.activePubkey = pubKey;
            } catch (e) { showError("Invalid ActiveKey Provided"); $("#pwd_active").val(''); return; }
        }
        if (pwd_posting != "") {
            try { 
                let pubKey = Steem.Auth.wifToPublic(pwd_posting);
                keys.posting = pwd_posting;
                keys.postingPubkey = pubKey;
            } catch (e) { showError("Invalid PostingKey Provided"); $("#pwd_posting").val(''); return; }
        }
        if (pwd_memo != "") {
            try { 
                let pubKey = Steem.Auth.wifToPublic(pwd_memo);
                keys.memo = pwd_memo;
                keys.memoPubkey = pubKey;
            } catch (e) { showError("Invalid MemoKey Provided"); $("#pwd_memo").val(''); return; }
        }
    }
    var chain_prefix = Steem.config.networks[chain] ? Steem.config.networks[chain].address_prefix : chain.toUpperCase();
    if (keys.activePubkey) keys.activePubkey = chain_prefix+keys.activePubkey.substring(3);
    if (keys.postingPubkey) keys.postingPubkey = chain_prefix+keys.postingPubkey.substring(3);
    if (keys.memoPubkey) keys.memoPubkey = chain_prefix+keys.memoPubkey.substring(3);
    if (chain !== "" && username !== "" && Object.keys(keys).length > 0) {
        if (accounts_json && accounts_json.list.find(function(element) {
                return element.name == chain+":"+username
            })) {
            showError("You already registered an account for " + username + "@"+chain+"!");
        } else {
            addAccount({
                name: chain+":"+username,
                keys: keys
            });
        }
        $("#pwd_active").val('');
        $("#pwd_posting").val('');
        $("#pwd_memo").val('');
    } else {
        showError("Please Complete the Fields");
    }
});

// If master key was entered, handle which keys to save.
$("#save_master").click(function() {
    if ($("#posting_key").prop("checked") || $("#active_key").prop("checked") || $("#memo_key").prop("checked")) {
        let permissions = [];
        if ($("#posting_key").prop("checked"))
            permissions.push("posting");
        if ($("#active_key").prop("checked"))
            permissions.push("active");
        if ($("#memo_key").prop("checked"))
            permissions.push("memo");
        const keys = Steem.Auth.getPrivateKeys($("#username").val(), $("#pwd").val(), permissions);
        addAccount({
            name: $("#username").val(),
            keys: keys
        });
    }
});

// Add new account to Chrome local storage (encrypted with AES)
function addAccount(account) {
    if (accounts_json != null) {
        let newlist = [];
        for (let acc of accounts_json.list) {
            if (acc != undefined) {
                newlist.push(acc);
            }
        }
        accounts_json.list = newlist;
    }
    let saved_accounts = accounts_json;
    if (saved_accounts == undefined || saved_accounts == null || saved_accounts.list == 0)
        accounts = {
            list: [account]
        };
    else {
        saved_accounts.list.push(account);
        saved_accounts.list.sort(function(a,b) { 
            if (a.name < b.name) return -1;
            if (a.name > b.name) return 1;
            return 0;
        });
        accounts = saved_accounts;
    }
    chrome.storage.local.set({
        accounts: encryptJson(accounts, mk)
    });
    initializeMainMenu();
}

// Display Add Copy or delete individual keys
function manageKeys(name) {
    let index = -1;
    let account = accounts_json.list.filter(function(obj, i) {
        if (obj.name === name) {
            index = i;
            return obj;
        }
    })[0];
    const keys = account.keys;
    $(".public_key").html("");
    $(".private_key").html("");
    for (keyName in keys) {
        if (keyName.includes("posting")) {
            $(".img_add_key").eq(0).hide();
            $(".remove_key").eq(0).show();
            $(".key_view_btn").eq(0).show();
            if (keyName.includes("Pubkey"))
                $(".public_key").eq(0).html(account.keys[keyName]);
            else {
                $(".private_key").eq(0).html('ValidKey');
                $(".key_view_btn").eq(0).data({name, keyName});
            }
        } else if (keyName.includes("active")) {
            $(".img_add_key").eq(1).hide();
            $(".remove_key").eq(1).show();
            $(".key_view_btn").eq(1).show();
            if (keyName.includes("Pubkey"))
                $(".public_key").eq(1).html(account.keys[keyName]);
            else {
                $(".private_key").eq(1).html('ValidKey');
                $(".key_view_btn").eq(1).data({name, keyName});
            }
        } else if (keyName.includes("memo")) {
            $(".img_add_key").eq(2).hide();
            $(".remove_key").eq(2).show();
            $(".key_view_btn").eq(2).show();
            if (keyName.includes("Pubkey"))
                $(".public_key").eq(2).html(account.keys[keyName]);
            else {
                $(".private_key").eq(2).html('ValidKey');
                $(".key_view_btn").eq(2).data({name, keyName});
            }
        }
    }
    if ($(".private_key").eq(0).html() === "") {
        $(".img_add_key").eq(0).show();
        $(".remove_key").eq(0).hide();
        $(".key_view_btn").eq(0).hide();
    }
    if ($(".private_key").eq(1).html() === "") {
        $(".img_add_key").eq(1).show();
        $(".remove_key").eq(1).hide();
        $(".key_view_btn").eq(1).hide();
    }
    if ($(".private_key").eq(2).html() === "") {
        $(".img_add_key").eq(2).show();
        $(".remove_key").eq(2).hide();
        $(".key_view_btn").eq(2).hide();
    }
    let timeout = null;
    $(".private_key, .public_key").click(function() {
        if (timeout != null)
            clearTimeout(timeout);
        $("#copied").hide();
        $("#fake_input").val($(this).html());
        $("#fake_input").select();
        $("#copied").html("<div>PublicKey Copied to Clipboard!</div>");
        document.execCommand("copy");
        $("#copied").slideDown(600);
        timeout = setTimeout(function() {
            $("#copied").slideUp(600);
        }, 6000);
    });
    let btn_elem_clicked = null;
    $(".key_view_btn").click(function() {
        btn_elem_clicked = $(this);
        pw_prompt({
            lm: "Type WhaleVault Password to Unlock Key:", 
            callback: function(password) {
                if (password == mk) {
                    if (timeout != null)
                        clearTimeout(timeout);
                    $("#copied").hide();
                    let account = accounts_json.list.filter(function(obj, i) {
                        if (obj.name === btn_elem_clicked.data().name) {
                            index = i;
                            return obj;
                        }
                    })[0];
                    $("#fake_input").val(account.keys[btn_elem_clicked.data().keyName]);
                    $("#fake_input").select();
                    $("#copied").html("<div>PrivateKey Copied to Clipboard!</div>");
                    document.execCommand("copy");
                    $("#copied").slideDown(600);
                    timeout = setTimeout(function() {
                        $("#copied").slideUp(600);
                    }, 6000);
                }
            }
        });
    });

    $(".remove_key").unbind("click").click(function() {
        delete accounts_json.list[index].keys[$(this).attr("id")];
        delete accounts_json.list[index].keys[$(this).attr("id") + "Pubkey"];
        if (Object.keys(accounts_json.list[index].keys).length == 0) {
            deleteAccount(index);
            $(".settings_child").hide();
            $("#settings_div").show();
        } else {
            updateAccount();
            manageKeys(name);
        }

    });
    // Delete account and all its keys
    $("#delete_account").unbind("click").click(function() {
        deleteAccount(index);
    });
    $(".img_add_key").unbind("click").click(function() {
        $("#manage_keys").hide();
        $("#add_key_div").show();
        var keyType = $(this).data('key');
        $("#add_new_key").data('key', keyType);
        var niceType = keyType.charAt(0).toUpperCase() + keyType.slice(1);
        if (niceType == 'Posting') niceType = 'Posting/Social'; else
          if (niceType == 'Active') niceType = 'Active/Wallet';
        $("#new_key").attr('placeholder', niceType + " Key");
        $('#add_key_div input').focus();
    });

    // Try to add the new key
    $('#add_new_key').unbind("click").click(function() {
        const keys = accounts_json.list[index].keys;
        const pwd = $("#new_key").val();
        var keyType = $("#add_new_key").data('key');
        if (Steem.Auth.isWif(pwd)) {
            var chain = name.substring(0,3).toLowerCase();
            var chain_prefix = Steem.config.networks[chain] ? Steem.config.networks[chain].address_prefix : chain.toUpperCase();
            var pubKey = chain_prefix + Steem.Auth.wifToPublic(pwd).substring(3);
            if (keyType == 'posting') {
                if (keys.hasOwnProperty("posting")) showError("You already entered your Posting Key!"); else
                    addKeys(index, "posting", pwd, pubKey, name);
            } else 
            if (keyType == 'active') {
                if (keys.hasOwnProperty("active")) showError("You already entered your Active Key!"); else
                    addKeys(index, "active", pwd, pubKey, name);
            } else 
            if (keyType == 'memo') {
                if (keys.hasOwnProperty("memo")) showError("You already entered your Memo Key!"); else
                    addKeys(index, "memo", pwd, pubKey, name);
            } else showError("Unsupported KeyType! ["+keyType+"]");
        } else showError("Not a private WIF!");
    });
}

// Add the new keys to the display and the encrypted storage
function addKeys(i, key, priv, pub, name) {
    accounts_json.list[i].keys[key] = priv;
    accounts_json.list[i].keys[key + "Pubkey"] = pub;
    updateAccount();
    manageKeys(name);
    $("#add_key_div").hide();
    $("#new_key").val("");
    $(".error_div").hide();
    $("#manage_keys").show();
}

// show balance for this account
function showBalances(result, res) {
    sbd = result["0"].sbd_balance.replace("SBD", "");
    const vs = result["0"].vesting_shares;
    steem_p = result["0"].balance.replace("STEEM", "");
    const total_vesting_shares = res.total_vesting_shares;
    const total_vesting_fund = res.total_vesting_fund_steem;
    sp = Steem.Formatter.vestToSteem(vs, total_vesting_shares, total_vesting_fund);
    $("#wallet_amt div").eq(0).html(numberWithCommas(steem_p));
    $("#wallet_amt div").eq(1).html(numberWithCommas(sbd));
    $("#wallet_amt div").eq(2).html(numberWithCommas(sp.toFixed(3)));
    $("#balance_loader").hide();
}

// Delete account (and encrypt the rest)
function deleteAccount(i) {
    accounts_json.list.splice(i, 1);

    chrome.storage.local.set({
        accounts: encryptJson(accounts_json, mk)
    }, function() {
        $(".settings_child").hide();
        initializeMainMenu();
    });
}

// Update account (encrypted)
function updateAccount() {
    chrome.storage.local.set({
        accounts: encryptJson(accounts_json, mk)
    });
}

var promptCount = 0;
function pw_prompt(options) {
    var lm = options.lm || "Password:",
        bm = options.bm || "Submit";
    if(!options.callback) { 
        alert("No callback function provided! Please provide one.") 
    };
                   
    var prompt = document.createElement("div");
    prompt.className = "pw_prompt";
    
    var submit = function() {
        options.callback(input.value);
        document.body.removeChild(prompt);
    };

    var label = document.createElement("label");
    label.textContent = lm;
    label.for = "pw_prompt_input" + (++promptCount);
    prompt.appendChild(label);

    var input = document.createElement("input");
    input.id = "pw_prompt_input" + (promptCount);
    input.type = "password";
    input.addEventListener("keyup", function(e) {
        if (e.keyCode == 13) submit();
    }, false);
    prompt.appendChild(input);

    var button = document.createElement("button");
    button.textContent = bm;
    button.addEventListener("click", submit, false);
    prompt.appendChild(button);

    document.body.appendChild(prompt);
    input.focus();
};
