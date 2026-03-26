const audio = document.getElementById('audio');

let pendingResumeTime = 0;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'play') {
        if (audio.src !== message.url) {
            if (!audio.paused) audio.pause();
            audio.src = message.url;
            pendingResumeTime = message.resumeTime || 0;
            audio.load();
        } else if (message.resumeTime && audio.currentTime < 1) {
            audio.currentTime = message.resumeTime;
        }
        audio.play()
            .then(() => sendResponse({ success: true }))
            .catch(err => sendResponse({ success: false, error: err.message }));
        return true; 
    } else if (message.action === 'stop') {
        audio.pause();
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

audio.addEventListener('canplay', () => {
    if (pendingResumeTime > 0) {
        audio.currentTime = pendingResumeTime;
        pendingResumeTime = 0;
    }
});

// Periodically push currentTime to storage
setInterval(() => {
    if (!audio.paused && audio.src && audio.duration > 0) {
        chrome.runtime.sendMessage({ action: 'sync_time', currentTime: audio.currentTime });
    }
}, 5000);

audio.addEventListener('pause', () => {
    if (audio.src && audio.duration > 0) {
        chrome.runtime.sendMessage({ action: 'sync_time', currentTime: audio.currentTime });
    }
});
