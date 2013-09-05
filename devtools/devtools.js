var win
chrome.devtools.panels.create("Memento", "memento-16x16.png", "devtoolsPanel.html",
    function (extensionPanel) {
        extensionPanel.onShown.addListener(function(panelWindow) {
            win = panelWindow
            //panelWindow.document.body.appendChild(document.createTextNode(r))    
        })
    }
)
var r = ""
chrome.devtools.network.onRequestFinished.addListener( function(request) {
    //console.log(request)
    //win.document.body.appendChild(document.createTextNode(JSON.stringify(request)))    
    var table = "<table class='gridtable'>"
    chrome.devtools.network.getHAR( function(har) {
        console.log(har)
        if (har.entries.length == 0) {
            table = "<h3>Refresh the page to capture memento information</h3>"
            win.document.body.innerHTML = table    
        }
        table += "<tr>"
        table += "<th style='width: 100px;'>URL</th>"
        table += "<th style='width: 30px;'>Status</th>"
        table += "<th style='width: 200px;'>Request Headers</th>"
        table += "<th style='width: 200px;'>Response Headers</th>"
        table += "</tr>"
        har.entries.forEach( function(resource) {
            table += "<tr>"

            table += "<td>"
            table += resource.request.url.substring(0,60)
            table += "</td>"

            table += "<td>"
            table += resource.response.status
            table += "</td>"

            table += "<td>"
            resource.request.headers.forEach( function(header) {
                table += header.name + ": " + header.value + "<br/>"
            })
            table += "</td>"

            table += "<td>"
            resource.response.headers.forEach( function(header) {
                table += header.name + ": " + header.value + "<br/>"
            })
            table += "</td>"

            table += "</tr>"
        })
        table += "</table>"
        console.log(table)
        win.document.body.innerHTML = table
    })
})

