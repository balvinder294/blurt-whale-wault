// Content script interfacing the website and the extension
function setupInjection() {
    try {
        var scriptTag = document.createElement('script')
        scriptTag.src = chrome.runtime.getURL("js/whalevault.js");
        var container = document.head || document.documentElement
        container.insertBefore(scriptTag, container.children[0])
    } catch (e) {
        console.error('WhaleVault injection failed', e)
    }
}
setupInjection();

// Answering the handshakes
document.addEventListener('wvHandshake', function(request) {
    var response = request.detail;
    response.name = chrome.runtime.getManifest().name;
    response.version = chrome.runtime.getManifest().version;
    if (request.detail.extension)
      chrome.runtime.sendMessage(request.detail.extension, response); else
        window.postMessage({ type: "wvHandshake", response });
});

// Answering the requests
document.addEventListener('wvRequest', function(request) {
    var req = request.detail;
    // If all information are filled, send the request to the background, if not notify an error
    
    //var domain = req.extensionName || window.location.hostname;  <-- req.extensionName possible attack vector???
    var domain = window.location.hostname;
    if (domain == '127.0.0.1') domain = 'localhost';
    if (!["", "80", "443"].includes(window.location.port)) domain += ":"+window.location.port;

    if (req.username) {
        req.username = req.username.toLowerCase();
        if (!req.username.includes(":")) req.username = "stm:" + req.username;
    }
    if (req.appid) req.appid = req.appid.substring(0,25).replace(/ /g,'');
    if (req.reason) req.reason = req.reason.substring(0,25).replace(/ /g,'');
    if (domain.includes('localhost') && req.appid) domain += ":"+escapeHtml(req.appid);
    req.domain = domain;

    if (validate(req)) {
        chrome.runtime.sendMessage({
            command: "sendRequest",
            request: req,
            domain,
            request_id: req.request_id
        });
    } else {
        var response = {
            success: false,
            error: "incomplete",
            result: null,
            message: "Incomplete data or wrong format",
            data: req,
            request_id: req.request_id
        };
        sendResponse(response);
    }
});

// Get notification from the background upon request completion and pass it to the website.
chrome.runtime.onMessage.addListener(function(obj, sender, sendResp) {
    if (obj.command == "answerRequest") {
        sendResponse(obj.msg);
    }
});

function sendResponse(response) {
  if(response.data.extension && response.data.extensionName)
      chrome.runtime.sendMessage(response.data.extension,JSON.stringify(response)); else
        window.postMessage({ type: "wvResponse", response });
}

function validate(req) {
    return req != null && req != undefined && req.type != undefined && req.type != null && isClean(req.username) && isClean(req.appid) &&
        ((req.type == "pubkeys") ||
         (req.type == "encryptMemo" && isFilled(req.message) && isFilledKey(req.method) && isFilled(req.pubKey) && isFilled(req.memoType) && isClean(req.reason)) ||
         (req.type == "decryptMemo" && isFilled(req.message) && isFilledKey(req.method) && isClean(req.reason)) ||
         (req.type == "signBuffer" && isFilled(req.message) && isFilledKey(req.method, true) && isClean(req.reason) && isClean(req.sigType)));
}


// Functions used to check the incoming data

function hasTransferInfo(req){
  if (req.enforce)
    return isFilled(req.username);
  else if(isFilled(req.memo)&&req.memo[0]=="#")
    return isFilled(req.username);
  else
    return true;
}

function escapeHtml(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
}

// reject potentially malicious input 
function isClean(obj) {
    return obj != undefined && obj != null && obj != "" && obj == escapeHtml(obj);
}

function isFilled(obj) {
    return obj != undefined && obj != null && obj != "";
}

function isFilledDelegationMethod(obj){
  return obj=="VESTS"||obj=="SP";
}
function isFilledJSON(obj) {
    try {
        return isFilled(obj) && JSON.parse(obj).hasOwnProperty("requiredAuths") && JSON.parse(obj).hasOwnProperty("requiredPostingAuths") && JSON.parse(obj).hasOwnProperty("id") && JSON.parse(obj).hasOwnProperty("json");
    } catch (e) {
        return false;
    }
}

function isFilledAmt(obj) {
    return isFilled(obj) && !isNaN(obj) && obj > 0 && countDecimals(obj) == 3;
}

function isFilledAmtSP(obj) {
    return isFilled(obj.amount) && !isNaN(obj.amount) && ((countDecimals(obj.amount) == 3&&obj.unit=="SP")||(countDecimals(obj.amount)==6&&obj.unit=="VESTS"));
}

function isFilledWeight(obj) {
    return isFilled(obj) && !isNaN(obj) && obj >= -10000 && obj <= 10000 && countDecimals(obj) == 0;
}

function isFilledKey(obj, allKeys) {
    return isFilled(obj) && (obj == "Memo" || obj == "Active" || obj == "Posting" || (allKeys && obj == "Owner"));
}

function countDecimals(nb) {
    return nb.toString().split(".")[1] == undefined ? 0 : (nb.toString().split(".")[1].length || 0);
}
