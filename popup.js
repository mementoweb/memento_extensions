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
        maxDate: "-1m",
        minDate: new Date("1996-01-01"),
        yearRange: "1996:2014",
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
