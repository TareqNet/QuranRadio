let audio = null;
let currentUrl = "";

function createAudioElement() {
    if (audio) {
        audio.pause();
        audio.removeAttribute('src'); // Forcibly detach media
        audio.load();
        audio.remove();
    }
    
    const newAudio = document.createElement('audio');
    document.body.appendChild(newAudio);
    
    newAudio.addEventListener('ended', () => {
        chrome.runtime.sendMessage({ action: 'track_ended' });
    });

    newAudio.addEventListener('error', () => {
        if (newAudio.error && newAudio.error.code === 1) {
            console.log("Stream actively replaced. Assuming safe overwrite.");
            return;
        }
        console.error("Audio streaming error. Code:", newAudio.error ? newAudio.error.code : "N/A");
        chrome.runtime.sendMessage({ action: 'track_ended' });
    });

    newAudio.addEventListener('pause', () => {
        if (newAudio.src && newAudio.duration > 0) {
            chrome.runtime.sendMessage({ action: 'sync_time', currentTime: newAudio.currentTime });
        }
    });

    return newAudio;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'play') {
        const baseUrl = message.url.split('#')[0];

        if (currentUrl !== baseUrl || !audio) {
            audio = createAudioElement();
            currentUrl = baseUrl;
            audio.src = (message.resumeTime && message.resumeTime > 0) ? `${baseUrl}#t=${message.resumeTime}` : baseUrl;
            audio.load();
        } else if (message.resumeTime && audio.currentTime < 1) {
            // Same track requested, fallback seek if paused remotely
            audio.currentTime = message.resumeTime;
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
