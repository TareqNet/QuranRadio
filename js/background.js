let creating; // A global promise to avoid race conditions

async function setupOffscreenDocument(path) {
    const offscreenUrl = chrome.runtime.getURL(path);
    const existingContexts = await chrome.runtime.getContexts({
        contextTypes: ['OFFSCREEN_DOCUMENT'],
        documentUrls: [offscreenUrl]
    });

    if (existingContexts.length > 0) {
        return;
    }

    if (creating) {
        await creating;
    } else {
        creating = chrome.offscreen.createDocument({
            url: path,
            reasons: ['AUDIO_PLAYBACK'],
            justification: 'Playing Quran Radio audio in the background'
        });
        await creating;
        creating = null;
    }
}

// Function to fetch default radios
async function initRadios() {
    return new Promise((resolve) => {
        chrome.storage.local.get(['radios_urls', 'firstTime'], async (result) => {
            if (result.firstTime !== false || !result.radios_urls) {
                try {
                    let response = await fetch("https://labs.tareq.tk/QuranRadio/data/radios.json");
                    if (!response.ok) throw new Error("Online fetch failed");
                    let data = await response.json();
                    
                    await chrome.storage.local.set({
                        radios_urls: data,
                        firstTime: false,
                        url: data[0].url,
                        title: data[0].title
                    });
                    resolve(data);
                } catch (e) {
                    let response = await fetch(chrome.runtime.getURL("data/radios.json"));
                    let data = await response.json();
                    
                    await chrome.storage.local.set({
                        radios_urls: data,
                        firstTime: false,
                        url: data[0].url,
                        title: data[0].title
                    });
                    resolve(data);
                }
            } else {
                resolve(result.radios_urls);
            }
        });
    });
}

// Initialize on install or startup
chrome.runtime.onInstalled.addListener(() => {
    initRadios();
});
chrome.runtime.onStartup.addListener(() => {
    initRadios();
});

// Handle messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'play') {
        setupOffscreenDocument('offscreen.html').then(() => {
            chrome.runtime.sendMessage({
                action: 'play',
                url: message.url
            }, (response) => {
                chrome.action.setBadgeBackgroundColor({color: "#187700"});
                chrome.action.setBadgeText({text: "►"});
                chrome.action.setTitle({title: "Quran Radio - " + message.title});
                
                chrome.storage.local.set({
                    url: message.url,
                    title: message.title,
                    playing: true
                });
                
                sendResponse(response);
            });
        });
        return true; 
    } else if (message.action === 'stop') {
        setupOffscreenDocument('offscreen.html').then(() => {
            chrome.runtime.sendMessage({action: 'stop'}, (response) => {
                chrome.action.setBadgeText({text: ""});
                chrome.action.setTitle({title: "Quran Radio"});
                
                chrome.storage.local.set({ playing: false });
                sendResponse(response);
            });
        });
        return true;
    } else if (message.action === 'getDataStatus') {
        initRadios().then((data) => {
            sendResponse({ data: data });
        });
        return true;
    }
});