
var Memento = {

    aggregatorUrl: "http://mementoproxy.lanl.gov/aggr/timegate/",
    shouldProcessEmbeddedResources: false,
    isMementoActive: false,
    mementoDatetime: false,
    isNativeMemento: false,
    acceptDatetime: {},
    timegateUrl: false,
    originalUrl: false,
    mementoUrl: false,
    mementoBaseUrl: false,

    parseLinkHeader : function(link) {
        var state = 'start';
        var data = link.split('');
        var uri = '';
        var pt = '';
        var pv = '';
        var d = '';

        var links = {};
        while (data.length) {
            if (state == 'start') {
                d = data.shift();
                while (d.match(/\s/)) d = data.shift();
                if (d != "<") break;
                state = "uri";
            } else if (state == "uri") {
                uri = '';
                d = data.shift();
                while (d != ">") {
                    uri += d;
                    d = data.shift();
                }

                // Check for broken header with a > in the URL
                uritmp = '>';
                d = data.shift();
                while (d.match(/\s/)) {
                    uritmp += d;
                    d = data.shift();
                }
                // Now d is the first non space character, and should be either , or ;
                if (d == ',' || d ==';'){
                    // We're okay
                    links[uri] = {};
                    state = "paramstart";
                } else{
                	// stay in state uri, and continue to append
                    uritmp+=d;
                    uri += uritmp;
                }
                
            } else if (state == 'paramstart') {
                while (d.match(/\s/) != null) d = data.shift();
                if (d == ";") state = 'linkparam';
                else if (d == ',') state = 'start';
                else break
            } else if (state == 'linkparam') {
                d = data.shift();
                while (d.match(/\s/) != null) d = data.shift();
                pt = '';
                while (data.length && d != ' ' && d != '=') {
                    pt += d;
                    d = data.shift();
                }
                while (d.match(/\s/) != null) d = data.shift();
                if (d != "=") break
                state='linkvalue';
                if (links[uri][pt] == undefined) {
                    links[uri][pt] = new Array();
                }
            } else if (state == 'linkvalue') {
                d = data.shift();
                while (d.match(/\s/) != null) d = data.shift();
                pv = '';
                if (d == '"') {
                    pd = d;
                    d = data.shift();
                    while (d != undefined && d != '"' && pd != '\\') {
                        pv += d;
                        pd = d;
                        d = data.shift();
                    }
                } else {
                    while (d != undefined && d != " " && d != ',' && d != ';') {
                        pv += d;
                        d = data.shift();
                    }
                    if (data.length) data.unshift(d);
                }
                state = 'paramstart';
                if(data != undefined){
                    d = data.shift();
                }
                if (pt == 'rel') links[uri][pt] = links[uri][pt].concat(pv.split(' '));
                else links[uri][pt].push(pv);
            }
        }
        return links;
    },

    getUriForRel : function(lhash, rel) {
    	for (var uri in lhash) {
        	params = lhash[uri];
            vals = lhash[uri]['rel'];
            if (vals != undefined) {
                for (var v=0, val; val= vals[v]; v++) {
                    if (val == rel) {
                        return uri;
                    }
                }
            }
        }
        return null;
    },

    getLinkHeader: function(headers) {
        if (typeof(headers) == "object") {
            for (var i=0, h; h=headers[i]; i++) {
                if (h.name.toLowerCase() == "link") {
                    return h.value
                }
            }
        }
        else if (typeof(headers) == "string"){
            var headerLines = headers.split("\n")
            for (header in headerLines) {
                var linkParts = headerLines[header].split(':')
                if (linkParts[0].trim().toLowerCase() == "link") {
                    return linkParts.slice(1, linkParts.length).join(":")
                }
            }
        }
        return false
    },

    getRelUriFromHeaders: function(headers, rel) {
        var linkHeader = Memento.getLinkHeader(headers)
        var relUrl = false
        if (linkHeader != "") {
            var links = Memento.parseLinkHeader(linkHeader.trim())
            relUrl = Memento.getUriForRel(links, rel)
        }
        return relUrl
    },

    ajax: function(uri, method) {
        return $.ajax({
            type: method,
            url: uri,
            async: false,
            success: function(data) {return data}
        })
    },

    pad: function(n) {
        return n < 10 ? '0'+n : n
    },

    appendAcceptDatetimeHeader: function(headers, datetime) {
        for (var i=0, h; h=headers[i]; i++) {
            if (h['name'].toLowerCase() == "accept-datetime") {
                h.pop()
                //break;
            }
        }
        headers.push({"name": "accept-datetime", "value": datetime}) 
    },

    getWhiteList: function() {
        uriWhitelist = [];
        uriWhitelist.push(new RegExp('[?&]oldid=[0-9]+(&|$)'));         // mediawiki "memento"                
        uriWhitelist.push(new RegExp('(bits|upload)\\.wikimedia\\.org')); // wikipedia bits
        uriWhitelist.push(new RegExp('google-analytics\\.com')); // everywhere, just ignore
        uriWhitelist.push(new RegExp('webarchive\\.org\\.uk/wayback/(images|js|css)'));
        uriWhitelist.push(new RegExp('webarchive\\.org\\.uk/images/'));
        uriWhitelist.push(new RegExp('collections-r\\.europarchive\\.org/media'));
        uriWhitelist.push(new RegExp('static\\.waybackmachine\\.org'));
        uriWhitelist.push(new RegExp('staticweb\\.archive\\.org'));
        uriWhitelist.push(new RegExp('webarchive\\.nationalarchives\\.gov\\.uk/media/'));
        uriWhitelist.push(new RegExp('wayback\\.archive\\.org/web/jsp/'))
        uriWhitelist.push(new RegExp('webarchive.loc.gov/lcwa.+?/images/[^/]+'))

        // Mementos, but no structure in URI
        uriWhitelist.push(new RegExp('webarchives\\.cdlib\\.org/'));
        uriWhitelist.push(new RegExp('diigo\\.com/cached/showpage/crawler'));
        uriWhitelist.push(new RegExp('s3\\.amazonaws\\.com/diigo/cache/'));
        uriWhitelist.push(new RegExp('thumbnails\\.domaintools\\.com/screenshots-com/'));
        uriWhitelist.push(new RegExp('webcitation\\.org/'));

        return uriWhitelist;
    },

    getBlackList: function() {
        uriBlacklist = [];
        uriBlacklist.push(new RegExp('liveweb\\.archive\\.org/')); // pulls in from live web, which we do better
        uriBlacklist.push(new RegExp('proxyinfo\\.lanl\\.gov/index\\.php\\?error')); // LANL annoying proxy/filter
        uriBlacklist.push(new RegExp('adserv\\.quality-channel\\.de')); // aggressive ad server (spiegel.de)

        return uriBlacklist;
    },

    getWayBackUris: function() {
        // These resources give X-Archive-Orig-Date which we trap in process_uri anyway 
        // ... but do not give X- headers for redirects

        waybackUris = []
        waybackUris.push(new RegExp('\\.wstub\\.archive\\.org/'));
        waybackUris.push(new RegExp('wayback\\.archive-it\\.org/[0-9]+/[0-9]+'));
        //waybackUris.push(new RegExp('webarchive\\.org\\.uk/wayback/archive/[0-9]+'));
        waybackUris.push(new RegExp('web\\.archive\\.org/web/[0-9]+'));
        waybackUris.push(new RegExp('wayback\\.archive\\.org/web/[0-9]+'));
        waybackUris.push(new RegExp('webarchive\\.loc\\.gov/lcwa[0-9]+/[0-9]+'));
        waybackUris.push(new RegExp('nara-wayback-001\\.us\\.archive\\.org/[^/]+/[0-9]+'));

        // URI structure is like Wayback, but no X-Archive- headers
        waybackUris.push(new RegExp('webarchive\\.nationalarchives\\.gov\\.uk/[0-9]+'));
        waybackUris.push(new RegExp('enterprise\\.archiefweb\\.eu/archives/archiefweb/[0-9]+'));   
        waybackUris.push(new RegExp('collectionscanada\\.gc\\.ca/webarchives/[0-9]+'));
        
        return waybackUris; 
    },

    getRewrittenUriArchives: function() {
        var waybackUris = Memento.getWayBackUris()
        waybackUris.push(new RegExp('mementoproxy\\.lanl\\.gov/aggr/timegate/'));
        waybackUris.push(new RegExp('web\\.archive\\.org/web/'));
        return waybackUris
    },

    clearCache: function() {
        console.log("clearing cache")
        chrome.webRequest.handlerBehaviorChanged()
    }

}

var mementoCallback = null;

var Menu = {
    menuId: 0,
    tabId: 0,

    contexts: ["page", "link", "image", "video", "audio"],
    contextUrlLabel: ["linkUrl", "srcUrl", "frameUrl", "pageUrl"],
    originalUrl: "",
    readableAcceptDatetime: "",
    isDatetimeModified: false,
    originalMenuIds: [],
    mementoMenuIds: [],

    handleContextMenuClick: function(info, tab) {
        var clickedUrl = ""
        var pageUrl = false
        for (var i in Menu.contextUrlLabel) {
            if (info[Menu.contextUrlLabel[i]] != undefined) {
                clickedUrl = info[Menu.contextUrlLabel[i]]
                pageUrl = (Menu.contextUrlLabel[i] == "pageUrl") ? true : false
                break
            }
        }
        if (clickedUrl == "") {
            console.log("ERROR: Unxpected behaviour; Could not determine URL clicked.")
            return
        }
        console.log(clickedUrl)
        
        var clickedForOriginal = false
        var clickedForMemento = false

        for (var i=0, id; id=Menu.originalMenuIds[i]; i++) {
            if (info['menuItemId'] == id) {
                clickedForOriginal = true
                break
            }
        }
        for (var i=0, id; id=Menu.mementoMenuIds[i]; i++) {
            if (info['menuItemId'] == id) {
                clickedForMemento = true
                break
            }
        }
        if (clickedForOriginal) {
            var orgUrl = ""
            if (pageUrl) {
                /*
                var links = Memento.parseLinkHeader(Memento.linkHeaderForThisResource.trim())
                var orgUrl = Memento.getUriForRel(links, "original")
                if (orgUrl == "") {
                    orgUrl = Memento.aggregatorUrl + clickedUrl;
                }
                */
                orgUrl = Memento.originalUrl
            }
            else {
                var headResponse = Memento.ajax(clickedUrl, "HEAD")
                orgUrl = Memento.getRelUriFromHeaders(headResponse.getAllResponseHeaders(), "original")
            }
            if (orgUrl == "") {
                orgUrl = clickedUrl
            }
            
            Memento.mementoDatetime = false
            Memento.isMementoActive = false
            Memento.shouldProcessEmbeddedResources = false
            chrome.tabs.update(tab.tabId, {url: orgUrl})
            return
        }
        else if (clickedForMemento) {
            var tgUrl = ""
            if (pageUrl) {
                //var links = Memento.parseLinkHeader(Memento.linkHeaderForThisResource.trim())
                //tgUrl = Memento.getUriForRel(links, "timegate")
                tgUrl = Memento.timegateUrl
            }
            if (tgUrl == "" || tgUrl == null) {
                var headResponse = Memento.ajax(clickedUrl, "HEAD")
                tgUrl = Memento.getRelUriFromHeaders(headResponse.getAllResponseHeaders(), "timegate")
                if (!tgUrl) {
                    tgUrl = Memento.aggregatorUrl + clickedUrl
                }
            }
            /*
            var list = Memento.getRewrittenUriArchives()
            var shouldClearCache = true
            console.log(tgUrl)
            for (var i=0, regex; regex=list[i]; i++) {
                if (tgUrl.match(regex)) {
                    console.log("matched")
                    shouldClearCache = false;
                    break;
                }
            }
            */
            window.setTimeout(Memento.clearCache(), 2000)
            Memento.isMementoActive = true
            Memento.shouldProcessEmbeddedResources = true
            Menu.isDatetimeModified = false
            chrome.tabs.update(tab.tabId, {url: tgUrl})
            return
        }

    },

    setReadableAcceptDatetime: function(callback) {
        chrome.storage.local.get("accept-datetime-readable", function(items) {
            Menu.readableAcceptDatetime = items["accept-datetime-readable"]        
            Memento.acceptDatetime = new Date(Menu.readableAcceptDatetime)
            if (callback) {
                callback()
            }
        })
    },

    createContextMenuEntry: function(title, context, enabled, targetUrl) {
        if (targetUrl == undefined || targetUrl == null) 
            targetUrl = ["<all_urls>"]

        var id = chrome.contextMenus.create({
            "title": title,
            "type": "normal",
            "contexts": context,
            "enabled": enabled,
            //"documentUrlPatterns": targetUrl,
            "targetUrlPatterns": targetUrl
        })
        return id
    },

    updateContextMenu: function() {
        var title = ""
        

        for (var i=0, c; c=Menu.contexts[i]; i++) {
            t = []
            if (c == "page") {
                var title = "Load this resource at current time"
                var enabled = false
                t.push(c)
                if (Memento.mementoDatetime || Menu.isDatetimeModified) {
                    enabled = true
                }
                console.log("MENU: current enabled: " + enabled)
                Menu.originalMenuIds.push(Menu.createContextMenuEntry(title, t, enabled))

                title = "Load this resource at " + Menu.readableAcceptDatetime
                enabled = false
                if (!Memento.mementoDatetime || Menu.isDatetimeModified) {
                    enabled = true
                }
                console.log("MENU: memento enabled: " + enabled)
                Menu.mementoMenuIds.push(Menu.createContextMenuEntry(title, t, enabled))
            }
            else {
                var title = "Load this resource at current time"
                var enabled = false
                if (Memento.mementoDatetime) {
                    enabled = true
                }
                t.push(c)
                Menu.originalMenuIds.push(Menu.createContextMenuEntry(title, t, enabled))

                title = "Load this resource at " + Menu.readableAcceptDatetime
                enabled = true
                Menu.mementoMenuIds.push(Menu.createContextMenuEntry(title, t, enabled))

                /*
                enabled = true
                for (url in Memento.hrefDatetime) {
                    targetUrl = []
                    if (Memento.hrefDatetime[url] != 0) {
                        targetUrl.push(url)
                        if (targetUrl.length <= 0)
                            enabled = false
                        title = "Get memento for " + Memento.hrefDatetime[url]

                        Menu.mementoMenuIds.push(Menu.createContextMenuEntry(title, t, enabled, targetUrl))
                    }
                }
                */
            }
        }
    },

    update: function() {
        chrome.contextMenus.removeAll()
        if (Menu.readableAcceptDatetime == null || Menu.readableAcceptDatetime == "") {
            Menu.setReadableAcceptDatetime()
        }
        if (!Menu.readableAcceptDatetime) {
            Menu.init()
            return
        }
        Menu.updateContextMenu()
    },

    init: function() {
        title = "Click Memento icon to select date-time"
        this.menuId = chrome.contextMenus.create({
            "title": title,
            "contexts": this.contexts,
            "enabled": false
        })
        chrome.contextMenus.onClicked.addListener(Menu.handleContextMenuClick)
    }
}

Menu.update()

requestIds = []

chrome.webRequest.onBeforeRequest.addListener( function(request) {
    for (var i=0, r; r=requestIds[i]; i++) {
        if (request.requestId == r) {
            return
        }
    }
    requestIds.push(request.requestId)
    
    /* 
     * processing embedded resources. 
     */
    if (request.type != "main_frame" 
            && Memento.shouldProcessEmbeddedResources 
            && request.url.search("chrome-extension://") < 0) {
        
        /*
         * Testing for re-written embedded urls by comparing the base url of 
         * the memento with the url of the embedded resource. The 
         * embedded resources will have the same host if it's rewritten.
         */
        if (request.url.search(Memento.mementoBaseUrl) == 0) {
            Memento.shouldProcessEmbeddedResources = false
            return
        }
        var embedResponse = Memento.ajax(request.url, "HEAD")
        var tgUrl = Memento.getRelUriFromHeaders(embedResponse.getAllResponseHeaders(), "timegate")
        if (!tgUrl) {
            tgUrl = Memento.aggregatorUrl + request.url
        }
        console.log("intercepted "+request.url + " redirecting to " + tgUrl)
        return {redirectUrl: tgUrl}
    }
    else if (request.type == "main_frame") {
        console.log("MEMENTO: resetting all the flags")
        requestIds = []
        Memento.timegateUrl = false
        Memento.originalUrl = false
        Memento.mementoDatetime = false
        Memento.mementoUrl = false
        Memento.isNativeMemento = false
        Memento.shouldProcessEmbeddedResources = false
    }
},
{urls: ["<all_urls>"]},
["blocking"])


chrome.webRequest.onBeforeSendHeaders.addListener( function(request) {
    
    if (Memento.isMementoActive) {
        console.log("MEMENTO: setting accept-datetime header")
        Memento.appendAcceptDatetimeHeader(request.requestHeaders, Memento.acceptDatetime.toGMTString())
        return {requestHeaders: request.requestHeaders}
    }
},
{urls: ["http://*/*"]},
["blocking", "requestHeaders"])

chrome.webRequest.MAX_HANDLER_BEHAVIOR_CHANGED_CALLS_PER_10_MINUTES = 100

chrome.webRequest.onHeadersReceived.addListener( function(response) {
    if (response.type == "main_frame") {
        /* 
         * checking for 2 possibilities: original or memento
         */
        Memento.timegateUrl = Memento.getRelUriFromHeaders(response.responseHeaders, "timegate")
        Memento.originalUrl = Memento.getRelUriFromHeaders(response.responseHeaders, "original")
        
        /* 
         * checking if this is a native memento resource
         * the "memento-datetime" header confirms this
         */
        for (var i=0, h; h=response.responseHeaders[i]; i++) {
            if (h.name.toLowerCase() == "memento-datetime") {
                console.log("MEMENTO: mem-dt found")
                console.log(response.responseHeaders)
                Memento.mementoDatetime = h.value
                Memento.isNativeMemento = true
                Memento.shouldProcessEmbeddedResources = true
                Memento.isMementoActive = true
                Memento.mementoUrl = response.url

                /* 
                 * setting base url of the memento
                 * will be used to determine if the embedded resources are processed.
                 */
                var protocol = ""
                if (Memento.mementoUrl.slice(0,7) == "http://") {
                    protocol = "http://"
                }
                else if (Memento.mementoUrl.slice(0,8) == "https://") {
                    protocol = "https://"
                }
                baseUrl = Memento.mementoUrl.replace(protocol, "")
                Memento.mementoBaseUrl = protocol + baseUrl.split("/")[0]

                Menu.update()
                return
            }
        }

        /* 
         * checking for non-native memento resources. 
         * setting psuedo memento datetime header
         */
        if (Memento.isMementoActive) {
            Memento.mementoDatetime = Memento.acceptDatetime.toGMTString()
            Memento.shouldProcessEmbeddedResources = false
            Memento.mementoUrl = response.url
        }

        if (!Memento.originalUrl) {
            Memento.originalUrl = response.url
        }
        if (!Memento.timegateUrl) {
            Memento.timegateUrl = Memento.aggregatorUrl + Memento.originalUrl
        }
        console.log("MEMENTO: " + Memento.originalUrl, Memento.timegateUrl)
        Menu.update()
    }
},
{urls: ["<all_urls>"]},
["responseHeaders"])

chrome.storage.onChanged.addListener( function(changes, namespace) {
    Menu.readableAcceptDatetime = changes['accept-datetime-readable']['newValue']
    Memento.acceptDatetime = new Date(Menu.readableAcceptDatetime)
    if (Memento.mementoDatetime) {
        console.log("MENU: dt modified...")
        Menu.isDatetimeModified = true
    }
    Menu.update()
})

chrome.runtime.onInstalled.addListener(function(details) {
    chrome.contextMenus.removeAll()
    Menu.init()
})

/*
chrome.runtime.onMessage.addListener( function(request, sender, sendResponse) {
    Memento.hrefDatetime = request.hrefDatetime
    Menu.update()
})
*/
