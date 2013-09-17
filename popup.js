function pad(n) {
    return n < 10 ? '0'+n : n
}

var tabId = false
var windowId = false

chrome.tabs.query({active: true, currentWindow: true, windowType: "normal"}, function(tab) {
    tabId = tab[0].id
})

chrome.storage.local.get(null, function(items) {

    var d = new Date()
    d.setDate(d.getDate() - 1)

    var mementoAcceptDatetime;

    if (tabId && items[tabId]) {
        mementoAcceptDatetime = items[tabId]["memento-accept-datetime"]
    }
    else {
        mementoAcceptDatetime = items["memento-accept-datetime"]        
    }
    if (mementoAcceptDatetime) {
        d = new Date(mementoAcceptDatetime)
    }
    var selectedDate = d.getUTCFullYear() + "-" + pad(d.getUTCMonth()+1) + "-" + pad(d.getUTCDate())
    var selectedTime = pad(d.getUTCHours()) + ":" + pad(d.getUTCMinutes()) + ":" + pad(d.getUTCSeconds())

    $("#dateBox").val(selectedDate)
    $("#timeBox").val(selectedTime)

    $( "#datepicker" ).datepicker({
        changeMonth: true,
        changeYear: true,
        dateFormat: "yy-mm-dd",
        maxDate: "-1d",
        altField: "#dateBox",
        defaultDate: selectedDate,
        onChangeMonthYear: function(year, month, inst) {
            var prevDate = $("#dateBox").val()
            var prevDay = prevDate.split("-")[2]
            var currDate = year + "-" + month + "-" + prevDay
            $("#dateBox").val(currDate)
            $( "#datepicker" ).datepicker("setDate", currDate)
        }
    });
})

$(function() {
    
    $( "#dateText" ).append(chrome.i18n.getMessage("popupDateText") + ": ")
    $( "#dateBox" ).change( function() {
            $( "#datepicker" ).datepicker("setDate", $(this).val())
        })
    $( "#timeText" ).append(chrome.i18n.getMessage("popupTimeText") + ": ")
    $( "#descriptionText" ).append(chrome.i18n.getMessage("popupDescriptionText"))
    
    $( "#setDatetime" )
        .append(chrome.i18n.getMessage("popupSetDatetime"))
        .button()
        .click( function (event) {
            event.preventDefault()

            var mementoAcceptDatetime = new Date($("#dateBox")[0].value + " " + $("#timeBox")[0].value + " GMT").toGMTString()
            chrome.storage.local.set({'memento-accept-datetime': mementoAcceptDatetime})
            window.close()
        });

    $( "#cancelDatetime" )
        .append(chrome.i18n.getMessage("popupCancelDatetime"))
        .button()
        .click( function (event) {
            event.preventDefault()

            window.close()
        });

})
