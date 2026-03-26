const audio = document.getElementById('audio');

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'play') {
        audio.src = message.url;
        audio.play()
            .then(() => sendResponse({ success: true }))
            .catch(err => sendResponse({ success: false, error: err.message }));
        return true; // Keep message channel open for async response
    } else if (message.action === 'stop') {
        audio.pause();
        audio.currentTime = 0;
        sendResponse({ success: true });
        return false;
    } else if (message.action === 'status') {
        sendResponse({ playing: !audio.paused && audio.src !== "", src: audio.src });
        return false;
    }
});
