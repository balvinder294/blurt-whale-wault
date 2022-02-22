// All functions and events regarding the visibility and navigation

// Visibility state on the main menu
function initializeVisibility() {
    $("#accounts").html("");
    $("#add_account_div").hide();
    $(".error_div").hide();
    $(".success_div").hide();
    $("#master_check").hide();
    $("#autolock_div").hide();
    $('#chain').val("");
    $("#username").val("");
    $("#pwd_active").val("");
    $("#pwd_posting").val("");
    $("#pwd_memo").val("");
    $("#acc_transfers").hide();
    $(".error_div").html("");
    $("#posting_key").prop("checked", true);
    $("#active_key").prop("checked", true);
    $("#memo_key").prop("checked", true);
    $(".account_info").hide();
    $(".account_info_content").hide();
    $(".account_info_menu").removeClass("rotate180");
    $("#transfer_to").hide();
    $("#add_key_div").hide();
    $("#estimation_info").hide();
    $("#pref_div").hide();
    $("#add_rpc_div").hide();
    $("#new_key").val("");
    $("#keys_info").empty();
    $("#balance_steem").html("");
    $("#balance_sbd").html("");
    $("#balance_sp").html("");
    $(".checkbox_memo").hide();
    $("#encrypt_memo").prop("checked",false);
    $("#register").hide();
    $("#unlock").hide();
    $("#send_div").hide();
    $("#settings_div").hide();
    $("#add_account_div .back_enabled").removeClass("back_disabled");
}

// Use "Enter" as confirmation button for unlocking and registration
$('#unlock_pwd').keypress(function(e) {
    if (e.keyCode == 13)
        $('#submit_unlock').click();
});

$('#confirm_master_pwd').keypress(function(e) {
    if (e.keyCode == 13)
        $('#submit_master_pwd').click();
});

// Clicking back after "forgot password"
$("#back_forgot").click(function() {
    $("#forgot_div").hide();
    if ($(this).attr("id") == "back_forgot_settings")
        $("#settings_div").show();
    else
        $("#unlock").show();
});

// Clicking back after "backup"
$("#back_backup").click(function() {
    $("#backup_div").hide();
    $("#settings_div").show();
});

// Clicking back after "add key"
$("#add_key_div .back_enabled").click(function() {
    $("#add_key_div").hide();
    $("#manage_keys").show();
    $(".error_div").hide();
});

$("#add_rpc_div .back_enabled").click(function() {
  chrome.storage.local.get(["rpc","current_rpc"],function(items){
    loadRPC(items.rpc,items.current_rpc);
    initiateCustomSelect();
      $("#add_rpc_div").hide();
      $("#pref_div").show();
  });
});

// Clicking back from the preferences menu
$(".back_pref").click(function() {
    $(".settings_child").hide();
    $("#settings_div").show();
    manageKey = false;
    getPref = false;
});

// Show forgot password
$("#forgot").click(function() {
    $("#forgot_div").show();
    $("#unlock").hide();
});

// Show backup
$("#backup").click(function() {
    $("#backup_div").show();
    $("#settings_div").hide();
});

// Show settings
$("#settings").click(function() {
    $("#settings_div").show();
    $("#main").hide();
});

// Show about
$("#about").click(function() {
    $("#about_div").show();
    $("#about_div h3").html(chrome.runtime.getManifest().name + " " + chrome.runtime.getManifest().version);
    $("#settings_div").hide();
    chrome.storage.local.get(['events'], function(items) {
        if (items && items.events && items.events.whalevault) {
            if (items.events.whalevault != chrome.runtime.getManifest().version) {
                var about_div = $("#about_div h3");
                about_div.html(about_div.html()+'&nbsp;&nbsp;<a href="https://github.com/alexpmorris/whalevault" target="_blank"><font color="yellow" style="font-weight:normal;">[latest: '+items.events.whalevault+']</font></a>');
            }
        }
    });
});

// Open the mange keys info
$("#manage").click(function() {
    manageKey = true;
    $("#manage_keys").show();
    $("#settings_div").hide();
    manageKeys($(".usernames .select-selected").eq(1).html());
});

// Go back
$(".back_menu").click(function() {
    initializeMainMenu();
});

// Click on the change password option of the settings
$("#change_pwd").click(function() {
    $("#settings_div").hide();
    $("#change_password").show();
});

// Navigate to preferences
$("#preferences").click(async function() {
    $("#pref_div").show();
    $("#settings_div").hide();
    getPref = true;
    setPreferences($('#custom_select_pref option:selected').val());
});

// After checking master key, go back to Add Account Page
$(".back_add_key").click(function() {
    $("#master_check").hide();
    $("#add_account_div").show();
});

// Go to clear wallet page
$("#clear").click(function() {
    $("#settings_div").hide();
    $("#forgot_div").show();
    $("#back_forgot").attr("id", "back_forgot_settings");
});

// Show add a new key
$('#add_key').click(function() {
    $('#add_key_div').show();
});

// extra info on the estimated account value
$("#account_value_header").click(function() {
    $('#main').hide();
    $("#estimation_info").show();
});

// Navigate to autolock menu
$("#autolock").click(function() {
    $('#settings_div').hide();
    $("#autolock_div").show();
});

// Show transaction window
$("#send").click(function() {
    $("#send_div").show();
    if(active_account.keys.hasOwnProperty("memo")){
      $(".checkbox_memo").show();
    }
    $("#main").hide();
});

// Show transaction history window
$("#history").click(function() {
    $("#acc_transfers").show();
    $("#main").hide();
});

// Toggle witness votes div
$("#witness_toggle").click(function() {
    $("#witness_votes").animate({
        top: ($("#witness_votes").css('top') == '555px') ? 505 : 555
    }, 500);
});

// Show / hide password
$(".input_img_right_eye").click(function() {
    if ($("#unlock_pwd").prop("type") == "password") {
        $("#unlock_pwd").prop("type", "text");
        $(".input_img_right_eye").prop("src", "../images/eye.png");
    } else {
        $("#unlock_pwd").prop("type", "password");
        $(".input_img_right_eye").prop("src", "../images/hide.png");
    }
});

$("#add_new_rpc").click(function(){
    addNewRPC($("#new_rpc").val());
});

// Handle pages visibility

function showRegister() {
    $("#main").hide();
    $("#register").show();
}

function showUnlock() {
    $("#main").hide();
    $("#unlock").show();
    $("#unlock_pwd").focus();
}

function showLoader() {
    $("#send_loader").show();
    $("#send_transfer").hide();
}

function showAccountInfo(account, that) {
    if (account.keys.hasOwnProperty("active"))
        $("#transfer_to").show();
    $(".account_info").attr("id", "a" + $(that).index());
    $("#account_info_name").html("@" + account.name);
    $("#main").hide();
    $(".account_info").show();
}

$("#add_new_account").click(function() {
    showAddAccount();
});

function showAddAccount() {
    $("#add_account_div").css("display", "block");
    $("#main").css("display", "none");
    $("#settings_div").css("display", "none");
    $("#add_account_div select").val("wls");
}

function copyToClipboard(str) {
    const el = document.createElement('textarea');
    el.value = str;
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
};
  
$("#key_view").click(function() {
    var chain = getChainID($("#chain").val().toLowerCase());
    if (chain.length < 3) chain = 'stm';
    var prefix = chain.toUpperCase();
    const username = $("#username").val();
    var pwd_active = $("#pwd_active").val();
    var keys = {};
    if (pwd_active != "" && !Steem.Auth.isWif(pwd_active)) {
        let pub_key_check = Steem.PublicKey.fromString(pwd_active, pwd_active.substring(0,3));
        if (pub_key_check != null) {
            showError("KeyTool: Password appears to be a PUBLIC Key.  Master Password is required."); $("#pwd_active").val(''); return;
        }
        if (['bts','bts_test','gph','ppy','usc','eos','tlo','wbi','utx','wax','cyb'].includes(chain)) {
            var auths = ["owner", "active", "memo"];
            if (['tlo','wbi','utx','wax'].includes(chain)) prefix = 'EOS';
        } else {
            var auths = ["owner", "active", "posting", "memo"];
            if (chain == 'hiv') prefix = 'STM';
        }
        keys = Steem.Auth.getPrivateKeys(username, pwd_active, auths, chain/*seedType*/, prefix);
        keys.username = username;
        keys.master_password = pwd_active;
        keys.chain = chain;
        let str_keys = $('#chains').find('option[value='+keys.chain+']').html() + ' KeySet for username: '+keys.username+'\n\n'+
                       'Private Keys in order of importance (Keep them Private)\n'+
                       'master_password: '+keys.master_password+'\n'+
                       'owner          : '+keys.owner+'\n'+
                       'wallet/active  : '+keys.active+'\n';
        if (keys.posting) str_keys += 'social/posting : '+keys.posting+'\n';
        str_keys += 'memo           : '+keys.memo+'\n'+
                    '\nPublic Keys (safe to share with third parties)\n'+
                    'ownerPubkey         : '+keys.ownerPubkey+'\n'+
                    'wallet/activePubkey : '+keys.activePubkey+'\n';
        if (keys.posting) str_keys += 'social/postingPubkey: '+keys.postingPubkey+'\n';
        str_keys += 'memoPubkey          : '+keys.memoPubkey+'\n'+
                    '\nnotes: Pubkeys (Public Keys starting with '+prefix+'...) are safe to share, while Private Keys and Passwords must be well guarded and safely stored away! your master_password and owner key are most important of all (and least used), as all keys are derived from your master_password, and your owner key lets you change all your other keys.\n';
        copyToClipboard(str_keys);
        showError("KeyTool: Private Keys Copied to Clipboard!");
        return;
    }
    showError("KeyTool: Chain, UserName and Master Password Required");
});
