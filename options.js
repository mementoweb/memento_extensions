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

    $("#optionsCurrentlyUsedArchiveUrl").empty()
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

            var timegateUrl = ""
            var userTimeGate = $("#userTimeGate")[0].value
            if (userTimeGate.trim() != "") {
                if (userTimeGate.search("http://") != 0 && userTimeGate.search("https://") != 0) {
                    $("#userTimeGateError").append("The entered URL is not valid.")
                    $("#userTimeGateError").addClass("ui-state-error ui-corner-all")
                    return
                }
                timegateUrl = userTimeGate
                $("#optionsCurrentlyUsedArchiveUrl").empty()
                $("#optionsCurrentlyUsedArchiveUrl").append(chrome.i18n.getMessage("optionsCurrentlyUsedArchiveUrl", ["Custom TimeGate", timegateUrl]))
            }

            if (timegateUrl == "") {
                $( "#selectable .ui-selected" ).each(function() {
                    var index = $( "#selectable li" ).index( this );
                    $("#optionsCurrentlyUsedArchiveUrl").empty()
                    $("#optionsCurrentlyUsedArchiveUrl").append(chrome.i18n.getMessage("optionsCurrentlyUsedArchiveUrl", [this.innerHTML, mementoTimeGateUrlList[index]]))
                    timegateUrl = mementoTimeGateUrlList[index]
                });
            }
            chrome.storage.local.set({'mementoTimeGateUrl': timegateUrl})
        })
});
