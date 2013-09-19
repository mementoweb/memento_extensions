function MementoHttpRequest() {}

MementoHttpRequest.prototype = {
    doHttp: function(uri, calendarDatetime, setAcceptDatetime, callback) {
        var hdrs = {}
        if (setAcceptDatetime) {
            hdrs = {'Accept-Datetime': calendarDatetime.toGMTString()}
        }
        $.ajax({
            type: "HEAD",
            url: uri,
            headers: hdrs,
            async: true,
            success: function(data, textStatus, jqXHR) {
                callback(jqXHR)
            },
            error: function(jqXHR, status, error) {
                callback(jqXHR)
            },
            timeout: 8000
        })
    },
}

Memento.prototype = {

    tabId: 0,
    aggregatorUrl: "http://mementoproxy.lanl.gov/aggr/timegate/",
    //wikipediaTimegate: "http://mementoproxy.lanl.gov/wiki/timegate/",
    wikipediaTemplateUrl: ".wikipedia.org/wiki/",
    wikipediaLanguageRE: new RegExp("([a-z]{0,2})\.wikipedia.org/"),
    wikipediaMementoBaseRE: new RegExp("[a-z]{0,2}\.wikipedia.org/w/index.php"),
    wikipediaOldIdRE: new RegExp("[?&]oldid=[0-9]+(&|$)"),
    wikipediaTitleRE: new RegExp('[?|&]title=' + '([^&;]+?)(&|#|;|$)'),
    shouldProcessEmbeddedResources: false,
    isMementoActive: false,
    mementoDatetime: false,
    acceptDatetime: false,
    calendarDatetime: false,
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
    contexts: ["page", "link"],
    contextUrlLabel: ["linkUrl", "srcUrl", "frameUrl", "pageUrl"],
    isDatetimeModified: false,
    visitedUrls: {},
    originalMenuIds: [],
    mementoMenuIds: [],
    lastMementoMenuIds: [],
    mementoDatetimeMenuIds: [],
    //visitedOriginalUrls: {},



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

    getHeader: function(headers, headerName) {
        if (typeof(headers) == "object") {
            for (var i=0, h; h=headers[i]; i++) {
                if (h.name.toLowerCase() == headerName.toLowerCase()) {
                    return h.value
                }
            }
        }
        else if (typeof(headers) == "string"){
            var headerLines = headers.split("\n")
            for (header in headerLines) {
                var linkParts = headerLines[header].split(':')
                if (linkParts[0].trim().toLowerCase() == headerName.toLowerCase()) {
                    return linkParts.slice(1, linkParts.length).join(":")
                }
            }
        }
        return false
    },

    getRelUriFromHeaders: function(headers, rel) {
        var linkHeader = this.getHeader(headers, "link")
        var relUrl = false
        if (linkHeader != "") {
            var links = this.parseLinkHeader(linkHeader.trim())
            relUrl = this.getUriForRel(links, rel)
        }
        return relUrl
    },

    ajax: function(uri, method, setAcceptDatetime) {
        var hdrs = {}
        if (setAcceptDatetime) {
            hdrs = {'Accept-Datetime': this.calendarDatetime.toGMTString()}
        }
        var t = $.ajax({
            type: method,
            url: uri,
            headers: hdrs,
            async: false,
            success: function(data, textStatus, jqXHR) {
                return jqXHR
            },
            error: function(jqXHR, status, error) {
                return jqXHR
            }
        })
        setTimeout( function() {
            if (t && t.readyState != 4) {
                t.abort()
            }    
        }, 8000)
        return t
    },

    appendAcceptDatetimeHeader: function(headers, datetime) {
        for (var i=0, h; h=headers[i]; i++) {
            if (h['name'].toLowerCase() == "accept-datetime") {
                h.pop()
                break;
            }
        }
        headers.push({"name": "Accept-Datetime", "value": datetime}) 
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
            "targetUrlPatterns": targetUrl
        })
        return id
    },

    updateContextMenu: function() {
        var title = ""

        for (var i=0, c; c=this.contexts[i]; i++) {
            t = []
            if (c == "page") {
                t.push(c)
                // SELECTED MEMENTO DATETIME
                title = chrome.i18n.getMessage("menuGetNearDatetimeTitle", this.calendarDatetime.toGMTString())
                enabled = true
                this.mementoMenuIds.push(this.createContextMenuEntry(title, t, enabled))

                // LAST MEMENTO
                title = chrome.i18n.getMessage("menuGetNearCurrentTitle")
                enabled = true
                this.lastMementoMenuIds.push(this.createContextMenuEntry(title, t, enabled))

                // CURRENT TIME
                title = chrome.i18n.getMessage("menuGetCurrentTitle")
                var enabled = false
                if (this.isMementoActive || this.datetimeModified || this.mementoDatetime) {
                    enabled = true
                }
                this.originalMenuIds.push(this.createContextMenuEntry(title, t, enabled))

                // MEMENTO DATETIME
                chrome.contextMenus.create({"type": "separator", "contexts": [c]})
                var title = ""
                if (this.isPsuedoMemento || this.mementoDatetime == "non-native") {
                    title = chrome.i18n.getMessage("menuGotUnknownDateTitle")
                }
                else if (this.mementoDatetime) {
                    title = chrome.i18n.getMessage("menuGotMementoDatetimeTitle", this.mementoDatetime)
                }
                else {
                    title = chrome.i18n.getMessage("menuGotCurrentTitle")
                }
                enabled = false
                this.mementoDatetimeMenuIds.push(this.createContextMenuEntry(title, t, enabled))
            }
            else if (c == "link") {
                // SELECTED MEMENTO DATETIME
                t.push(c)
                title = chrome.i18n.getMessage("menuGetNearDatetimeTitle", this.calendarDatetime.toGMTString())
                enabled = true
                this.mementoMenuIds.push(this.createContextMenuEntry(title, t, enabled))

                // LAST MEMENTO
                title = chrome.i18n.getMessage("menuGetNearCurrentTitle")
                enabled = true
                this.lastMementoMenuIds.push(this.createContextMenuEntry(title, t, enabled))

                // CURRENT TIME
                title = chrome.i18n.getMessage("menuGetCurrentTitle")
                var enabled = false
                if (this.mementoDatetime) {
                    enabled = true
                }
                this.originalMenuIds.push(this.createContextMenuEntry(title, t, enabled))
            }
        }
    },

    updateUI: function() {
        chrome.contextMenus.removeAll()
        if (!this.calendarDatetime) {
            this.init()
            return
        }
        this.originalMenuIds = []
        this.mementoMenuIds = []
        this.lastMementoMenuIds = []
        this.mementoDatetimeMenuIds = []
        this.updateContextMenu()

        if (this.mementoDatetime || this.isMementoActive) {
            this.setMementoIcon()
        }
        else {
            this.setOriginalIcon()
        }
    },

    processOriginalUrl: function (reqUrl, orgHeadResponse) {
        var orgUrl = this.getRelUriFromHeaders(orgHeadResponse, "original")
        if (!orgUrl) {
            for (i in this.visitedUrls) {
                if (i == reqUrl) {
                    orgUrl = this.visitedUrls[i]
                    break
                }
            }
        }
        if (reqUrl.search(this.wikipediaMementoBaseRE) >= 0) {
            if (reqUrl.match(this.wikipediaTitleRE)) {
                var title = reqUrl.match(this.wikipediaTitleRE)[1]
                if (title) {
                    orgUrl = "http://" + reqUrl.match(this.wikipediaLanguageRE)[1] + this.wikipediaTemplateUrl + title
                }
            }
        }
        if (!orgUrl || orgUrl == "" && this.isMementoActive) {
            if (reqUrl.lastIndexOf("http://") > 0) {
                orgUrl = reqUrl.substring(reqUrl.lastIndexOf("http://"))
            }
        }
        if (!orgUrl || orgUrl == "") {
            orgUrl = reqUrl
        }
        return orgUrl
    },

    getOriginalUrl: function(reqUrl, callback) {
        var o = callback
        var Request = MementoHttpRequest.bind(o)
        var r = new Request()
         r.doHttp(reqUrl, this.calendarDatetime, false, function(orgHeadResponse) {
            callback(orgHeadResponse.getAllResponseHeaders())
        })
    },

    processTimeGateUrl: function(orgUrl, tgHeadResponse, isTopLevelResource) {
        var tgUrl
        if (this.getHeader(tgHeadResponse, "Memento-Datetime")) {
            tgUrl = orgUrl
        }
        else {
            tgUrl = this.getRelUriFromHeaders(tgHeadResponse.getAllResponseHeaders(), "timegate")
        }
        if (!tgUrl) {
            var doNotNeg = this.getRelUriFromHeaders(tgHeadResponse.getAllResponseHeaders(), "type")
            if (doNotNeg == "http://mementoweb.org/terms/donotnegotiate") {
                tgUrl = false
            }
            else {
                tgUrl = this.userTimeGateUrl + orgUrl
                if (isTopLevelResource) {
                    this.isPsuedoMemento = true
                }
            }
        }
        return tgUrl
    },

    getTimeGateUrl: function(orgUrl, callback) {
        var tgUrl = ""
        this.isMementoActive = true

        /*
        if (orgUrl.search(this.wikipediaLanguageRE) >= 0) {
            tgUrl = this.wikipediaTimegate + orgUrl
            this.isPsuedoMemento = true
            callback(tgUrl)
            return
        }
        */

        var Request = MementoHttpRequest.bind(callback)
        var r = new Request()

        r.doHttp(orgUrl, this.calendarDatetime, true, function(tgHeadResponse) {
            callback(tgHeadResponse)
        })
    },

    getSyncTimeGateUrl: function(orgUrl, isTopLevelResource) {
        var tgUrl = ""
        this.isMementoActive = true

        /*
        if (orgUrl.search(this.wikipediaLanguageRE) >= 0) {
            tgUrl = this.wikipediaTimegate + orgUrl
            this.isPsuedoMemento = true
            return tgUrl
        }
        */
        var tgHeadResponse = this.ajax(orgUrl, "HEAD", true)
        if (this.getHeader(tgHeadResponse.getAllResponseHeaders(), "Memento-Datetime")) {
            tgUrl = orgUrl
        }
        else {
            tgUrl = this.getRelUriFromHeaders(tgHeadResponse.getAllResponseHeaders(), "timegate")
        }
        if (!tgUrl) {
            var doNotNeg = this.getRelUriFromHeaders(tgHeadResponse.getAllResponseHeaders(), "type")
            if (doNotNeg == "http://mementoweb.org/terms/donotnegotiate") {
                tgUrl = false
            }
            else {
                tgUrl = this.userTimeGateUrl + orgUrl
                if (isTopLevelResource) {
                    this.isPsuedoMemento = true
                }
            }
        }
        return tgUrl
    },

    setMementoIcon: function() {
        if (this.tabId > 0) {
            //chrome.browserAction.setIcon({tabId: this.tabId, 'path': 'img/memento_on-35x35.png'})
            chrome.browserAction.setIcon({'path': 'img/memento_on-35x35.png'})
        }
    },

    setOriginalIcon: function() {
        if (this.tabId > 0) {
            //chrome.browserAction.setIcon({tabId: this.tabId, 'path': 'img/memento-35x35.png'})
            chrome.browserAction.setIcon({'path': 'img/memento-35x35.png'})
        }
    },

    getUrlParameter: function(url, name) {
        return decodeURIComponent((new RegExp('[?|&]' + name + '=' + '([^&;]+?)(&|#|;|$)').exec(url)||[,""])[1].replace(/\+/g, '%20'))||null;
    },

    filterSearchResultUrl: function(url) {
        if (url.search("http://search.yahoo.com") == 0) {
            url = unescape(url.split("**")[1])
        }
        else if (url.search("https://www.google.com/url") == 0 
            || url.search("http://www.google.com/url") == 0) {

            url = this.getUrlParameter(url, "url")
        }
        return url
    },

    unsetMementoFlags: function() {
        this.isMementoActive = false
        this.specialDatetime = false
        this.shouldProcessEmbeddedResources = false
        this.isPsuedoMemento = false
    },

    unsetDatetimeModifiedFlags: function() {
        this.isDatetimeModified = false
    },

    setDatetimeModifiedFlags: function() {
        this.isDatetimeModified = true
    },

    setMementoFlags: function() {
        this.isMementoActive = true
        if (this.isPsuedoMemento) {
            this.shouldProcessEmbeddedResources = false
        }
        else {
            this.shouldProcessEmbeddedResources = true
        }
    },

    setAcceptDatetime: function(type) {
        if (type == "calendar") {
            this.acceptDatetime = this.calendarDatetime
        }
        else if (type == "last-memento") {
            this.acceptDatetime = new Date()
            this.specialDatetime = true
        }
    },

    unsetAcceptDatetime: function() {
        this.acceptDatetime = false
        this.specialDatetime = false
    },

    setMementoInfo: function(orgUrl, tgUrl, memUrl, memDt, memBaseUrl) {
        this.originalUrl = orgUrl
        this.timegateUrl = tgUrl
        this.mementoUrl = memUrl
        this.mementoBaseUrl = memBaseUrl

        this.mementoDatetime = memDt
        this.visitedUrls[this.mementoUrl] = this.orgUrl
    },

    unsetMementoInfo: function() {
        this.originalUrl = false
        this.timegateUrl = false
        this.mementoUrl = false
        this.mementoBaseUrl = false
        this.mementoDatetime = false
    },

    init: function() {
        var title = chrome.i18n.getMessage("menuInitDatetimeTitle")
        this.menuId = chrome.contextMenus.create({
            "title": title,
            "contexts": Memento.contexts,
            "enabled": false
        })
    }
}


MementoExtension.prototype = {
    getDatetimeFromStorage: function() {
        chrome.storage.local.get(null, function(items) {
            var mementoAcceptDatetime;
            if (items[activeTabId]) {
                mementoAcceptDatetime = items[activeTabId]["memento-accept-datetime"]
            }
            else if (items["memento-accept-datetime"]){
                mementoAcceptDatetime = items["memento-accept-datetime"]
                var val = {}
                val[activeTabId] = {'memento-accept-datetime': mementoAcceptDatetime}
                chrome.storage.local.set(val)
            }
            else {
                chrome.contextMenus.removeAll()
                extensionTabs[activeTabId].mem.init()
            }
            if (mementoAcceptDatetime) {
                extensionTabs[activeTabId].mem.calendarDatetime = new Date(mementoAcceptDatetime)
            }
            extensionTabs[activeTabId].mem.updateUI()
        })
    },

    getTimeGateFromStorage: function() {
        chrome.storage.local.get(null, function(items) {
            if (items["mementoTimeGateUrl"]) {
                extensionTabs[activeTabId].mem.userTimeGateUrl = items["mementoTimeGateUrl"]
            }  
            else {
                extensionTabs[activeTabId].mem.userTimeGateUrl = extensionTabs[activeTabId].mem.aggregatorUrl
            }
        })
    }
}

function Memento(tabId) {
    this.tabId = tabId
}

function MementoExtension(tabId) {
    this.requestIds = []
    this.mem = new Memento(tabId)
    this.getTimeGateFromStorage()
}

var extensionTabs = {}
var activeTabId = 0


/*************** Hooking to Browser Events *****************/


/*************** Context Menu On Click *****************/

chrome.contextMenus.onClicked.addListener(function(info, tab) {

    var clickedUrl = ""
    var pageUrl = false
    for (var i in extensionTabs[tab.id].mem.contextUrlLabel) {
        if (info[extensionTabs[tab.id].mem.contextUrlLabel[i]] != undefined) {
            clickedUrl = info[extensionTabs[tab.id].mem.contextUrlLabel[i]]
            pageUrl = (extensionTabs[tab.id].mem.contextUrlLabel[i] == "pageUrl") ? true : false
            break
        }
    }
    if (clickedUrl == "") {
        return
    }
    else if (clickedUrl.search("chrome://") == 0) {
        return
    }

    var clickedForOriginal = false
    var clickedForMemento = false
    var clickedForLastMemento = false
    extensionTabs[tab.id].mem.specialDatetime = false

    for (var i=0, id; id=extensionTabs[tab.id].mem.originalMenuIds[i]; i++) {
        if (info['menuItemId'] == id) {
            clickedForOriginal = true
            break
        }
    }
    for (var i=0, id; id=extensionTabs[tab.id].mem.mementoMenuIds[i]; i++) {
        if (info['menuItemId'] == id) {
            clickedForMemento = true
            break
        }
    }
    for (var i=0, id; id=extensionTabs[tab.id].mem.lastMementoMenuIds[i]; i++) {
        if (info['menuItemId'] == id) {
            clickedForLastMemento = true
            break
        }
    }
    if (clickedForOriginal) {
        extensionTabs[tab.id].mem.getOriginalUrl(clickedUrl, function(headers) {
            var orgUrl = extensionTabs[tab.id].mem.processOriginalUrl(clickedUrl, headers)
            if (pageUrl && orgUrl == clickedUrl && extensionTabs[tab.id].mem.originalUrl != null) {
                orgUrl = (extensionTabs[tab.id].mem.originalUrl.length > 0)
                ? extensionTabs[tab.id].mem.originalUrl
                : orgUrl
            }

            extensionTabs[tab.id].mem.unsetMementoFlags()
            extensionTabs[tab.id].mem.isPsuedoMemento = false
            chrome.tabs.update(tab.id, {url: orgUrl})
            return
        })

    }
    else if (clickedForMemento) {
        clickedUrl = extensionTabs[tab.id].mem.filterSearchResultUrl(clickedUrl)

        extensionTabs[tab.id].mem.getOriginalUrl(clickedUrl, function(headers) {
            var orgUrl = extensionTabs[tab.id].mem.processOriginalUrl(clickedUrl, headers)
            extensionTabs[tab.id].mem.clickedOriginalUrl = orgUrl

            var tgUrl = extensionTabs[tab.id].mem.getTimeGateUrl(orgUrl, function(headers) {
                var tgUrl = ""
                if (typeof(headers) == "string") {
                    tgUrl = headers
                }
                else {
                    tgUrl = extensionTabs[tab.id].mem.processTimeGateUrl(orgUrl, headers, true)
                }
                if (!tgUrl) {
                    // do not negotiate
                    extensionTabs[tab.id].mem.unsetMementoFlags()
                    extensionTabs[tab.id].mem.unsetDatetimeModifiedFlags()
                    chrome.tabs.update(tab.id, {url: clickedUrl})
                    return
                }
                window.setTimeout(extensionTabs[tab.id].mem.clearCache(), 2000)

                extensionTabs[tab.id].mem.setAcceptDatetime("calendar")

                extensionTabs[tab.id].mem.setMementoFlags()
                extensionTabs[tab.id].mem.unsetDatetimeModifiedFlags()
                
                chrome.tabs.update(tab.id, {url: tgUrl})
                return
            })
        })
    }
    else if (clickedForLastMemento) {
        clickedUrl = extensionTabs[tab.id].mem.filterSearchResultUrl(clickedUrl)

        extensionTabs[tab.id].mem.getOriginalUrl(clickedUrl, function(headers) {
            var orgUrl = extensionTabs[tab.id].mem.processOriginalUrl(clickedUrl, headers)
            if (!extensionTabs[tab.id].mem.isMementoActive) {
                extensionTabs[tab.id].mem.clickedOriginalUrl = orgUrl
            }
            extensionTabs[tab.id].mem.getTimeGateUrl(orgUrl, function(headers) {
                var lastMemento = ""
                if (typeof(headers) == "string") {
                    lastMemento = headers
                }
                else {
                    lastMemento = extensionTabs[tab.id].mem.processTimeGateUrl(orgUrl, headers, true)
                }
                if (pageUrl && lastMemento.search(extensionTabs[tab.id].mem.userTimeGateUrl) == 0 
                    && extensionTabs[tab.id].mem.lastMementoUrl != null) {

                    lastMemento = (extensionTabs[tab.id].mem.lastMementoUrl.length > 0) 
                    ? extensionTabs[tab.id].mem.lastMementoUrl 
                    : lastMemento
                }
                if (!lastMemento) {
                    // do not negotiate
                    extensionTabs[tab.id].mem.unsetMementoFlags()
                    extensionTabs[tab.id].mem.unsetDatetimeModifiedFlags()
                    chrome.tabs.update(tab.id, {url: clickedUrl})
                    return
                }
                window.setTimeout(extensionTabs[tab.id].mem.clearCache(), 2000)
                extensionTabs[tab.id].mem.setMementoFlags()
                extensionTabs[tab.id].mem.unsetDatetimeModifiedFlags()
                extensionTabs[tab.id].mem.specialDatetime = new Date()
                extensionTabs[tab.id].mem.setAcceptDatetime("last-memento")
                chrome.tabs.update(tab.id, {url: lastMemento})
                return
            })
        })
    }
})



/*************** Tabs and Windows *****************/



/* 
 * On Tab Created event listener
 * Creates an extension instance for that tab
 * and initializes all the flags
 */

chrome.tabs.onCreated.addListener( function(tab) {
    extensionTabs[tab.id] = new MementoExtension(tab.id)
    if (tab.openerTabId && extensionTabs[tab.openerTabId]) {
        extensionTabs[tab.openerTabId].getDatetimeFromStorage()
    }
})

/* Fired when a tab gets focus
 * the context menu and the plugin icons are refreshed
 * for the focussed tab based on the flags set for this tab's 
 * instance.
 * The menu and icons will have to be refreshed for each tab
 * and they do not persist across tabs
 */
chrome.tabs.onActivated.addListener( function(tab) {
    activeTabId = tab.tabId
    if (!extensionTabs[activeTabId]) {
        extensionTabs[activeTabId] = new MementoExtension(tab.id)
    }
    extensionTabs[activeTabId].getDatetimeFromStorage()
    extensionTabs[activeTabId].getTimeGateFromStorage()
})

/* 
 * Fired when a window gets focus.
 * Similar to tab focus change, the menus and icons 
 * for the active tab in the focussed window is refreshed.
 */

chrome.windows.onFocusChanged.addListener( function(windowId) {

    if (windowId < 0) {
        return
    }
    chrome.windows.get(windowId ,{populate: true}, function(win) {
        if (!win) {
            return
        }
        for (var i=0, t; t=win.tabs[i]; i++) {
            if (t.active) {
                activeTabId = t.id
                break
            }
        }
        if (!extensionTabs[activeTabId]) {
            extensionTabs[activeTabId] = new MementoExtension(activeTabId)
        }
        extensionTabs[activeTabId].getDatetimeFromStorage()
        extensionTabs[activeTabId].getTimeGateFromStorage()
    })
})

/* 
 * when a tab is replaced by another tab,
 * the memento extension object for the old tab is removed
 * and a new object is created.
 */

chrome.tabs.onReplaced.addListener( function(newTabId, oldTabId) {
    if (extensionTabs[oldTabId]) {
        extensionTabs[newTabId] = extensionTabs[oldTabId]
        extensionTabs[newTabId].mem.tabId = newTabId
        chrome.storage.local.remove(oldTabId.toString())
        delete extensionTabs[oldTabId]
    }
})

/* 
 * clean up after a tab is closed.
 * the stored datetime is removed for that tab along with it's
 * memento objects.
 */

chrome.tabs.onRemoved.addListener( function(tabId, removeInfo) {
    if (!extensionTabs[tabId]) {
        return
    }
    chrome.storage.local.remove(tabId.toString())
    delete extensionTabs[tabId]
})



/*************** On Calendar Datetime Modified *****************/



/*
 * fired when the datetime is changed or modified in the local storage.
 * when a datetime changes for the global memento-accept-datetime key
 * that value will be stored as the calendar time for the current active tab.
 * the context menu is also updated.
 */

chrome.storage.onChanged.addListener( function(changes, namespace) {
    if (changes["memento-accept-datetime"]) {
        var mementoAcceptDatetime = changes['memento-accept-datetime']['newValue']

        var val = {}
        val[activeTabId] = {'memento-accept-datetime': mementoAcceptDatetime}
        chrome.storage.local.set(val)

        extensionTabs[activeTabId].mem.calendarDatetime = new Date(mementoAcceptDatetime)
        if (extensionTabs[activeTabId].mem.mementoDatetime) {
            extensionTabs[activeTabId].mem.isDatetimeModified = true
        }
        extensionTabs[activeTabId].mem.updateUI()
    }
    else if (changes["mementoTimeGateUrl"]) {
        extensionTabs[activeTabId].getTimeGateFromStorage()
    }
})


/*************** Web Requests *****************/


/*
 * Fires before a web request is to be made.
 * If the request url is a top level resource, all the saved memento information
 * such as original, timegate, last memento urls are reset.
 * If the request is for an embedded resource, and if mementos of these resources 
 * should be retrieved, then these requests are redirected to the appropriate 
 * timegates.
 */
chrome.webRequest.onBeforeRequest.addListener( function(details) {
    if (extensionTabs[details.tabId] == undefined) {
        return
    }
    for (var i=0, r; r=extensionTabs[details.tabId].requestIds[i]; i++) {
        if (details.requestId == r) {
            return
        }
    }
    extensionTabs[details.tabId].requestIds.push(details.requestId)

    // not doing memento for known uris that does not have mementos or
    // does not need memento processing.
    var whiteList = extensionTabs[details.tabId].mem.getWhiteList()
    for (var i=0, r; r=whiteList[i]; i++) {
        if (details.url.match(r)) {
            return
        }
    }
    
    /* 
    * processing embedded resources. 
    */
    if (details.type != "main_frame" 
        && extensionTabs[details.tabId].mem.shouldProcessEmbeddedResources
        && details.url.search("chrome-extension://") < 0) {

            /*
            * Testing for re-written embedded urls by comparing the base url of 
            * the memento with the url of the embedded resource. The 
            * embedded resources will have the same host if it's rewritten.
            */
            if (!extensionTabs[details.tabId].mem.mementoBaseUrl 
                || details.url.search(extensionTabs[details.tabId].mem.mementoBaseUrl) == 0) {

                extensionTabs[details.tabId].mem.shouldProcessEmbeddedResources = false
                return
            }
            // doing SYNCHRONOUS AJAX requests for embedded resources...
            // have not figured out how the redirecturl could be returned with an 
            // async callback 
            var tgUrl = extensionTabs[details.tabId].mem.getSyncTimeGateUrl(details.url, false)
            if (!tgUrl) {
                // do not neg
                return
            }
            return {redirectUrl: tgUrl}

        }
    else if (details.type == "main_frame") {
        extensionTabs[details.tabId].requestIds = []

        extensionTabs[details.tabId].mem.unsetMementoInfo()
        extensionTabs[details.tabId].mem.lastMementoUrl = false
    }
},
{urls: ["<all_urls>"]},
["blocking"])


/*
 * If we are requesting a memento, the accept-datetime header is appended
 * to the request headers.
 */ 
chrome.webRequest.onBeforeSendHeaders.addListener( function(details) {
    if (extensionTabs[details.tabId] == undefined) {
        return
    }
    if (extensionTabs[details.tabId].mem.isMementoActive) {
        if (extensionTabs[details.tabId].mem.acceptDatetime) {
            extensionTabs[details.tabId].mem.appendAcceptDatetimeHeader(details.requestHeaders, extensionTabs[details.tabId].mem.acceptDatetime.toGMTString())
        }
        return {requestHeaders: details.requestHeaders}
    }
},
{urls: ["<all_urls>"]},
["blocking", "requestHeaders"])

/*
 * sets the number of times the cache can be cleared by the plugin in a 10 minute interval
 * this is to clear the memory cache of chrome before a request to a memento is made.
 */
chrome.webRequest.MAX_HANDLER_BEHAVIOR_CHANGED_CALLS_PER_10_MINUTES = 100

/* 
 * when the response headers are received for the top level resource,
 * native mementos and non-natives mementos are identified, appropriate flags
 * are set and memento info such as original, timegate, last memento url and 
 * memento datetime values are set for updating menus and icons.
 */

chrome.webRequest.onHeadersReceived.addListener( function(details) {
    if (extensionTabs[details.tabId] == undefined) {
        return
    }
    if (details.type != "main_frame") {
        return
    }
    if (details.statusLine.search("HTTP/1.1 30") == 0) {
        extensionTabs[details.tabId].mem.lastMementoUrl = extensionTabs[details.tabId].mem.getRelUriFromHeaders(details.responseHeaders, "last")    
        return
    }

    var tgUrl = extensionTabs[details.tabId].mem.getRelUriFromHeaders(details.responseHeaders, "timegate")
    var orgUrl = extensionTabs[details.tabId].mem.getRelUriFromHeaders(details.responseHeaders, "original")
    /* 
    * checking if this is a native memento resource
    * the "memento-datetime" header confirms this
    */
    for (var i=0, h; h=details.responseHeaders[i]; i++) {
        if (h.name.toLowerCase() == "memento-datetime") {
            /* 
            * setting base url of the memento
            * will be used to determine if the embedded resources are processed.
            */
            var protocol = ""
            if (details.url.slice(0,7) == "http://") {
                protocol = "http://"
            }
            else if (details.url.slice(0,8) == "https://") {
                protocol = "https://"
            }
            var baseUrl = details.url.replace(protocol, "")
            baseUrl = protocol + baseUrl.split("/")[0] 

            extensionTabs[details.tabId].mem.setMementoFlags()
            extensionTabs[details.tabId].mem.isPsuedoMemento = false
            extensionTabs[details.tabId].mem.setMementoInfo(orgUrl, tgUrl, details.url, h.value, baseUrl)

            extensionTabs[details.tabId].mem.updateUI()
            return
        }
    }

    /*
     * checking for wikipedia mementos...
     * treated as a special case...
     */

    if (details.url.search(extensionTabs[details.tabId].mem.wikipediaMementoBaseRE) >= 0 
        && details.url.search(extensionTabs[details.tabId].mem.wikipediaOldIdRE)> 0) {

        var r = details.url.match(extensionTabs[details.tabId].mem.wikipediaTitleRE)
        if (r != null) {
            orgUrl = "http://" 
                + details.url.match(extensionTabs[details.tabId].mem.wikipediaLanguageRE)[1]
                + extensionTabs[details.tabId].mem.wikipediaTemplateUrl
                + r[1]
        }
        extensionTabs[details.tabId].mem.setMementoFlags()
        extensionTabs[details.tabId].mem.setMementoInfo(orgUrl, tgUrl, details.url, "non-native", false)
        extensionTabs[details.tabId].mem.updateUI()
        return
    }

    /* 
    * checking for non-native memento resources. 
    * setting psuedo memento datetime header
    */
    if (extensionTabs[details.tabId].mem.isMementoActive 
        && extensionTabs[details.tabId].mem.isPsuedoMemento) {

        extensionTabs[details.tabId].mem.setMementoFlags()
        extensionTabs[details.tabId].mem.setMementoInfo(orgUrl, tgUrl, details.url, "non-native", false)
        extensionTabs[details.tabId].mem.updateUI()
        return
    }
    
    // fall through to update the menu for original resources
    if (activeTabId == details.tabId) {
        extensionTabs[details.tabId].mem.unsetMementoFlags()
        extensionTabs[details.tabId].mem.unsetMementoInfo()
        extensionTabs[details.tabId].mem.updateUI()
    }
},
{urls: ["<all_urls>"]},
["responseHeaders"])


/*************** Web Navigation *****************/


/* 
 * This traps requests made by typing a url in the address bar or by using the 
 * back/forward buttons or typing a search term, bookmark keywords, etc in the omnibox.
 * The memento flags are reset and the menus and icons are updated.
 */

chrome.webNavigation.onCommitted.addListener( function(details) {
    if (extensionTabs[details.tabId] == undefined) {
        return
    }
    if (details.transitionType == "typed" 
        || details.transitionType == "link"
        || details.transitionType == "generated" 
        || details.transitionType == "auto_toplevel" 
        || details.transitionType == "keyword" 
        || details.transitionType == "keyword_generated") {
        var resetState = false
        if (extensionTabs[details.tabId].mem.mementoDatetime == "non-native") {
            resetState = true
        }
        else {
            for (var i=0, t; t=details.transitionQualifiers[i]; i++) {
                if (t == "forward_back" || t == "from_address_bar") {
                    resetState = true
                    break
                }
            }
        }
        if (!resetState) {
            return
        }
        extensionTabs[details.tabId].mem.unsetMementoFlags()
        delete extensionTabs[details.tabId].mem.visitedUrls[details.url]
        extensionTabs[details.tabId].mem.updateUI()
    }
    else if (details.transitionType == "reload") {
        extensionTabs[details.tabId].mem.clearCache()
    }
})

/*************** On First Install *****************/
/*
 * When installed for the first time, the menu is initialized to 
 * ask the user to set a datetime before proceeding
 */
chrome.runtime.onInstalled.addListener(function(details) {
    chrome.contextMenus.removeAll()
    if (!extensionTabs[activeTabId]) {
        return
    }
    extensionTabs[activeTabId].mem.init()
    chrome.storage.local.set({'mementoTimeGateUrl': extensionTabs[activeTabId].mem.aggregatorUrl})
})

