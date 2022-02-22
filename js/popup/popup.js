let accounts_json = null,
    mk = null;
let active_account, priceBTC, sbd, steem_p, sp, priceSBD, priceSteem, votePowerReserveRate, totalSteem, totalVests, rewardBalance, recentClaims, steemPrice, dynamicProp = null;
const STEEMIT_VOTE_REGENERATION_SECONDS = (5 * 60 * 60 * 24);
let custom_created = false;
let manageKey, getPref = false;
//chrome.storage.local.remove("rpc");

$("#copied").hide();
$("#witness_votes").hide();

let isFirefox = navigator.userAgent.toLowerCase().indexOf('firefox') > -1;

// Ask background if it is unlocked
getMK();

// Check if autolock and set it to background
chrome.storage.local.get(['autolock'], function(items) {
    if (items.autolock != undefined) {
        $(".autolock input").prop("checked", false);
        $("#" + JSON.parse(items.autolock).type).prop("checked", true);
        $("#mn").val(JSON.parse(items.autolock).mn);
        setAutolock(items.autolock);
        $("#mn").css('visibility', JSON.parse(items.autolock).type == "idle" ? 'visible' : 'hidden');
    }
});
// Check if we have mk or if accounts are stored to know if the wallet is locked unlocked or new.
chrome.runtime.onMessage.addListener(function(msg, sender, sendResp) {
    if (msg.command == "sendBackMk") {
        chrome.storage.local.get(['accounts','current_rpc'], function(items) {
            /*steem.api.setOptions({
                url: items.current_rpc||'https://api.steemit.com'
            });*/
            if (msg.mk == null || msg.mk == undefined) {
                if (items.accounts == null || items.accounts == undefined){
                    showRegister();
                }
                else {
                    showUnlock();
                }
                chrome.browserAction.setIcon({ path: '/images/icons8-safe-50.png' });
                chrome.browserAction.setTitle({ title: chrome.runtime.getManifest().name + ' :: locked'})
            } else {
                mk = msg.mk;
                initializeMainMenu();
            }
        });
    } else if (msg.command == "closeBasePopup") {
        setTimeout(function(){ window.close(); }, 100);
    }
});

// Save autolock
$(".autolock").click(function() {
    $(".autolock input").prop("checked", false);
    $(this).find("input").prop("checked", "true");
    $("#mn").css('visibility', $(this).find("input").attr("id") == "idle" ? 'visible' : 'hidden');

});

// Saving autolock options
$("#save_autolock").click(function() {
    const autolock = JSON.stringify({
        "type": $(".autolock input:checkbox:checked").eq(0).attr("id") || "default",
        "mn": $("#mn").val() || 10
    });
    chrome.storage.local.set({
        autolock: autolock
    });
    setAutolock(autolock);
    initializeMainMenu();
});

// Lock the wallet and destroy traces of the mk
$("#lock").click(function() {
    chrome.browserAction.setIcon({ path: '/images/icons8-safe-50.png' });
    chrome.browserAction.setTitle({ title: chrome.runtime.getManifest().name + ' :: locked'})
    chrome.runtime.sendMessage({
        command: "sendMk",
        mk: null
    }, function(response) {});
    if (accounts_json == null) {
        accounts_json = {
            list: []
        };
        chrome.storage.local.set({
            accounts: encryptJson(accounts_json, mk)
        });
    }
    $("#back_forgot_settings").attr("id", "back_forgot");
    mk = null;
    showUnlock();
});

// Unlock with masterkey and show the main menu
$("#submit_unlock").click(function() {
    chrome.storage.local.get(['accounts'], function(items) {
        const pwd = $("#unlock_pwd").val();
        if (decryptToJson(items.accounts, pwd) != null) {
            mk = pwd;
            chrome.runtime.sendMessage({
                command: "sendMk",
                mk: mk
            }, function(response) {});
            $(".error_div").html("");
            $(".error_div").hide();
            $("#unlock_pwd").val("");
            initializeMainMenu();
            chrome.browserAction.setIcon({ path: '/images/icons8-safe-out-50.png' });
            chrome.browserAction.setTitle({ title: chrome.runtime.getManifest().name + ' :: UNLOCKED'})
        } else {
            showError("Wrong password!");
            chrome.browserAction.setIcon({ path: '/images/icons8-safe-50.png' });
            chrome.browserAction.setTitle({ title: chrome.runtime.getManifest().name + ' :: locked'})
        }
    });
});

// If user forgot Mk, he can reset the wallet
$("#forgot_div button").click(function() {
    chrome.storage.local.clear(function() {
        accounts_json = null;
        mk = null;
        chrome.runtime.sendMessage({
            command: "sendMk",
            mk: null
        }, function(response) {});
        $("#forgot_div").hide();
        $("#register").show();
    });
});

$("#backup_btn").click(function() {
    if (isFirefox) {
        chrome.runtime.sendMessage({command: "popupBackupKeys" });
        return;
    }
    chrome.storage.local.get(['accounts'], function(items) {
        console.log(items);
        var jsonBlob = new Blob([items.accounts], { type: 'application/text;charset=utf-8' });
        var link=window.URL.createObjectURL(jsonBlob);
        var dt = new Date().toISOString().split('T')[0].replace(/-/g,'');
        var link = document.createElement('a');
        link.download = "whalevault_"+dt+".dat";
        link.href = 'data:application/text,' + items.accounts;
        link.click();
    });
});

$("#restore_btn").click(function() {
    if (isFirefox) {
        chrome.runtime.sendMessage({command: "popupRestoreKeys" });
        return;
    }
    $('#restore_file').click();
});

$("#restore_file").change(function () {
    var file = $(this)[0].files[0];
    var fr = new FileReader();
    fr.onload = function() {
        chrome.storage.local.clear();
        chrome.storage.local.set({ accounts: fr.result });
        accounts_json = null;
        mk = null;
        chrome.runtime.sendMessage({
            command: "sendMk",
            mk: null
        }, function(response) {});
    };
    fr.readAsText(file);
    setTimeout(function(){ window.close(); }, 100);
});

$("#show_alerts").click(function(e) {
    chrome.runtime.sendMessage({command: 'popupNewsAlerts'});
    e.preventDefault();
});

$("#gift").click(function(e) {
    window.open('https://sharebits.io/gift_send','_blank');
    e.preventDefault();
});

// Registration confirmation
//   regex to include special character: /^(.{0,7}|[^0-9]*|[^A-Z]*|[^a-z]*|[a-zA-Z0-9]*)$/
$("#submit_master_pwd").click(function() {
    if (!$("#master_pwd").val().match(/^(.{0,7}|[^0-9]*|[^A-Z]*|[^a-z]*|[a-zA-Z0-9])$/)) {
        if ($("#master_pwd").val() == $("#confirm_master_pwd").val()) {
            mk = $("#master_pwd").val();
            chrome.runtime.sendMessage({
                command: "sendMk",
                mk: mk
            }, function(response) {});

            let accounts_json = {
                list: []
            };
            chrome.storage.local.set({
                accounts: encryptJson(accounts_json, mk)
            });

            initializeMainMenu();
            $(".error_div").hide();
        } else {
            showError("Your passwords do not match!");
        }
    } else {
        showError("Your password must be at least 8 characters long and include a lowercase letter, an uppercase letter, and a digit.");
    }
});

let menu_settings_first = false;

// Set visibilities back to normal when coming back to main menu
function initializeMainMenu() {
    initializeVisibility();
    manageKey = false;
    getPref = false;
    chrome.storage.local.get(['accounts', 'last_account','rpc','current_rpc'], function(items) {
        accounts_json = (items.accounts == undefined || items.accounts == {
            list: []
        }) ? null : decryptToJson(items.accounts, mk);
        loadRPC(items.rpc,items.current_rpc);
        if (!menu_settings_first && accounts_json != null && accounts_json.list.length == 0) {
            menu_settings_first = true;
            $("#settings_div").show();
            $("#main").hide();
        } else
        if (accounts_json != null) {
            $("#accounts").empty();
            $("#main").show();

            // Add the last account selected to the front of the account list.
            if (items.last_account) {
                let last = accounts_json.list.find(a => a.name == items.last_account);

                if (last) {
                    accounts_json.list.splice(accounts_json.list.indexOf(last), 1);
                    accounts_json.list.unshift(last);
                }
            }
            $(".usernames").html("<select></select>");
            $(".usernames select").eq(0).append("<option>ALL ACCOUNTS</option>");
            for (account of accounts_json.list) {
                $(".usernames select").append("<option>" + account.name + "</option>");
            }
            $(".usernames select").eq(0).append("<option name='add_account'>Add New Account</option>");
            initiateCustomSelect();
        } else {
            $("#main").hide();
            $("#add_account_div").show();
            $("#add_account_div .back_enabled").addClass("back_disabled");
        }
    });
}
