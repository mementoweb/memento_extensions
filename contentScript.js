function getAllHrefs() {
    
    var hrefs = document.getElementsByTagName("a")
    var hrefDatetime = {}
    for (var i=0, a; a=hrefs[i]; i++) {
        hrefDatetime[a['href']] = (a.getAttribute('datetime') != null) ? a.getAttribute('datetime') : 0 
    }
    return hrefDatetime
}

chrome.runtime.sendMessage({'hrefDatetime': getAllHrefs()})
