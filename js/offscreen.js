const audio = document.getElementById('audio');

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'play') {
        if (audio.src !== message.url) {
            if (!audio.paused) audio.pause();
            audio.src = message.url;
            audio.load();
        }
        audio.play()
            .then(() => sendResponse({ success: true }))
            .catch(err => sendResponse({ success: false, error: err.message }));
        return true; 
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

// Broadcast when the track ends to handle Repeat or Auto-next
audio.addEventListener('ended', () => {
    chrome.runtime.sendMessage({ action: 'track_ended' });
});

audio.addEventListener('error', () => {
    console.error("Audio streaming error. Skipping...");
    // Fallback: trigger track_ended so background skips to next seamlessly
    chrome.runtime.sendMessage({ action: 'track_ended' });
});
