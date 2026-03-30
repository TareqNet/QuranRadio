let audio = null;
let currentUrl = "";
let retryCount = 0;

function createAudioElement() {
    if (audio) {
        audio.onpause = null;
        audio.onerror = null;
        audio.onended = null;
        audio.onwaiting = null;
        audio.onplaying = null;
        audio.pause();
        audio.src = '';
        audio.removeAttribute('src');
        audio.load();
        audio.remove();
        audio = null;
    }
    
    const newAudio = document.createElement('audio');
    document.body.appendChild(newAudio);
    
    let stalledTimeout = null;

    newAudio.onended = () => {
        retryCount = 0;
        chrome.runtime.sendMessage({ action: 'track_ended' });
    };

    newAudio.onerror = () => {
        if (newAudio.error && newAudio.error.code === 1) return; // User aborted
        
        const errorCode = newAudio.error ? newAudio.error.code : 0;
        
        // Handle intermittent server issues (Code 4) with 5 retries
        if (errorCode === 4 && retryCount < 5) {
            retryCount++;
            chrome.runtime.sendMessage({ 
                action: 'playback_retry', 
                count: retryCount, 
                url: newAudio.src 
            });
            
            // Wait 5 seconds before retrying same URL
            setTimeout(() => {
                if (newAudio && newAudio.src) {
                    newAudio.load();
                    newAudio.play().catch(() => {});
                }
            }, 5000);
        } else {
            // Final failure after 5 attempts or a non-retryable error
            if (errorCode === 4) {
                chrome.runtime.sendMessage({ action: 'playback_failed_final' });
            }
            chrome.runtime.sendMessage({ action: 'track_ended' });
        }
    };

    const attemptReconnect = () => {
      if (newAudio && newAudio.src) {
        const url = newAudio.src;
        const time = newAudio.currentTime;
        newAudio.load();
        if (time > 0) newAudio.currentTime = time;
        newAudio.play().catch(e => {});
      }
    };

    newAudio.onwaiting = () => {
      stalledTimeout = setTimeout(attemptReconnect, 10000); // 10s wait before forcing reconnect
    };
    newAudio.onplaying = () => {
      retryCount = 0; // Success! Reset the counter
      if (stalledTimeout) clearTimeout(stalledTimeout);
    };

    newAudio.onpause = () => {
        if (newAudio.src && newAudio.duration > 0 && newAudio.duration !== Infinity) {
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
        if (audio) {
            audio.pause();
            // If it's a radio stream, destroy the element completely to prevent background buffering
            if (audio.duration === Infinity || !audio.duration) { 
               audio.removeAttribute('src');
               audio.load();
               audio.remove();
               audio = null;
               currentUrl = "";
            }
        }
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
