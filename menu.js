/**

 * This file is part of the extension Memento for Chrome.
 * http://mementoweb.org

 * Copyright 2013,
 * Harihar Shankar, Herbert Van de Sompel, 
 * Martin Klein, Robert Sanderson, Lyudmila Balakireva
 * -- Los Alamos National Laboratory. 

 * Licensed under the BSD open source software license.
 * You may not use this file except in compliance with the License.
 * You may obtain a copy of the License at

 * http://mementoweb.github.io/SiteStory/license.html

 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/** 
 * MementoHttpRequest implements aynchronous ajax requests.
 * Uses jQuery ajax functions.
 */

function MementoHttpRequest() {}

MementoHttpRequest.prototype = {

    /**
     * This function wraps the jQuery ajax method. The Accept-Datetime header
     * can be optionally set.
     * @param: uri: the uri to request
     * @param: calendarDatetime: the accept-datetime to set.
     * @param: callback: the callback function to execute on response received. 
     */

    doHttp: function(uri, calendarDatetime, callback) {
        var hdrs = {}
        if (calendarDatetime) {
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

/**
 * Memento implements the Memento algorithm.
 * There are kludges here to extend support for archives that do not
 * natively support memento yet. 
 * The memento algorithm can be found at doc/memento_algorithm.txt file.
 * The handling of the menu and it's various states are also done here. 
 * TODO: decouple menu handling from the memento algorithm. 
 */

function Memento() {
}

Memento.prototype = {

    aggregatorUrl: "http://mementoproxy.lanl.gov/aggr/timegate/",
    //wikipediaTimegate: "http://mementoproxy.lanl.gov/wiki/timegate/",
    wikipediaTemplateUrl: ".wikipedia.org/wiki/",
    wikipediaLanguageRE: new RegExp("([a-z]{0,2})\.wikipedia.org/"),
    wikipediaMementoBaseRE: new RegExp("[a-z]{0,2}\.wikipedia.org/w/index.php"),
    wikipediaOldIdRE: new RegExp("[?&]oldid=[0-9]+(&|$)"),
    wikipediaTitleRE: new RegExp('[?|&]title=' + '([^&;]+?)(&|#|;|$)'),
    googleSearchURLRE: new RegExp("(http|https)://www.google(.co)?.[a-z]{2,3}/url"),
    yahooSearchURLRE: new RegExp("search.yahoo.com"),
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


    /**
     * Parses link headers and returns an object. The link header is 
     * processed character by character.
     * @param: link: the link header as a string. 
     * @return: object: links[uri][rel] = relValue 
     */

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
                    if (!links[uri]) {
                        links[uri] = {};
                    }
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

    /**
     * Returns the uri for the rel type requested.
     * @param: lhash: the object returned from parseLinkHeader method.
     * @param: rel: the rel type requested.
     * @return: the matched uri or null on no match.
     */

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

    /**
     * Given a header name, this method returns the http header value.
     * The headers can be either an object of key value pairs,
     * or a string.
     * @param: headers: the http headers
     * @param: headerName: the requested header name
     * @return: the value of the header or false if none found.
     */

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

    /**
     * A wrapper function that gets the link headers, parses it, 
     * and returns the uri for the rel type asked. 
     * @param: headers: the http response headers.
     * @param: the rel type to look for in the link header. 
     * @return: the url for the rel type.
     */

    getRelUriFromHeaders: function(headers, rel) {
        var linkHeader = this.getHeader(headers, "link")
        var relUrl = false
        if (linkHeader != "") {
            var links = this.parseLinkHeader(linkHeader.trim())
            relUrl = this.getUriForRel(links, rel)
        }
        return relUrl
    },

    /** 
     * This is for synchrous ajax requests. Used only when processing mementos for
     * embedded resources. 
     * TODO: re-write the handlers to process async requests and remove this function.
     * @param: uri: the request url
     * @param: method: the request http method
     * @param: setAcceptDatetime: the optional accept-datetime to set
     * @return: jqXHR: the jquery ajax object.
     */

    ajax: function(uri, method, setAcceptDatetime) {
        var hdrs = {}
        if (setAcceptDatetime) {
            hdrs = {'Accept-Datetime': this.acceptDatetime.toGMTString()}
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

    /**
     * A function to append accept-datetime header to request headers. 
     * @param: headers: the original request headers
     * @param: datetime: the accept-datetime value to append
     */
    appendAcceptDatetimeHeader: function(headers, datetime) {
        for (var i=0, h; h=headers[i]; i++) {
            if (h['name'].toLowerCase() == "accept-datetime") {
                h.pop()
                break;
            }
        }
        headers.push({"name": "Accept-Datetime", "value": datetime}) 
    },

    /**
     * A list of uris or uri regex patters to not do memento on. 
     * @return: an array of uris and patterns. 
     */
    getWhiteList: function() {
        uriWhitelist = [];
        uriWhitelist.push(new RegExp('google-analytics\\.com')); // everywhere, just ignore

        return uriWhitelist;
    },

    /**
     * This clears chrome's in-memory cache. Chrome has a caching mechanism 
     * that does not seem to honor accept-datetime requests. The Memento algorithm
     * cannot be implemented without clearing the cache before making a memento request. 
     */

    clearCache: function() {
        chrome.webRequest.handlerBehaviorChanged()
    },

    /**
     * Creates the context menu on right click. 
     * @param: title: the text to be displayed in the menu.
     * @param: context: the context in which to display the menu
     * @param: enabled: toggle to enable the menu
     * @param: targetUrl: url patterns for this menu to appear.
     * @return: the id of the created menu.
     */

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

    /**
     * Updates the menu items based on the resource loaded: a memento or an original.
     */
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

    /**
     * Updates the menus and the icons depending on the loaded resource 
     * type.
     */
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

    /**
     * Given any url, this method returns the original url of that resource.
     * A HEAD is performed on the resource and the original rel type url is  
     * returned for memento supported resources.
     * Wikipedia is handled as a special case where the presence of oldid determines 
     * the type of resource. All other non-memento supported resources are assumed to be original.
     * @param: reqUrl: the requested url
     * @param: orgHeadResponse: the response headers from the HEAD on the resource.  
     */
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

    /**
     * The HEAD to determine the original resource is made here.
     * The processing of the resoponse is handled be the processOriginalUrl 
     * method.
     * @param: reqUrl: the request url
     * @param: the callback to execute on response received.
     */
    getOriginalUrl: function(reqUrl, callback) {
        var o = callback
        var Request = MementoHttpRequest.bind(o)
        var r = new Request()
        r.doHttp(reqUrl, false, function(orgHeadResponse) {
            callback(orgHeadResponse.getAllResponseHeaders())
        })
    },

    /** 
     * Determines the timegate url for the given resource. The logic is similar 
     * to processOriginalUrl.
     * @param: orgUrl: the url of the original resource
     * @param: tgHeadResponse: the reponse headers from the HEAD request on the original
     * @param: isTopLevelResource: if this resource is a top level resource. Helps set the 
     * flags for non-native memento handling.
     * @return: timegate url
     */
    processTimeGateUrl: function(orgUrl, tgHeadResponse, isTopLevelResource) {
        var tgUrl
        if (this.getHeader(tgHeadResponse.getAllResponseHeaders(), "Memento-Datetime")) {
            var contentLocation = this.getHeader(tgHeadResponse.getAllResponseHeaders(), "Content-Location")
            if (contentLocation) {
                tgUrl = contentLocation
            }
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

    /**
     * The method does the HEAD on the original resource to get the link headers.
     * @param: orgUrl: the original url
     * @param: callback: the callback function to execute.
     */
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

        r.doHttp(orgUrl, this.acceptDatetime, function(tgHeadResponse) {
            callback(tgHeadResponse)
        })
    },

    /** 
     * Similar to getTimeGateUrl, but performs synchronous ajax requests. 
     * @param: orgUrl: the original url
     * @param: isTopLevelResource: if this is a top level resource.
     * @return: the timegate url
     */
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

    /**
     * Sets the memento icon. 
     */
    setMementoIcon: function() {
        chrome.browserAction.setIcon({'path': 'img/memento_on-35x35.png'})
    },

    /** 
     * Sets the original icon.
     */
    setOriginalIcon: function() {
        chrome.browserAction.setIcon({'path': 'img/memento-35x35.png'})
    },

    /**
     * A function to get the parameter value from a url.
     * @param: url: the url with parameters.
     * @param: name: the key/name of the parameter.
     * @return: the value for the key/name.
     */
    getUrlParameter: function(url, name) {
        return decodeURIComponent((new RegExp('[?|&]' + name + '=' + '([^&;]+?)(&|#|;|$)').exec(url)||[,""])[1].replace(/\+/g, '%20'))||null;
    },

    /**
     * If the request url is a yahoo or google search result, this
     * function finds the original url. 
     * @param: the request url
     * @return: the original url
     */
    filterSearchResultUrl: function(url) {
        if (url.search(this.yahooSearchURLRE) >= 0) {
            url = unescape(url.split("**")[1])
        }
        else if (url.search(this.googleSearchURLRE) >= 0) {
            url = this.getUrlParameter(url, "url")
        }
        return url
    },

    /**
     * reset the flags that determines if a resource is a memento.
     */

    unsetMementoFlags: function() {
        this.isMementoActive = false
        this.specialDatetime = false
        this.shouldProcessEmbeddedResources = false
        this.isPsuedoMemento = false
    },

    /**
     * Reset the flag that was set when the calendar date time was modified.
     */
    unsetDatetimeModifiedFlags: function() {
        this.isDatetimeModified = false
    },

    /**
     * Set the flag to indicate that the calendar datetime has been modified.
     */
    setDatetimeModifiedFlags: function() {
        this.isDatetimeModified = true
    },

    /** 
     * Set the flags that indicate the current resource is a memento.
     */
    setMementoFlags: function() {
        this.isMementoActive = true
        if (this.isPsuedoMemento) {
            this.shouldProcessEmbeddedResources = false
        }
        else {
            this.shouldProcessEmbeddedResources = true
        }
    },

    /** 
     * The accept datetime value is set depending on the requested memento resource. 
     * @param: type: the type of the memento resource to be requested. 
     */ 
    setAcceptDatetime: function(type) {
        if (type == "calendar") {
            this.acceptDatetime = this.calendarDatetime
        }
        else if (type == "last-memento") {
            this.acceptDatetime = new Date()
            this.specialDatetime = true
        }
    },

    /**
     * The accept datetime value is reset. 
     * Happens everytime a new resource is loaded.
     */
    unsetAcceptDatetime: function() {
        this.acceptDatetime = false
        this.specialDatetime = false
    },

    /**
     * Sets the necessary memento information of the loaded resource.
     * @param: orgUrl: the original Url
     * @param: tgUrl: the timegate url
     * @param: memUrl: memento url
     * @param: memDt: memento datetime of the loaded resource.
     * @param: memBaseUrl: the base url of the memento. For non-native memento resources, 
     * this information is used to decide if embedded resources should be processed. 
     */
    setMementoInfo: function(orgUrl, tgUrl, memUrl, memDt, memBaseUrl) {
        this.originalUrl = orgUrl
        this.timegateUrl = tgUrl
        this.mementoUrl = memUrl
        this.mementoBaseUrl = memBaseUrl

        this.mementoDatetime = memDt
        this.visitedUrls[this.mementoUrl] = this.orgUrl
    },

    /**
     * reset all the memento flags. 
     */
    unsetMementoInfo: function() {
        this.originalUrl = false
        this.timegateUrl = false
        this.mementoUrl = false
        this.mementoBaseUrl = false
        this.mementoDatetime = false
    },

    /**
     * initialize the UI for first time use. Called when the plugin is run for the first time.
     */
    init: function() {
        var title = chrome.i18n.getMessage("menuInitDatetimeTitle")
        this.menuId = chrome.contextMenus.create({
            "title": title,
            "contexts": Memento.contexts,
            "enabled": false
        })
    }
}


/**
 * Handler for each tab or window created in chrome. 
 * Acts as an interface between the browser and the memento algorithm.
 */
function MementoExtension(tabId) {
    this.requestIds = []
    this.mem = new Memento()
    this.getTimeGateFromStorage()
}

MementoExtension.prototype = {
    /**
     * Retrieves the calendar date time of the currently active tab. 
     * Each tab's date time is stored in the local browser storage. 
     * If a tab does not have a date time value, the date time value of the previously
     * active tab is automatically assigned. 
     */ 
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

    /** 
     * The user preferred timegate is retrieved from storage.
     */
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
        extensionTabs[tab.id].mem.unsetAcceptDatetime()
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
        extensionTabs[tab.id].mem.setAcceptDatetime("calendar")
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
                extensionTabs[tab.id].mem.setMementoFlags()
                extensionTabs[tab.id].mem.unsetDatetimeModifiedFlags()
                chrome.tabs.update(tab.id, {url: tgUrl})
                return
            })
        })
    }
    else if (clickedForLastMemento) {
        extensionTabs[tab.id].mem.setAcceptDatetime("last-memento")
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
        extensionTabs[details.tabId].mem.unsetAcceptDatetime()
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
        var serverRedirect = false

        if (extensionTabs[details.tabId].mem.mementoDatetime == "non-native") {
            resetState = true
        }
        else {
            for (var i=0, t; t=details.transitionQualifiers[i]; i++) {
                if (t == "forward_back" || t == "from_address_bar") {
                    resetState = true
                    break
                }
                if (t == "server_redirect") {
                    serverRedirect = true
                }
            }
        }
        if (!serverRedirect) {
            extensionTabs[details.tabId].mem.unsetAcceptDatetime()
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

