$(document).ready(function() {
	LoadOptions();

	$("#save").click(SaveOptions);
	
	$("#radios-urls").append(
		"<p><input type='text' id='new-radio-name' class='site' placeholder='Radio Name' /> "
		+ "<input type='text' id='new-radio-url' class='site' placeholder='URL' /> "
		+ "<button id='add-site'>+</button></p>"
	);
	
	$("#add-site").click(function() {
		var new_radio_name = $("#new-radio-name").val();
		var new_radio_url = $("#new-radio-url").val();
		
		chrome.storage.local.get(['radios_urls'], function(res) {
            var radios_urls = res.radios_urls || [];
            
            radios_urls.push({"title" : new_radio_name, "url" : new_radio_url});
            chrome.storage.local.set({'radios_urls': radios_urls}, function() {
                var i = radios_urls.length - 1;
                $("#stored-urls").append("<p><div class='url'>" + new_radio_name + "</div> <div class='url'>" + new_radio_url + "</div> <button id='del-" + i + "' data-index='"+i+"'>-</button></p>");
                $("#del-" + i).click(DeleteURL);
                
                $("#new-radio-name").val("");
                $("#new-radio-url").val("");
                
                Notify("URL Added");
            });
		});
	});
});

function LoadOptions() {
	$("#radios-urls").append("<div id='stored-urls'></div>");

    chrome.storage.local.get(['radios_urls'], function(res) {
        if(res.radios_urls) {
            var urls = res.radios_urls;
            for(var i = 0; i < urls.length; i++) {
                var title = urls[i].title || urls[i]["radio-name"];
                var url = urls[i].url || urls[i]["radio-url"];
                $("#stored-urls").append("<p><label class='site'>" + title + "</label> <button id='del-" + i + "' data-index='"+i+"'>-</button></p>");
                $("#del-" + i).on('click', DeleteURL);
            }
        }
    });
}

function SaveOptions() {
	Notify();
}

function DeleteURL() {
	var index = $(this).data("index");
	$(this).parent().remove();
	
	chrome.storage.local.get(['radios_urls'], function(res) {
        if (res.radios_urls) {
            res.radios_urls.splice(index, 1);
            chrome.storage.local.set({'radios_urls': res.radios_urls}, function() {
                Notify("Site Deleted");
                
                // Re-render to fix indices
                $("#stored-urls").empty();
                for(var i = 0; i < res.radios_urls.length; i++) {
                    var title = res.radios_urls[i].title || res.radios_urls[i]["radio-name"];
                    $("#stored-urls").append("<p><label class='site'>" + title + "</label> <button id='del-" + i + "' data-index='"+i+"'>-</button></p>");
                    $("#del-" + i).on('click', DeleteURL);
                }
            });
        }
    });
}

function Notify(message) {
	if(message) {
		$("#ShowNotification").html(message);
	} else {
		$("#ShowNotification").html("Saved Successfully");
	}
	$("#ShowNotification").fadeIn().delay(800).fadeOut();
}