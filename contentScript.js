function getAllLinkVersionDate() {
    
    var hrefs = document.getElementsByTagName("a");
    var hrefDatetime = {};
    for (var i=0, a; a=hrefs[i]; i++) {
        /*
        if (hrefDatetime[a['href']]) {
            continue;
        }
        */
        if (!hrefDatetime[a['href']]) {
            hrefDatetime[a['href']] = {};
        }
        if (!hrefDatetime[a['href']]['versionDate']) {
            hrefDatetime[a['href']]['versionDate'] = (a.getAttribute('data-versiondate') != null) ? a.getAttribute('data-versiondate') : false; 
        }
        if (!hrefDatetime[a['href']]['versionUrl']) {
            hrefDatetime[a['href']]['versionUrl'] = (a.getAttribute('data-versionurl') != null) ? a.getAttribute('data-versionurl') : false; 
        }
    }
    return hrefDatetime;
}

function getMetaVersionDate() {
    
    var hrefs = document.getElementsByTagName("meta");
    var metaDatetime = {};
    for (var i=0, a; a=hrefs[i]; i++) {
        if (a.getAttribute('itemprop') == "datePublished") {
            metaDatetime["datePublished"] = (a.getAttribute('content') != null) ? a.getAttribute('content') : false;
            break;
        }
    }
    return metaDatetime;
}

function sendMetaInfoToExtension() {
    chrome.runtime.sendMessage({'linkVersionDates': getAllLinkVersionDate()});
    chrome.runtime.sendMessage({'metaVersionDate': getMetaVersionDate()});
}

if (document.readyState == "complete") {
    sendMetaInfoToExtension();
}
else {
    window.addEventListener("load", function() {
        sendMetaInfoToExtension();
    });
}
