var control;
var currentUrl;
var currentTitle;

$(document).ready(function() {
    control = $("#control");

    // Initialize from storage
    chrome.storage.local.get(['radios_urls', 'url', 'title', 'playing'], function(res) {
        if (!res.radios_urls) {
             chrome.runtime.sendMessage({action: 'getDataStatus'}, function(response) {
                 if(response && response.data) {
                    renderRadios(response.data);
                 }
             });
        } else {
            renderRadios(res.radios_urls);
            currentUrl = res.url;
            currentTitle = res.title;
            $("#title").html(currentTitle);

            if (res.playing) {
                control.attr("src", "Icons/pause.png");
            } else {
                control.attr("src", "Icons/play.png");
            }
        }
    });

    control.click(function() {
        if ($(this).attr("src") === "Icons/play.png") {
            play(currentUrl, currentTitle);
        } else {
            stop();
        }
    });
});

function renderRadios(radios_array) {
    var radios_list = $("#radios-list");
    radios_list.empty();
    for (var i = 0; i < radios_array.length; i++) {
        var url = radios_array[i]["url"];
        var title = radios_array[i]["title"];
        if (!url && radios_array[i]["radio-url"]) url = radios_array[i]["radio-url"];
        if (!title && radios_array[i]["radio-name"]) title = radios_array[i]["radio-name"];

        radios_list.append("<li class='radio-list' data-title='" + title + "' data-url='" + url + "'>" + title + "</li>");
    }

    $(".radio-list").click(function() {
        var url = $(this).data("url");
        var title = $(this).data("title");
        play(url, title);
    });
}

function play(url, title) {
    if (!url) return;
    currentUrl = url;
    currentTitle = title;
    $("#title").html(title);
    control.attr("src", "Icons/pause.png");

    chrome.runtime.sendMessage({
        action: 'play',
        url: url,
        title: title
    });
}

function stop() {
    control.attr("src", "Icons/play.png");
    chrome.runtime.sendMessage({ action: 'stop' });
}