let audio = null;
let currentUrl = "";

function createAudioElement() {
    if (audio) {
        audio.onpause = null;
        audio.onerror = null;
        audio.onended = null;
        audio.pause();
        audio.removeAttribute('src');
        audio.load();
        audio.remove();
    }
    
    const newAudio = document.createElement('audio');
    document.body.appendChild(newAudio);
    
    newAudio.onended = () => {
        chrome.runtime.sendMessage({ action: 'track_ended' });
    };

    newAudio.onerror = () => {
        if (newAudio.error && newAudio.error.code === 1) return;
        console.error("Audio streaming error. Code:", newAudio.error ? newAudio.error.code : "N/A");
        chrome.runtime.sendMessage({ action: 'track_ended' });
    };

    newAudio.onpause = () => {
        if (newAudio.src && newAudio.duration > 0) {
            chrome.runtime.sendMessage({ action: 'sync_time', currentTime: newAudio.currentTime });
        }
    };

    return newAudio;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'play') {
        const baseUrl = message.url.split('#')[0]; // Strip fragments just in case

        if (currentUrl !== baseUrl || !audio) {
            audio = createAudioElement();
            currentUrl = baseUrl;
            audio.src = baseUrl; // Pure URL
            
            if (message.resumeTime > 0) {
                // Ultimate Seek Fallback: Wait until audio engine physically decodes and moves the playhead
                const forceSeek = () => {
                    if (audio.currentTime > 0.05) {
                        audio.removeEventListener('timeupdate', forceSeek);
                        try {
                            audio.currentTime = message.resumeTime;
                        } catch(e) { }
                    }
                };
                audio.addEventListener('timeupdate', forceSeek);
            }
            audio.load();
        } else if (message.resumeTime > 0 && audio.currentTime < 1) {
            try { audio.currentTime = message.resumeTime; } catch(e) {}
        }
        
        audio.play()
            .then(() => sendResponse({ success: true }))
            .catch(err => sendResponse({ success: false, error: err.message }));
            
        return true; 
    } else if (message.action === 'stop') {
        if (audio) audio.pause();
        sendResponse({ success: true });
        return false;
    } else if (message.action === 'status') {
        sendResponse({ playing: audio && !audio.paused && audio.src !== "", src: audio ? audio.src : "" });
        return false;
    }
});

// Periodically push currentTime to storage
setInterval(() => {
    if (audio && !audio.paused && audio.src && audio.duration > 0) {
        chrome.runtime.sendMessage({ action: 'sync_time', currentTime: audio.currentTime });
    }
}, 5000);
