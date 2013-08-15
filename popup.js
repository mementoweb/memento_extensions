function pad(n) {
    return n < 10 ? '0'+n : n
}

$(function() {
    
    chrome.storage.local.get("accept-datetime-readable", function(items) {
        var readableAcceptDatetime = items["accept-datetime-readable"]        
        if (readableAcceptDatetime == undefined) {
            return
        }
        var d = new Date(readableAcceptDatetime)
        var selectedDate = d.getUTCFullYear() + "-" + pad(d.getUTCMonth()+1) + "-" + pad(d.getUTCDate())
        var selectedTime = pad(d.getUTCHours()) + ":" + pad(d.getUTCMinutes()) + ":" + pad(d.getUTCSeconds())

        $("#datepicker").val(selectedDate)
        $("#timepicker").val(selectedTime)
        $("#datepicker").datepicker("option", "defaultDate", selectedDate)
    })

    $( "#datepicker" ).datepicker({
        changeMonth: true,
        changeYear: true,
        dateFormat: "yy-mm-dd",
        maxDate: "-1d",
        onSelect: function(date, inst) {

            var readableDatetime = date + " " + $("#timepicker")[0].value
            /*
            var d = new Date (readableDatetime)
            var timegateServiceDate = d.getUTCFullYear() + 
                            pad(d.getUTCMonth()+1) + 
                            pad(d.getUTCDate()) + 
                            pad(d.getUTCHours()) +
                            pad(d.getUTCMinutes()) +
                            pad(d.getUTCSeconds())
            chrome.storage.local.set({'accept-datetime': timegateServiceDate}, Menu.update())
            */
            chrome.storage.local.set({'accept-datetime-readable': readableDatetime})

            var savedMessage = readableDatetime + " saved. <br/>Right click on a page, hyperlinks or images to load it's past versions."
            $("#savedMessage").append(savedMessage)
        }
    })
})
