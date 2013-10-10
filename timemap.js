
function getUrlParameter(url, name) {
    return decodeURIComponent((new RegExp('[?|&]' + name + '=' + '([^&;]+?)(&|#|;|$)').exec(url)||[,""])[1].replace(/\+/g, '%20'))||null;
}

$( function() {
    var locUrl = document.location.href
    var reqUrl = unescape(getUrlParameter(locUrl, "org_url"))
    if (!reqUrl || reqUrl == "undefined") {
        return
    }

    var r = new MementoHttpRequest()
    r.doHttp(reqUrl, false, function(reqHeadResponse) {
        headRequest(reqUrl, reqHeadResponse)
    })
    
})

function headRequest(reqUrl, reqHeadResponse) {

    var orgUrl = MementoUtils.getRelUriFromHeaders(reqHeadResponse.getAllResponseHeaders(), "original")
    if (!orgUrl) {
        orgUrl = reqUrl;
    }
        
    console.log("Original url: " + orgUrl)

    var r = new MementoHttpRequest()

    r.doHttp(orgUrl, false, function(orgHeadResponse) {
        var timegateUrl = MementoUtils.getRelUriFromHeaders(orgHeadResponse.getAllResponseHeaders(), "timegate")
        headTimegate(orgUrl, timegateUrl)
    })
}

function headTimegate(orgUrl, timegateUrl) {
    if (!timegateUrl) {
        timegateUrl = "http://mementoproxy.lanl.gov/aggr/timegate/" + orgUrl
        timemapUrl = "http://mementoproxy.lanl.gov/aggr/timemap/link/1/" + orgUrl
        getTimemap(timemapUrl)
    }
    else {
        console.log("Timegate url: " + timegateUrl)

        var Request = MementoHttpRequest.bind(getTimemap)
        var r = new Request()

        r.doHttp(timegateUrl, false, function(tgHeadResponse) {
            var timemapUrl = MementoUtils.getRelUriFromHeaders(tgHeadResponse.getAllResponseHeaders(), "timemap")
            getTimemap(timemapUrl)
        })
    }
}

function getTimemap(timemapUrl) {
    
    if (!timemapUrl) {
        return
    }
    for (var i=0, u; u=visitedTimemaps[i]; i++) {
        if (u == timemapUrl) {
            return
        }
    }
    visitedTimemaps.push(timemapUrl)

    var r = new MementoHttpRequest()
    r.doHttp(timemapUrl, false, function(tmResponse) {
        console.log("Timemap url: " + timemapUrl)
        processTimemap(tmResponse)
    }, "GET")
}

var visitedTimemaps = []
var mementoCount = 0
var archiveCount = {}

var archiveIcons = {}
archiveIcons["http://web.archive.org/web/"] = "img/archives/internet-archive.png";
archiveIcons["http://wayback.archive-it.org/"] = "img/archives/archive-it.png";
archiveIcons["http://webarchive.nationalarchives.gov.uk/"] = "img/archives/ukna.png";
archiveIcons["http://www.webarchive.org.uk"] = "img/archives/ukwa.png";
archiveIcons["http://archive.is/"] = "img/archives/archive-is.png";
archiveIcons["http://webarchive.loc.gov/"] = "img/archives/loc.png";
archiveIcons["http://wayback.vefsafn.is/"] = "img/archives/icelandic-archive.png";
archiveIcons["http://wayback.webarchiv.cz/"] = "img/archives/czech-archive.png";
archiveIcons["default"] = "img/archives/default.png";

function getArchiveIcon(url) {
    for (baseUrl in archiveIcons) {
        if (url.search(baseUrl) >= 0) {
            if (!archiveCount[baseUrl])
                archiveCount[baseUrl] = 0
            archiveCount[baseUrl]++ 
            return archiveIcons[baseUrl]
        }
    }
    if (!archiveCount["default"])
        archiveCount["default"] = 0
    archiveCount["default"]++
    return archiveIcons["default"]
}

function processTimemap(tmResponse) {
    var lhash = MementoUtils.parseLinkHeader(tmResponse.responseText)
    var mems = []
    for (var uri in lhash) {
        params = lhash[uri];
        vals = lhash[uri]['rel'];
        if (vals != undefined) {
            for (var v=0, val; val= vals[v]; v++) {
                if (val == "memento") {
                    mementoCount++
                    var icon = "<span class='memento_icon'><img src='"+getArchiveIcon(uri)+"' /></span>";
                    if (mementoCount % 2 == 0) {
                        mems.push("<div class='memento even'><span class='memento_count'>"+mementoCount+":</span>"+icon+"<a href=\""+uri+"\" target=\"_blank\">"+lhash[uri]['datetime'][0]+"</a></div>");
                    }
                    else {
                        mems.push("<div class='memento odd'><span class='memento_count'>"+mementoCount+":</span>"+icon+"<a href=\""+uri+"\" target=\"_blank\">"+lhash[uri]['datetime'][0]+"</a></div>");
                    }
                }
                if (val == "timemap") {
                    getTimemap(uri)
                }
            }
        }
    }
    $("#mementos").append(mems.join(""))

    var acHtml = ""
    for (baseUrl in archiveCount) {
        acHtml += "<div class='archive'>"
        acHtml += "<span class='archive_icon'><img alt='"+baseUrl+"' title='"+baseUrl+"' src='"+getArchiveIcon(baseUrl)+"'/></span>"
        acHtml += "<span class='archive_basurl'><i>"+baseUrl+"</i></span>";
        acHtml += "<span class='archive_count'><b>"+archiveCount[baseUrl]+"</b></span>"
        acHtml += "</div>";   
    }
    
    $("#archive_stats").empty()
    $("#archive_stats").append(acHtml)
}
