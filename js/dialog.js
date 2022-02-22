function getChainNiceName(chain_id) {
    chain_id = chain_id.toLowerCase();
    if (chain_id == "eos") return "Eos"; else
    if (chain_id == "tlo" || chain_id == "telos") return "Telos"; else
    if (chain_id == "wbi" || chain_id == "worbli") return "Worbli"; else
    if (chain_id == "utx" || chain_id == "uxnetwork") return "UXNetwork"; else
    if (chain_id == "wax") return "Wax"; else
    if (chain_id == "cyb" || chain_id == "cyberway") return "CyberWay"; else
    if (chain_id == "gls" || chain_id == "golos") return "Golos"; else
    if (chain_id == "wls" || chain_id == "whaleshares") return "WhaleShares"; else
    if (chain_id == "smk" || chain_id == "smoke") return "Smoke"; else
    if (chain_id == "vit" || chain_id == "vice") return "Vice"; else
    if (chain_id == "ppy" || chain_id == "peerplays") return "Peerplays"; else 
    if (chain_id == "bts" || chain_id == "bitshares") return "BitShares"; else 
    if (chain_id == "stm" || chain_id == "steem") return "STEEM"; else return escapeHtml(chain_id);
}

function escapeHtml(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
}

function findArrayElementInArray(haystack, arr) {
    return arr.some(function (v) {
        return haystack.indexOf(v) >= 0;
    });
}

function obj_to_html(obj, max_str_len) {
    if (max_str_len == null) max_str_len = 25;
    var html = [];
    for (var key in obj) {
        var val = obj[key];
        if (typeof val == 'object') {
            val = JSON.stringify(val);
        }
        if (typeof val == 'string') {
            var color = 'white';
            if (['amount', 'quantity'].includes(key)) color = 'cyan';
            val = escapeHtml(val.replace(/[\\"]/g,''));
            if (val.length > max_str_len) val = '<span style="color:'+color+';" title="'+val+'">'+val.substring(0,max_str_len)+' ... </span>'; else
              val = '<span style="color:'+color+';">'+val+'</span>';
        } 
        if (typeof val == 'number') {
            val = '<span style="color:cyan;">'+val+'</span>';
        } else 
        if (typeof val == 'object') {
            //val = '<span style="color:white;">'+escapeHtml(JSON.stringify(val, null, 2))+'</span>';
        } else {
            val = '<span style="color:white;">'+val+'</span>';
        }
        html.push('&nbsp;&nbsp;<span style="color:lightgray;">'+escapeHtml(key)+'</span>: '+ val+'<br/>');
    }
    return '{\n'+html.join('')+'}\n';
}

chrome.runtime.onMessage.addListener(function(msg, sender, sendResp) {
    if (msg.command == "queueStats") {
        if (msg.queue_len > 0) $('#tx-pending').html('pending: '+ msg.queue_len); else $('#tx-pending').html('');
        var is_news = $('h2').text().startsWith('News');
        if (is_news) window.close();
    } else
    if (msg.command == "sendDialogError") {
        // Display error window

        if (!msg.msg.success) {

            $("#tx_loading").hide();
            if (msg.msg.error == "locked") {
                $(".unlock").show();
                $("#error-ok").hide();
                $("#no-unlock").click(function() {
                    window.close();
                });
                $("#yes-unlock").click(function() {
                    chrome.runtime.sendMessage({
                        command: "unlockFromDialog",
                        data: msg.msg.data,
                        tab: msg.tab,
                        mk: $("#unlock-dialog").val(),
                        domain: msg.domain,
                        request_id: msg.request_id
                    });
                });
                $('#unlock-dialog').keypress(function(e) {
                    if (e.keyCode == 13)
                        $('#yes-unlock').click();
                });
                $('#unlock-dialog').focus();
            }
            $("#dialog_header").text((msg.msg.error == "locked") ? "Unlock WhaleVault" : "Error");
            $("#dialog_header").addClass("error_header");
            $("#error_dialog").html(msg.msg.display_msg);
            $("#modal-body-msg").hide();
            $(".modal-body-error").show();
            $(".dialog-message").hide();
            $("#error-ok").click(function() {
                window.close();
            });
        }
    } else if (msg.command == "wrongMk") {
        $("#error-mk").html("Wrong password!");
        chrome.browserAction.setIcon({ path: '/images/icons8-safe-50.png' });
        chrome.browserAction.setTitle({ title: chrome.runtime.getManifest().name + ' :: locked'})
    } else if (msg.command == "sendDialogConfirm") {

        let enforce = null;
        let encode = null;
        // Display confirmation window
        $("#confirm_footer").show();
        $('#modal-body-msg').show();
        var type = msg.data.type;

        if (type == 'pubkeys') {

            let chain = msg.data.username.substring(0,3).toLowerCase();

            if (msg.add_keys) {
                $("#dialog_header").html('<span style="margin-left:-15px;">Add <b><font color=yellow>'+escapeHtml(chain)+'</font></b> Account Keys</span>');
                $('#modal-body-msg .msg-data').css('max-height', '245px');
                $('.msg-data').hide();
                $("#dialog_message").show();
                $("#dialog_message").html("<font size=4><b><font color=yellow>"+escapeHtml(msg.data.domain)+
                                          "</font></b> is requesting permission to add or update the following keys for <font color=yellow><b>"+escapeHtml(msg.data.username)+
                                          "</b></font> in WhaleVault:<br/><br/>"+msg.add_keys.join('<br/>')+
                                          '<br/><br/><font size=2 color="lightgray">Note: This only effects keys stored in WhaleVault</font>');
                $('.keep_checkbox').hide();
                $('#confirm_footer').css('padding', '35px 0 0 40px');
                $('#custom_select_keys').show();
            } else {

                $("#dialog_header").html('Select <b><font color=yellow>'+escapeHtml(chain)+'</font></b> Account');
                $('#modal-body-msg .msg-data').css('max-height', '245px');
                $('.msg-data').hide();
                $("#dialog_message").show();
                $("#dialog_message").html("<font size=4><b><font color=yellow>"+escapeHtml(msg.data.domain)+
                                          "</font></b> is requesting you select the <b><font color=yellow>"+getChainNiceName(chain) + 
                                          "</font></b> account to use:</font>");
                $('.keep_checkbox').hide();
                $('#confirm_footer').css('padding', '35px 0 0 40px');
                $('#custom_select_keys').show();

                chrome.storage.local.get(['last_account_'+chain], function(items) {
                    // Add the last account selected to the front of the account list.
                    if (items['last_account_'+chain]) {
                        let last = msg.chain_account_names.find(a => a == items['last_account_'+chain]);
                        if (last) {
                            msg.chain_account_names.splice(msg.chain_account_names.indexOf(last), 1);
                            msg.chain_account_names.unshift(last);
                        }
                    }
                    $(".usernames").html("<select></select>");
                    for (i in msg.chain_account_names) {
                        $(".usernames select").append("<option>" + escapeHtml(msg.chain_account_names[i]) + "</option>");
                    }
                    initiateCustomSelect();
                });
            }

        } else {

            var titles = {
                'encryptMemo': 'Encrypt Memo',
                'decryptMemo': 'Decrypt Memo',
                'signBuffer': typeof msg.data.message == 'object' ? 'Sign Transaction' : 'Sign Message',
            };
            var title = titles[type];
            $("#dialog_header").html(title);

            if (msg.data.display_msg) {
                $('#modal-body-msg .msg-data').css('max-height', '245px');
                $("#dialog_message").show();
                $("#dialog_message").text(msg.data.display_msg);
            }

            var message = "";
            $("." + type).show();
            $(".modal-body-error").hide();
            //$("#username").text("@" + msg.data.username);
            $("#modal-content").css("align-items", "flex-start");

            $("#keep_div").show();
            var user = msg.data.username.split(":");
            var prompt_msg = "Check to ALLOW this scope next time without Popup Verification";
            $("#keep_label").html(prompt_msg);

            switch (type) {
                case "encryptMemo":
                case "decryptMemo":
                case "signBuffer":
                var allow_bypass = true;

                var key_str = msg.data.method+"Key";
                if (key_str.startsWith('Active') || key_str.startsWith('Owner')) {
                    allow_bypass = false;  
                    if (key_str.startsWith('Owner') || (msg.data.auths && msg.data.auths.includes('owner'))) {
                        key_str = '😱 OWNER KEY 😱';
                        $("#owner_key").show();
                    } else key_str = 'ACTIVE KEY';
                    key_str = '<font color="red" style="background-color:yellow;border-radius:5px;"><b>&nbsp;'+key_str+'&nbsp;</b></font>';
                }

                var usr_arr = escapeHtml(msg.data.username).split(":");
                var niceName = getChainNiceName(usr_arr[0]);
                if ((typeof msg.data.message == 'object') && msg.data.message.chain && (msg.data.message.chain != usr_arr[0])) 
                    niceName += ' <font color=yellow>⟶ ' + getChainNiceName(msg.data.message.chain) + '</font>';

                // limited "active key" exception, allows bypass option if limit_order_cancel is the only operation
                if (msg.data.optypes && (msg.data.optypes.length == 1) && (msg.data.optypes[0] == 'limit_order_cancel')) allow_bypass = true;

                var ops_str = msg.data.optypes && msg.data.optypes.length > 0 ? ' ['+msg.data.optypes.join(', ')+']' : "";
                if (allow_bypass && (ops_str != "") && 
                    findArrayElementInArray(msg.data.optypes, ['issue','transfer','delegation','updateauth','account_update',
                    'transfer_to_vesting','withdraw_vesting','delegatebw','undelegatebw'])) allow_bypass = false;
                if (!allow_bypass) {
                    $('#keep').attr('disabled', true);  // disallow check bypass for transfers, delegation, etc
                    $('.checkmark').attr('title','Disabled for This Operation!');
                    $('.keep_checkbox').hide();
                    $('#confirm_footer').css('padding', '35px 0 0 40px');
                }

                $("#dialog_message").show();
                var html = ['<table style="line-height:0.99;font-size:16px;font-weight:normal;">'];
                if (msg.data.warn_domain && msg.data.warn_domain.reason && msg.data.warn_domain.reason  != "") {
                    var site_color = 'fuchsia';
                    var str_warn = escapeHtml(msg.data.warn_domain.reason.substring(0,25).toUpperCase());
                    if (msg.data.warn_domain.url && msg.data.warn_domain.url != '') {
                        str_warn = '<a href="'+escapeHtml(msg.data.warn_domain.url)+'" target="_blank" style="color:yellow;text-decoration:none;">'+str_warn+'</a>';
                    }
                    var alt_domain = '<font color=yellow> ['+str_warn+']</font>';
                } else {
                    var site_color = 'yellow';
                    var alt_domain = ' ['+msg.domain.toUpperCase()+']'; 
                }
                
                html.push('<tr><td style="color:lightgray;font-style:italic;">site:</td><td style="color:'+site_color+';font-family:Roboto;font-size:1.05em;">'+msg.domain+alt_domain+'</td></tr>');
                html.push('<tr><td style="color:lightgray;font-style:italic;">auth:</td><td>'+key_str+'</td></tr>');
                html.push('<tr><td style="color:lightgray;font-style:italic;">chain:</td><td>'+niceName+'</td></tr>');
                html.push('<tr><td style="color:lightgray;font-style:italic;">user:</td><td>'+usr_arr[1]+'</td></tr>');
                html.push('<tr><td style="color:lightgray;font-style:italic;">reason:</td><td>'+escapeHtml(msg.data.reason)+"<font color=yellow>"+escapeHtml(ops_str)+'</font></td></tr>');
                html.push('</table>');
                $("#dialog_message").html(html.join(''));

                if (typeof msg.data.message == 'string') {
                    $('#message_title').text('MESSAGE ('+msg.data.message.length+' bytes)');
                    $("#message_sign").text(msg.data.message.length > 1024 ? msg.data.message.substring(0,1024)+'\n\n... ('+(msg.data.message.length-1024)+' more bytes)' : msg.data.message);
                } else {

                    html = [];
                    var op = msg.data.message;
                    if ((typeof op == 'object') && (op.operations || op.actions)) {
                        try {
                            const ops = op.operations ? op.operations : op.actions;

                            if (typeof op == 'object') var payload = JSON.stringify(op, null, 2); else {
                                var payload = op.toString();
                                try {
                                    var payload_obj = JSON.parse(payload);
                                    payload = JSON.stringify(payload_obj, null, 2);
                                } catch (e) {}
                            }

                            var ops_title = ops.length+' Operation';
                            if (ops.length != 1) ops_title += 's';
                            $('#message_title').html(ops_title).attr('title', payload);

                            for (var j = 0; j <= ops.length-1; j++) {
                                //var j_val = '<font color=white>'+escapeHtml(JSON.stringify(op.operations[j][1], null, 2).replace(/[\\"]/g,''))+'</font>\n';
                                if (op.operations) {
                                    j_val = obj_to_html(ops[j][1]);
                                    html.push('<font color=yellow>'+escapeHtml(ops[j][0])+':</font> '+j_val);
                                } else {
                                    j_val = obj_to_html(ops[j].data);
                                    var op_scope = ops[j].account != null ? " <font color=cyan>"+escapeHtml(ops[j].account)+"</font>" : "";
                                    html.push('<font color=yellow>'+escapeHtml(ops[j].name)+op_scope+':</font> '+j_val);
                                }
                            }
                        } catch(e) {}
                        console.log(html);
                        $("#message_sign").html(html.join('\n'));
                    } else {
                        $("#message_sign").text(JSON.stringify(msg.data.message, null, 2).replace(/[\\"]/g,''));
                    }
                }
                break;
            }

        }

        // Closes the window and launch the transaction in background
        $("#proceed").click(function() {
            let data = msg.data;
            if (data.type == "transfer" && !enforce)
                data.username = $("#select_transfer option:selected").val();
            if (data.type == "pubkeys" && $(".usernames .select-selected").html() != null) {
                data.username = $(".usernames .select-selected").html();
                let chain = data.username.substring(0,3);
                let stor_obj = {};
                stor_obj['last_account_'+chain] = data.username;
                chrome.storage.local.set(stor_obj);
            }
            chrome.runtime.sendMessage({
                command: "acceptTransaction",
                data: data,
                tab: msg.tab,
                domain: msg.domain,
                keep: $("#keep").is(':checked'),
                alt_key: $('#owner_key input').val()
            });

            window.close();  // closes window once tx is accepted

        });

        // Closes the window and notify the content script (and then the website) that the user refused the transaction
        $("#cancel").click(function() {
            window.close();
        });
    } else if (msg.command == "answerRequest") {
        if (!msg.msg.success) {
            $('#tx_loading').hide();
            $("#dialog_header").text((msg.msg.success == true) ? "Success" : "Error");
            $("#error_dialog").html(msg.msg.message);
            $(".modal-body-error").show();
            $("#error-ok").click(function() {
                window.close();
            });
        }
    } else if (msg.command == "showNewsAlerts") {
        console.log(msg.alerts);
        $('#tx_loading').hide();
        $("#dialog_header").text("News & Alerts");
        var html = [];
        for (var i in msg.alerts) {
            var local_date = new Date(msg.alerts[i].dt).toLocaleString();  // "2019-01-01T12:00:00Z"
            var url = escapeHtml(msg.alerts[i].url);
            var title = escapeHtml(msg.alerts[i].title);
            html.push('<div style="color:lightgray;font-style:italic;font-size:0.65em">'+local_date+'</div>');
            html.push('<div><a href="'+url+'" target="_blank" style="color:yellow;text-decoration:none;">'+title+'</a></div>');
            html.push('<div style="margin-top:10px;"/>');
            if (i > 25) break;
        }
        $("#error_dialog").css('height','350px').css('overflow','auto').css('scrollbar-width','none').html(html.join(''));
        $(".modal-body-error").show();
        $("#error-ok").click(function() {
            window.close();
        });
    } else if (msg.command == "backupKeys") {
        $('#tx_loading').hide();
        $("#dialog_header").text("Backup Keys");
        chrome.storage.local.get(['accounts'], function(items) {
            var dt = new Date().toISOString().split('T')[0].replace(/-/g,'');
            var link = document.createElement('a');
            link.download = "whalevault_"+dt+".dat";
            link.href = 'data:application/text;charset=utf-8,' + items.accounts;
            document.body.appendChild(link);
            link.click();
        });
    } else if (msg.command == "restoreKeys") {
        $('#tx_loading').hide();
        $("#dialog_header").text("Restore Keys");
        $("#restore_file").css("display", "block");
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
        $('#restore_file').click();
        document.body.onfocus = function() {
            setTimeout(function(){ window.close(); }, 500);
        };
    }
});

function initiateCustomSelect() {
    /*look for any elements with the class "custom-select":*/
    x = document.getElementsByClassName("custom-select");

    for (i = 0; i < x.length; i++) {
        selElmnt = x[i].getElementsByTagName("select")[0];

        /*for each element, create a new DIV that will act as the selected item:*/
        a = document.createElement("DIV");
        a.setAttribute("class", "select-selected");
        a.innerHTML = selElmnt.options[selElmnt.selectedIndex].innerHTML;
        x[i].appendChild(a);
        /*for each element, create a new DIV that will contain the option list:*/
        b = document.createElement("DIV");
        b.setAttribute("class", "select-items select-hide");
        for (j = 0; j < selElmnt.length; j++) {
            /*for each option in the original select element,
            create a new DIV that will act as an option item:*/
            c = document.createElement("DIV");
            c.innerHTML = selElmnt.options[j].innerHTML;
            c.addEventListener("click", function(e) {
                /*when an item is clicked, update the original select box,
                and the selected item:*/
                var y, i, k, s, h;
                s = this.parentNode.parentNode.getElementsByTagName("select")[0];
                h = this.parentNode.previousSibling;
                for (i = 0; i < s.length; i++) {
                    if (s.options[i].innerHTML == this.innerHTML) {
                        s.selectedIndex = i;
                        h.innerHTML = this.innerHTML;
                        y = this.parentNode.getElementsByClassName("same-as-selected");
                        for (k = 0; k < y.length; k++) {
                            y[k].removeAttribute("class");
                        }
                        this.setAttribute("class", "same-as-selected");
                        break;
                    }
                }
                h.click();
            });
            b.appendChild(c);
        }
        x[i].appendChild(b);
        a.addEventListener("click", function(e) {
            /*when the select box is clicked, close any other select boxes,
            and open/close the current select box:*/
            e.stopPropagation();
            closeAllSelect(this);
            this.nextSibling.classList.toggle("select-hide");
            this.classList.toggle("select-arrow-active");
        });
    }

    function closeAllSelect(elmnt) {
        /*a function that will close all select boxes in the document,
        except the current select box:*/
        var x, y, i, arrNo = [];
        x = document.getElementsByClassName("select-items");
        y = document.getElementsByClassName("select-selected");
        for (i = 0; i < y.length; i++) {
            if (elmnt == y[i]) {
                arrNo.push(i)
            } else {
                y[i].classList.remove("select-arrow-active");
            }
        }
        for (i = 0; i < x.length; i++) {
            if (arrNo.indexOf(i)) {
                x[i].classList.add("select-hide");
            }
        }
    }
    /*if the user clicks anywhere outside the select box,
    then close all select boxes:*/
    document.addEventListener("click", closeAllSelect);
}

$(window).on("load", function() {
    chrome.runtime.sendMessage({
        command: "dialogReady"
    });
});

