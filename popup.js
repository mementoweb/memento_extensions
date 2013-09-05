function pad(n) {
    return n < 10 ? '0'+n : n
}

chrome.storage.local.get("accept-datetime-readable", function(items) {

    var d = new Date()
    d.setDate(d.getDate() - 1)

    var readableAcceptDatetime = items["accept-datetime-readable"]        
    if (readableAcceptDatetime != undefined) {
        d = new Date(readableAcceptDatetime)
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
    });
})

$(function() {
    
    $( "#dateText" ).append(chrome.i18n.getMessage("popupDateText") + ": ")
    $( "#timeText" ).append(chrome.i18n.getMessage("popupTimeText") + ": ")
    $( "#descriptionText" ).append(chrome.i18n.getMessage("popupDescriptionText") + ": ")

    $( "#setDatetime" )
        .append(chrome.i18n.getMessage("popupSetDatetime"))
        .button()
        .click( function (event) {
            event.preventDefault()

            var readableDatetime = new Date($("#dateBox")[0].value + " " + $("#timeBox")[0].value).toGMTString()
            chrome.storage.local.set({'accept-datetime-readable': readableDatetime})
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
