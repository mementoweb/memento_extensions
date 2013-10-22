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


$( function() {
    Timemap.getTimeGateFromStorage()
})

var Timemap = {

    visitedTimemaps: [],
    mementoCount: 0,
    archiveCount: {},
    timemapPage: 0,
    aggregatorTimeGateUrl: "http://mementoproxy.lanl.gov/aggr/timegate/",
    aggregatorTimeMapUrl: "http://mementoproxy.lanl.gov/aggr/timemap/link/1/",
    preferredTimeGateUrl: false,

    createTimeMapHtmlLayout: function() {
        var html = []
        html.push("<div>")
        html.push('<div class="ui-widget-header ui-corner-top module_heading overview_module">')
        html.push('<span class="ui-icon ui-icon-circle-minus" style="display: inline-block; float: left;"></span>')
        html.push('Overview')
        html.push('</div>')
        html.push('<div class="module-content ui-widget-content ui-corner-bottom" id="timemap_overview">')
        html.push('</div>')
        html.push('</div>')
        html.push('<div>')
        html.push('<div class="ui-widget-header ui-corner-top module_heading statistics_module">')
        html.push('<span class="ui-icon ui-icon-circle-minus" style="display: inline-block; float: left;"></span>')
        html.push('Statistics')
        html.push('</div>')
        html.push('<div class="module-content ui-widget-content ui-corner-bottom" id="archive_stats">')
        html.push('</div>')
        html.push('</div>')
        html.push('<div>')
        html.push('<div class="ui-widget-header ui-corner-top module_heading">')
        html.push('<span class="ui-icon ui-icon-circle-minus" style="display: inline-block; float: left;"></span>')
        html.push('Mementos')
        html.push('</div>')
        html.push('<div class="module-content ui-widget-content ui-corner-bottom" id="mementos">')
        html.push('</div>')
        html.push('</div>')

        $("body").empty()
        $("body").append(html.join(''))

        // hiding overview and statistic modules on page load
        var overview = $(".overview_module")
        overview.next().hide()
        $(overview.children()[0]).switchClass("ui-icon-circle-minus", "ui-icon-circle-plus");
        overview.removeClass("ui-widget-header");
        overview.addClass("ui-corner-bottom");
        overview.addClass("ui-accordion-header")
        overview.addClass("ui-state-default")

        var statistics = $(".statistics_module")
        statistics.next().hide()
        $(statistics.children()[0]).switchClass("ui-icon-circle-minus", "ui-icon-circle-plus");
        statistics.removeClass("ui-widget-header");
        statistics.addClass("ui-corner-bottom");
        statistics.addClass("ui-accordion-header")
        statistics.addClass("ui-state-default")

        $(".module_heading").click( function(event) {
            var panel = $(this).next();
            var isOpen = panel.is(":visible");

            panel[isOpen? 'slideUp': 'slideDown']()
            .trigger(isOpen? 'hide': 'show');

            if (isOpen) {
                $($(this).children()[0]).switchClass("ui-icon-circle-minus", "ui-icon-circle-plus");
                $(this).removeClass("ui-widget-header");
                $(this).addClass("ui-corner-bottom");
                $(this).addClass("ui-accordion-header")
                $(this).addClass("ui-state-default")
            }
            else {
                $($(this).children()[0]).switchClass("ui-icon-circle-plus", "ui-icon-circle-minus");
                $(this).addClass("ui-widget-header");
                $(this).removeClass("ui-corner-bottom");
                $(this).removeClass("ui-accordion-header")
                $(this).removeClass("ui-state-default")
            }

            return false;
        });
    },

    getTimeGateFromStorage: function() {
        chrome.storage.local.get(null, function(items) {
            if (items["mementoTimeGateUrl"]) {
                Timemap.preferredTimeGateUrl = items["mementoTimeGateUrl"]
            }
            else {
                Timemap.preferredTimeGateUrl = Timemap.aggregatorTimeGateUrl
            }
            var locUrl = document.location.href
            var reqUrl = unescape(MementoUtils.getUrlParameter(locUrl, "org_url"))
            if (!reqUrl || reqUrl == "undefined") {
                return
            }

            var r = new MementoHttpRequest()
            r.doHttp(reqUrl, false, function(reqHeadResponse) {
                Timemap.headRequest(reqUrl, reqHeadResponse)
            })
        })
    },

    getArchiveIcon: function(url, incrementCounts) {
        archiveIcons = {};
        archiveIcons["http://web.archive.org/web/"] = "img/archives/internet-archive.png";
        archiveIcons["http://wayback.archive-it.org/"] = "img/archives/archive-it.png";
        archiveIcons["http://webarchive.nationalarchives.gov.uk/"] = "img/archives/ukna.png";
        archiveIcons["http://www.webarchive.org.uk"] = "img/archives/ukwa.png";
        archiveIcons["http://archive.is/"] = "img/archives/archive-is.png";
        archiveIcons["http://webarchive.loc.gov/"] = "img/archives/loc.png";
        archiveIcons["http://wayback.vefsafn.is/"] = "img/archives/icelandic-archive.png";
        archiveIcons["http://wayback.webarchiv.cz/"] = "img/archives/czech-archive.png";
        archiveIcons["native"] = "img/archives/default.png";
        for (baseUrl in archiveIcons) {
            if (url.search(baseUrl) >= 0) {
                if (incrementCounts) {
                    if (!this.archiveCount[baseUrl])
                        this.archiveCount[baseUrl] = 0
                    this.archiveCount[baseUrl]++ 
                }
                return archiveIcons[baseUrl]
            }
        }
        if (incrementCounts) {
            if (!this.archiveCount["native"])
                this.archiveCount["native"] = 0
            this.archiveCount["native"]++
        }
        return archiveIcons["native"]
    },

    createArchiveStatisticsHtml: function() {

        var acHtml = []
        for (baseUrl in this.archiveCount) {
            acHtml.push("<div class='archive'>")
            acHtml.push("<span class='archive_icon'><img alt='"+baseUrl+"' title='"+baseUrl+"' src='"+this.getArchiveIcon(baseUrl)+"'/></span>")
            acHtml.push("<span class='archive_basurl'><i>"+baseUrl+"</i></span>");
            acHtml.push("<span class='archive_count'><b>"+this.archiveCount[baseUrl]+"</b></span>")
            acHtml.push("</div>");
        }
        return acHtml.join("")
    },

    parseTimemap : function(link) {
        var state = 'start';
        if (link.split("\n").length > 5000) {
            console.log(link.split("\n").length)
            return false;
        }
            
        var data = link.split('');
        var uri = '';
        var pt = '';
        var pv = '';
        var d = '';

        var mems = [];
        var meta = [];
        var memHtml = [];

        while (data.length) {
            if (state == 'start') {
                if (memHtml.length == 4) {
                    mems.push(memHtml.join(""))

                    if (mems.length % 500 == 0) {
                        $("#mementos").append(mems.join(""))

                        $("#archive_stats").empty()
                        $("#archive_stats").append(this.createArchiveStatisticsHtml())
                        mems = []
                    }
                }
                memHtml = [];
                d = data.shift();
                while (d.match(/\s/)) d = data.shift();
                if (d != "<") break;
                state = "uri";
            } else if (state == "uri") {
                uri = '';
                d = data.shift();
                while (d != ">") {
                    uri += d;
                    d = data.shift();
                }

                // Check for broken header with a > in the URL
                uritmp = '>';
                d = data.shift();
                while (d.match(/\s/)) {
                    uritmp += d;
                    d = data.shift();
                }
                // Now d is the first non space character, and should be either , or ;
                if (d == ',' || d ==';'){
                    // We're okay
                    state = "paramstart";
                } else{
                    // stay in state uri, and continue to append
                    uritmp+=d;
                    uri += uritmp;
                }
            } else if (state == 'paramstart') {
                while (d.match(/\s/) != null) d = data.shift();
                if (d == ";") state = 'linkparam';
                else if (d == ',') state = 'start';
                else break
            } else if (state == 'linkparam') {
                d = data.shift();
                while (d.match(/\s/) != null) d = data.shift();
                pt = '';
                while (data.length && d != ' ' && d != '=') {
                    pt += d;
                    d = data.shift();
                }
                while (d.match(/\s/) != null) d = data.shift();
                if (d != "=") break
                state='linkvalue';
            } else if (state == 'linkvalue') {
                d = data.shift();
                while (d.match(/\s/) != null) d = data.shift();
                pv = '';
                if (d == '"') {
                    pd = d;
                    d = data.shift();
                    while (d != undefined && d != '"' && pd != '\\') {
                        pv += d;
                        pd = d;
                        d = data.shift();
                    }
                } else {
                    while (d != undefined && d != " " && d != ',' && d != ';') {
                        pv += d;
                        d = data.shift();
                    }
                    if (data.length) data.unshift(d);
                }
                state = 'paramstart';
                if(data != undefined){
                    d = data.shift();
                }

                if (pv.search("memento") >= 0) {
                    this.mementoCount++
                    var icon = "<span class='memento_icon'><img src='"+this.getArchiveIcon(uri, true)+"' /></span>";
                    var html = ""
                    if (this.mementoCount % 2 == 0) {
                        memHtml.push("<div class='memento even'>")
                    }
                    else {
                        memHtml.push("<div class='memento odd'>")
                    }
                    memHtml.push("<span class='memento_count'>"+this.mementoCount+":</span>");
                    memHtml.push(icon+"<a href=\""+uri+"\" target=\"_blank\">");
                }
                if (pt == "datetime") {
                    memHtml.push(pv + "</a></div>");
                }
                if (pv == "original" && this.timemapPage == 0) {
                    meta.push("<div class='timemap_meta'>")
                    meta.push("<span class='meta_label'>Original URL: </span>")
                    meta.push("<span class='meta_link'>")
                    meta.push("<a href=\""+uri+"\" target=\"_blank\">"+uri+"</a>")
                    meta.push("</span></div>")
                }
                if (pv == "timegate" && this.timemapPage == 0) {
                    meta.push("<div class='timemap_meta'>")
                    meta.push("<span class='meta_label'>TimeGate URL: </span>")
                    meta.push("<span class='meta_link'>")
                    meta.push("<a href=\""+uri+"\" target=\"_blank\">"+uri+"</a>")
                    meta.push("</span></div>")
                }
                if (pv == "self") {
                    meta.push("<div class='timemap_meta'>")
                    meta.push("<span class='meta_label'>Download TimeMap "+(parseInt(this.timemapPage) + 1).toString()+": </span>")
                    meta.push("<span class='meta_link'>")
                    meta.push("<a href=\""+uri+"\" target=\"_blank\">"+uri+"</a>")
                    meta.push("</span></div>")
                }
                if (pv == "timemap") {
                    this.timemapPage++
                    this.getTimemap(uri)
                }
            }
        }
        $("#mementos").append(mems.join(""))
        $("#timemap_overview").append(meta.join(""))

        $("#archive_stats").empty()
        $("#archive_stats").append(this.createArchiveStatisticsHtml())
        return true;
    },

    headRequest: function(reqUrl, reqHeadResponse) {

        var orgUrl = MementoUtils.getRelUriFromHeaders(reqHeadResponse.getAllResponseHeaders(), "original")
        if (!orgUrl) {
            orgUrl = reqUrl;
        }

        console.log("Original url: " + orgUrl)

        var r = new MementoHttpRequest()
        r.doHttp(orgUrl, false, function(orgHeadResponse) {
            var timegateUrl = MementoUtils.getRelUriFromHeaders(orgHeadResponse.getAllResponseHeaders(), "timegate")
            Timemap.headTimegate(orgUrl, timegateUrl)
        })
    },

    headTimegate: function(orgUrl, timegateUrl) {
        if (!timegateUrl) {
            if (!this.preferredTimeGateUrl) {
            }
            timegateUrl = this.preferredTimeGateUrl + orgUrl
            if (timegateUrl.search(this.aggregatorTimeGateUrl) == 0) {
                this.getTimemap(this.aggregatorTimeMapUrl + orgUrl)
                return
            }
        }
        if (!timegateUrl) {
            this.sendError("notimemap")
            return
        }
        console.log("Timegate url: " + timegateUrl)

        var r = new MementoHttpRequest()
        r.doHttp(timegateUrl, false, function(tgHeadResponse) {
            var timemapUrl = MementoUtils.getRelUriFromHeaders(tgHeadResponse.getAllResponseHeaders(), "timemap")
            if (!timemapUrl) {
                Timemap.sendError("notimemap")
                return
            }
            Timemap.getTimemap(timemapUrl)
        })
    },

    getTimemap: function(timemapUrl) {

        if (!timemapUrl) {
            return
        }
        for (var i=0, u; u=this.visitedTimemaps[i]; i++) {
            if (u == timemapUrl) {
                return
            }
        }
        this.visitedTimemaps.push(timemapUrl)

        var r = new MementoHttpRequest()
        r.doHttp(timemapUrl, false, function(tmResponse) {
            console.log("Timemap url: " + timemapUrl)
            Timemap.processTimemap(timemapUrl, tmResponse)
        }, "GET", true)
    },

    processTimemap: function(timemapUrl, tmResponse) {
        if (tmResponse.status == 200) {
            if (this.timemapPage == 0) {
                this.createTimeMapHtmlLayout()
            }
            var timemap = this.parseTimemap(tmResponse.responseText)
            if (!timemap) {
                this.sendError("largetimemap", timemapUrl)
            }
        }
        else {
            this.sendError("resourcenotarchived")
        }
    },

    sendError: function(type, timemapUrl) {
        var error = ""
        if (type == "notimemap") {
            error += "<div class='ui-state-error ui-corner-all timemap_error'>"
            error += "No TimeMap was found for this resource."
            error += "</div>"
        }
        else if (type == "largetimemap") {
            error += "<div class='ui-state-error ui-corner-all timemap_error'>"
            error += "The TimeMap for this resource is too large to process.<br/> You may download the TimeMap directly from the link below.<br/>"
            error += "<a href=\""+timemapUrl+"\" target=\"_blank\" >"+timemapUrl+"</a>";
            error += "</div>"
        }
        else if (type == "resourcenotarchived") {
            error += "<div class='ui-state-error ui-corner-all timemap_error'>"
            error += "No mementos found for the URL requested."
            error += "</div>"
        }
        else {

        }
        $("body").empty()
        $("body").append(error)
    }

}
