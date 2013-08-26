
Memento.prototype = {

    aggregatorUrl: "http://mementoproxy.lanl.gov/aggr/timegate/",
    shouldProcessEmbeddedResources: false,
    isMementoActive: false,
    mementoDatetime: false,
    acceptDatetime: false,
    timegateUrl: false,
    originalUrl: false,
    mementoUrl: false,
    mementoBaseUrl: false,
    isPsuedoMemento: false,
    clickedOriginalUrl: false,
    lastMementoUrl: false,
    specialDatetime: false,
    
    // MENU Variables
    menuId: 0,
    contexts: ["page", "link", "image", "video", "audio"],
    contextUrlLabel: ["linkUrl", "srcUrl", "frameUrl", "pageUrl"],
    readableAcceptDatetime: "",
    isDatetimeModified: false,
    visitedUrls: {},
    originalMenuIds: [],
    mementoMenuIds: [],
    lastMementoMenuIds: [],
    mementoDatetimeMenuIds: [],



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
        var linkHeader = this.getLinkHeader(headers)
        var relUrl = false
        if (linkHeader != "") {
            var links = this.parseLinkHeader(linkHeader.trim())
            relUrl = this.getUriForRel(links, rel)
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
        uriWhitelist.push(new RegExp('google-analytics\\.com')); // everywhere, just ignore

        return uriWhitelist;
    },

    clearCache: function() {
        chrome.webRequest.handlerBehaviorChanged()
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
        

        for (var i=0, c; c=this.contexts[i]; i++) {
            t = []
            if (c == "page") {
                // MEMENTO DATETIME
                var title = ""
                if (mem.mementoDatetime) {
                    title = "Memento Datetime: " + mem.mementoDatetime
                }
                else {
                    title = "This is resource at current time"
                }
                var enabled = false
                t.push(c)
                this.mementoDatetimeMenuIds.push(this.createContextMenuEntry(title, t, enabled))

                // CURRENT TIME
                var title = "Load this resource at current time"
                var enabled = false
                t.push(c)
                if (this.mementoDatetime || this.datetimeModified) {
                    enabled = true
                }
                this.originalMenuIds.push(this.createContextMenuEntry(title, t, enabled))

                // SELECTED MEMENTO DATETIME
                title = "Load this resource at " + this.readableAcceptDatetime
                enabled = false
                if (!this.mementoDatetime || this.isDatetimeModified || this.specialDatetime) {
                    enabled = true
                }
                this.mementoMenuIds.push(this.createContextMenuEntry(title, t, enabled))

                // LAST MEMENTO
                title = "Load latest archived version"
                enabled = true
                if (this.specialDatetime) {
                    enabled = false
                }
                this.lastMementoMenuIds.push(this.createContextMenuEntry(title, t, enabled))
            }
            else {
                // CURRENT TIME
                var title = "Load this resource at current time"
                var enabled = false
                if (this.mementoDatetime) {
                    enabled = true
                }
                t.push(c)
                this.originalMenuIds.push(this.createContextMenuEntry(title, t, enabled))

                // SELECTED MEMENTO DATETIME
                title = "Load this resource at " + this.readableAcceptDatetime
                enabled = true
                this.mementoMenuIds.push(this.createContextMenuEntry(title, t, enabled))

                // LAST MEMENTO
                title = "Load latest archived version"
                enabled = true
                this.lastMementoMenuIds.push(this.createContextMenuEntry(title, t, enabled))
            }
        }
    },

    update: function() {
        chrome.contextMenus.removeAll()
        if (!this.readableAcceptDatetime) {
            this.init()
            return
        }
        this.originalMenuIds = []
        this.mementoMenuIds = []
        this.lastMementoMenuIds = []
        this.mementoDatetimeMenuIds = []
        this.updateContextMenu()
    },

    init: function() {
        title = "Click Memento icon to select date-time"
        this.menuId = chrome.contextMenus.create({
            "title": title,
            "contexts": Memento.contexts,
            "enabled": false
        })
    }
}


Extension.prototype = {

    getTabId: function() {
        return tId
    },

    getMementoObject: function() {
        return mem
    },

    handleContextMenuClick: function(info, tab) {
        var clickedUrl = ""
        var pageUrl = false
        for (var i in mem.contextUrlLabel) {
            if (info[mem.contextUrlLabel[i]] != undefined) {
                clickedUrl = info[mem.contextUrlLabel[i]]
                pageUrl = (mem.contextUrlLabel[i] == "pageUrl") ? true : false
                break
            }
        }
        if (clickedUrl == "") {
            console.log("ERROR: Unxpected behaviour; Could not determine URL clicked.")
            console.log(info)
            return
        }
        //console.log(clickedUrl)

        var clickedForOriginal = false
        var clickedForMemento = false
        var clickedForLastMemento = false
        mem.specialDatetime = false

        console.log("clicked url: " + clickedUrl)

        for (var i=0, id; id=mem.originalMenuIds[i]; i++) {
            if (info['menuItemId'] == id) {
                clickedForOriginal = true
                break
            }
        }
        for (var i=0, id; id=mem.mementoMenuIds[i]; i++) {
            if (info['menuItemId'] == id) {
                clickedForMemento = true
                break
            }
        }
        for (var i=0, id; id=mem.lastMementoMenuIds[i]; i++) {
            if (info['menuItemId'] == id) {
                clickedForLastMemento = true
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
                orgUrl = mem.originalUrl
            }
            else {
                var headResponse = mem.ajax(clickedUrl, "HEAD")
                orgUrl = mem.getRelUriFromHeaders(headResponse.getAllResponseHeaders(), "original")
            }
            if (orgUrl == "") {
                for (i in mem.visitedUrls) {
                    if (i == clickedUrl) {
                        orgUrl = mem.visitedUrls[i]
                        break
                    }
                }
            }
            if (orgUrl == "" && mem.isMementoActive) {
                if (clickedUrl.lastIndexOf("http://") > 0) {
                    orgUrl = clickedUrl.substring(clickedUrl.lastIndexOf("http://"))
                }
            }
            else if (orgUrl == "") {
                orgUrl = clickedUrl
            }

            mem.mementoDatetime = false
            mem.isMementoActive = false
            mem.shouldProcessEmbeddedResources = false
            chrome.tabs.update(tab.id, {url: orgUrl})
            return
        }
        else if (clickedForMemento) {
            var tgUrl = ""
            mem.clickedOriginalUrl = clickedUrl
            if (pageUrl) {
                tgUrl = mem.timegateUrl
            }
            if (tgUrl == "" || tgUrl == null) {
                var headResponse = mem.ajax(clickedUrl, "HEAD")
                tgUrl = mem.getRelUriFromHeaders(headResponse.getAllResponseHeaders(), "timegate")
                if (!tgUrl) {
                    tgUrl = mem.aggregatorUrl + clickedUrl
                    mem.isPsuedoMemento = true
                }
            }
            window.setTimeout(mem.clearCache(), 2000)
            mem.isMementoActive = true
            mem.shouldProcessEmbeddedResources = true
            mem.isDatetimeModified = false
            chrome.tabs.update(tab.id, {url: tgUrl})
            return
        }
        else if (clickedForLastMemento) {
            var lastMemento = ""
            if (!mem.isMementoActive) {
                mem.clickedOriginalUrl = clickedUrl
            }
            if (pageUrl) {
                lastMemento = mem.lastMementoUrl
            }
            if (lastMemento == "" || lastMemento == null) {
                var headResponse = mem.ajax(clickedUrl, "HEAD")
                // if no last mem url is cached, we go to the timegate with out accept-datetime header
                // by the protocol, the tg shd redirect us to the most recent memento
                lastMemento = mem.getRelUriFromHeaders(headResponse.getAllResponseHeaders(), "timegate")
                if (!lastMemento) {
                    lastMemento = mem.aggregatorUrl + clickedUrl
                    mem.isPsuedoMemento = true
                }
            }
            window.setTimeout(mem.clearCache(), 2000)
            mem.isMementoActive = true
            mem.shouldProcessEmbeddedResources = true
            mem.isDatetimeModified = false 
            mem.specialDatetime = new Date()
            chrome.tabs.update(tab.id, {url: lastMemento})
            return
        }
    },

    init: function() {

        chrome.webRequest.onBeforeRequest.addListener( function(request) {
            if (extensionTabs[request.tabId] == undefined) {
                return
            }
            for (var i=0, r; r=requestIds[i]; i++) {
                if (request.requestId == r) {
                    return
                }
            }
            requestIds.push(request.requestId)

            // not doing memento for known uris that does not have mementos or
            // does not need memento processing.
            var whiteList = mem.getWhiteList()
            for (var i=0, r; r=whiteList[i]; i++) {
                if (request.url.match(r)) {
                    return
                }
            }

            /* 
            * processing embedded resources. 
            */
            if (request.type != "main_frame" 
                && mem.shouldProcessEmbeddedResources
                && request.url.search("chrome-extension://") < 0) {

                    /*
                    * Testing for re-written embedded urls by comparing the base url of 
                    * the memento with the url of the embedded resource. The 
                    * embedded resources will have the same host if it's rewritten.
                    */
                    if (request.url.search(mem.mementoBaseUrl) == 0) {
                        mem.shouldProcessEmbeddedResources = false
                        return
                    }
                    var embedResponse = mem.ajax(request.url, "HEAD")
                    var tgUrl = mem.getRelUriFromHeaders(embedResponse.getAllResponseHeaders(), "timegate")
                    
                    // looking for "do not negotiate" resources
                    if (!tgUrl) {
                        var doNotNeg = mem.getRelUriFromHeaders(embedResponse.getAllResponseHeaders(), "type")
                        if (doNotNeg) {
                            return
                        }
                        tgUrl = mem.aggregatorUrl + request.url
                    }
                    return {redirectUrl: tgUrl}
            }
            else if (request.type == "main_frame") {
                requestIds = []
                mem.timegateUrl = false
                mem.originalUrl = false
                mem.mementoDatetime = false
                mem.mementoUrl = false
                mem.shouldProcessEmbeddedResources = false
                mem.lastMementoUrl = false
            }
        },
        {urls: ["<all_urls>"],tabId: tId},
        ["blocking"])

        
        chrome.webRequest.onBeforeSendHeaders.addListener( function(request) {
            if (mem.isMementoActive) {
                var aDt = {}
                if (mem.specialDatetime) {
                    aDt = mem.specialDatetime
                }
                else {
                    aDt = mem.acceptDatetime
                }
                if (aDt) {
                    mem.appendAcceptDatetimeHeader(request.requestHeaders, aDt.toGMTString())
                }
                return {requestHeaders: request.requestHeaders}
            }
        },
        {urls: ["http://*/*"], tabId: tId},
        ["blocking", "requestHeaders"])

        chrome.webRequest.MAX_HANDLER_BEHAVIOR_CHANGED_CALLS_PER_10_MINUTES = 100

        chrome.webRequest.onHeadersReceived.addListener( function(response) {
            if (response.type != "main_frame") {
                return
            }
            if (response.statusLine.search("HTTP/1.1 30") == 0) {
                mem.lastMementoUrl = mem.getRelUriFromHeaders(response.responseHeaders, "last")    
                return
            }

            mem.timegateUrl = mem.getRelUriFromHeaders(response.responseHeaders, "timegate")
            mem.originalUrl = mem.getRelUriFromHeaders(response.responseHeaders, "original")

            /* 
            * checking if this is a native memento resource
            * the "memento-datetime" header confirms this
            */
            for (var i=0, h; h=response.responseHeaders[i]; i++) {
                if (h.name.toLowerCase() == "memento-datetime") {
                    mem.mementoDatetime = h.value
                    mem.shouldProcessEmbeddedResources = true
                    mem.isMementoActive = true
                    mem.mementoUrl = response.url
                    mem.visitedUrls[mem.mementoUrl] = mem.originalUrl
                    /* 
                    * setting base url of the memento
                    * will be used to determine if the embedded resources are processed.
                    */
                    var protocol = ""
                    if (mem.mementoUrl.slice(0,7) == "http://") {
                        protocol = "http://"
                    }
                    else if (mem.mementoUrl.slice(0,8) == "https://") {
                        protocol = "https://"
                    }
                    baseUrl = mem.mementoUrl.replace(protocol, "")
                    mem.mementoBaseUrl = protocol + baseUrl.split("/")[0]

                    mem.update()
                    return
                }
            }

            console.log("Timegate URL: " + mem.timegateUrl)

            /* 
            * checking for non-native memento resources. 
            * setting psuedo memento datetime header
            */
            if (mem.isMementoActive && mem.isPsuedoMemento) {
                var aDt = ""
                if (mem.specialDatetime) {
                    aDt = specialDatetime
                }
                else {
                    aDt = mem.acceptDatetime
                }
                if (aDt) {
                    mem.mementoDatetime = aDt.toGMTString()
                }
                mem.shouldProcessEmbeddedResources = false
                mem.mementoUrl = response.url
                mem.visitedUrls[mem.mementoUrl] = mem.clickedOriginalUrl
            }
            mem.update()
        },
        {urls: ["<all_urls>"], tabId: tId},
        ["responseHeaders"])

        chrome.webNavigation.onCommitted.addListener( function(details) {
            if (details.transitionQualifiers == "forward_back" || 
                details.transitionQualifiers == "from_address_bar" || 
                details.transitionType == "typed" ||
                details.transitionType == "link") {
                
                var isVisitedMementoUrl = false

                for (i in mem.visitedUrls) {
                    if (i == details.url) {
                        isVisitedMementoUrl = true
                        mem.isMementoActive = true
                    }
                }
                if (!isVisitedMementoUrl) {
                    mem.isMementoActive = false
                }
                mem.update()
            }
            else if (details.transitionType == "reload") {
                mem.clearCache()
            }
        })

        chrome.webRequest.onCompleted.addListener( function(details) {
            if (mem.isPsuedoMemento && details.type == "main_frame" && (details.statusCode < 300 || details.statusCode > 399)) {
                mem.isPsuedoMemento = false
            }
        },
        {urls: ["<all_urls>"], tabId: tId})
 
        chrome.storage.onChanged.addListener( function(changes, namespace) {
            mem.readableAcceptDatetime = changes['accept-datetime-readable']['newValue']
            mem.acceptDatetime = new Date(mem.readableAcceptDatetime)
            if (mem.mementoDatetime) {
                mem.isDatetimeModified = true
            }
            mem.update()
        })

        chrome.storage.local.get("accept-datetime-readable", function(items) {
            mem.readableAcceptDatetime = items["accept-datetime-readable"]
            mem.acceptDatetime = new Date(mem.readableAcceptDatetime)
        })

        chrome.runtime.onInstalled.addListener(function(details) {
            chrome.contextMenus.removeAll()
            mem.init()
        })
        chrome.contextMenus.onClicked.addListener(this.handleContextMenuClick)
    }
}

function Memento() {}

function Extension(tabId) {
    requestIds = []
    tId = tabId
    mem = new Memento()
}

var extensionTabs = {}

chrome.tabs.onCreated.addListener( function(tab) {
    extensionTabs[tab.id] = new Extension(tab.id)
    extensionTabs[tab.id].init()
})

function deregisterEventHandlers() {
    chrome.storage.onChanged.removeListener( function() {})
    chrome.webRequest.onBeforeRequest.removeListener( function() {})
    chrome.webRequest.onBeforeSendHeaders.removeListener( function() {})
    chrome.webRequest.onHeadersReceived.removeListener( function() {})
}
