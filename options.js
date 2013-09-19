var mementoTimeGateUrlList = [
    "http://mementoproxy.lanl.gov/aggr/timegate/",
    "http://web.archive.org/web/",
    "http://www.webarchive.org.uk/wayback/memento/timegate/",
    "http://webarchive.nationalarchives.gov.uk/timegate/",
    "http://archive.is/timegate/",
    "http://wayback.archive-it.org/all/"
]

chrome.storage.local.get(null, function(items) {
    var index = 0
    if (items["mementoTimeGateUrl"]) {
        for (i in mementoTimeGateUrlList) {
            if (mementoTimeGateUrlList[i] == items["mementoTimeGateUrl"]) {
                index = i
                break
            }
        }
    }
    var selectedArchive = $($("#selectable li")[index])
    selectedArchive.addClass("ui-selected")

    //var result = $( "#savedMementoTimeGate" ).empty();
    //result.append( "<b>"+selectedArchive[0].textContent + "</b> with TimeGates at baseURI <i>" + mementoTimeGateUrlList[index] + "</i></br>");
    $("#optionsCurrentlyUsedArchiveUrl").append(chrome.i18n.getMessage("optionsCurrentlyUsedArchiveUrl", [selectedArchive[0].textContent, mementoTimeGateUrlList[index]]))
    
})

$(function() {
    $( "#selectable li" ).click( function() {
        $(this).addClass("ui-selected").siblings().removeClass("ui-selected")
    })
    
    $("#optionsTitle").append(chrome.i18n.getMessage("optionsTitle"))
    $("#optionsArchiveDescription").append(chrome.i18n.getMessage("optionsArchiveDescription"))
    $("#optionsCurrentlyUsedArchiveTitle").append(chrome.i18n.getMessage("optionsCurrentlyUsedArchiveTitle"))
    $("#optionsSelectArchiveTitle").append(chrome.i18n.getMessage("optionsSelectArchiveTitle"))
    

    $("#optionsUpdateButtonText")
        .append(chrome.i18n.getMessage("optionsUpdateButtonText"))
        .button()
        .click( function(event) {
            event.preventDefault()

            //var result = $( "#savedMementoTimeGate" ).empty();
            $( "#selectable .ui-selected" ).each(function() {
                var index = $( "#selectable li" ).index( this );
                $("#optionsCurrentlyUsedArchiveUrl").append(chrome.i18n.getMessage("optionsCurrentlyUsedArchiveUrl", [this.innerHTML, mementoTimeGateUrlList[index]]))
                //result.append( "<b>"+this.innerHTML + "</b> with TimeGates at baseURI <i>" + mementoTimeGateUrlList[index] + "</i></br>");
                chrome.storage.local.set({'mementoTimeGateUrl': mementoTimeGateUrlList[index]})
            });


        })
});
