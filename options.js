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

chrome.storage.local.get(null, function(items) {
    var mementoTimeGateUrlList = items["mementoTimeGateUrlList"];
        
    for (var archiveName in mementoTimeGateUrlList) {
        var cls = "";
        if (!items['mementoTimeGateUrl'] && archiveName == "Memento Aggregator (recommended)") {
            $("#optionsCurrentlyUsedArchiveUrl").empty();
            $("#optionsCurrentlyUsedArchiveUrl").append(chrome.i18n.getMessage("optionsCurrentlyUsedArchiveUrl", [archiveName, mementoTimeGateUrlList[archiveName]]));
            cls = " ui-selected";
        }
        else if (mementoTimeGateUrlList[archiveName] == items["mementoTimeGateUrl"]) {
            selectedArchiveName = archiveName;
            $("#optionsCurrentlyUsedArchiveUrl").empty();
            $("#optionsCurrentlyUsedArchiveUrl").append(chrome.i18n.getMessage("optionsCurrentlyUsedArchiveUrl", [archiveName, mementoTimeGateUrlList[archiveName]]));
            cls = " ui-selected";
        }
        $("#selectable").append("<li class='ui-widget-content"+cls+"'>"+archiveName+"</li>");
    }
    $( "#selectable li" ).click( function() {
        $(this).addClass("ui-selected").siblings().removeClass("ui-selected")
    })
})

$(function() {
    $("#optionsTitle").append(chrome.i18n.getMessage("optionsTitle"))
    $("#optionsArchiveDescription").append(chrome.i18n.getMessage("optionsArchiveDescription"))
    $("#optionsCurrentlyUsedArchiveTitle").append(chrome.i18n.getMessage("optionsCurrentlyUsedArchiveTitle"))
    $("#optionsSelectArchiveTitle").append(chrome.i18n.getMessage("optionsSelectArchiveTitle"))
    
    $("#optionsUpdateButtonText")
        .append(chrome.i18n.getMessage("optionsUpdateButtonText"))
        .button()
        .click( function(event) {
            event.preventDefault()
            $("#userTimeGateError").empty()
            $("#userTimeGateError").removeClass("ui-state-error ui-corner-all")

            var timegateUrl = ""
            var userTimeGate = $("#userTimeGate")[0].value
            if (userTimeGate.trim() != "") {
                var userTimeGateLen = userTimeGate.length
                if (userTimeGate.search("http://") != 0 && userTimeGate.search("https://") != 0 || userTimeGate[userTimeGateLen-1] != "/") {
                    $("#userTimeGateError").append(chrome.i18n.getMessage("optionsUnlistedArchiveUrlError"))
                    $("#userTimeGateError").addClass("ui-state-error ui-corner-all")
                    return
                }
                timegateUrl = userTimeGate
                $("#optionsCurrentlyUsedArchiveUrl").empty()
                $("#optionsCurrentlyUsedArchiveUrl").append(chrome.i18n.getMessage("optionsCurrentlyUsedArchiveUrl", ["Unlisted Archive", timegateUrl]))
                chrome.storage.local.set({'mementoTimeGateUrl': timegateUrl})
            }

            if (timegateUrl == "") {
                var archiveName = $( "#selectable .ui-selected" ).text();
                chrome.storage.local.get("mementoTimeGateUrlList", function(item) {
                    $("#optionsCurrentlyUsedArchiveUrl").empty();
                    $("#optionsCurrentlyUsedArchiveUrl").append(chrome.i18n.getMessage("optionsCurrentlyUsedArchiveUrl", [archiveName, item["mementoTimeGateUrlList"][archiveName]]));
                    timegateUrl = item["mementoTimeGateUrlList"][archiveName];
                    chrome.storage.local.set({'mementoTimeGateUrl': timegateUrl})
                });
            }
        })
});
