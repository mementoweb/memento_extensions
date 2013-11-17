function getAllLinkVersionDate() {
    
    var hrefs = document.getElementsByTagName("a")
    var hrefDatetime = {}
    for (var i=0, a; a=hrefs[i]; i++) {
        hrefDatetime[a['href']] = (a.getAttribute('data-versiondate') != null) ? a.getAttribute('data-versiondate') : false 
    }
    console.log(hrefDatetime)
    return hrefDatetime
}

function getMetaVersionDate() {
    
    var hrefs = document.getElementsByTagName("meta")
    var metaDatetime = {}
    for (var i=0, a; a=hrefs[i]; i++) {
        if (a.getAttribute('name') == "versiondate") {
            metaDatetime = (a.getAttribute('content') != null) ? new Date(a.getAttribute('content')): false
            break;
        }
    }
    return metaDatetime
}
chrome.runtime.sendMessage({'linkVersionDates': getAllLinkVersionDate()})
chrome.runtime.sendMessage({'metaVersionDate': getMetaVersionDate().toString()})
