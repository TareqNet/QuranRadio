let creating;

async function setupOffscreenDocument(path) {
    const offscreenUrl = chrome.runtime.getURL(path);
    const existingContexts = await chrome.runtime.getContexts({
        contextTypes: ['OFFSCREEN_DOCUMENT'],
        documentUrls: [offscreenUrl]
    });

    if (existingContexts.length > 0) return;

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

function zeroPad(num, places) {
    return String(num).padStart(places, '0');
}

// Fetch helper wrapper for MP3Quran V3
async function fetchMP3Quran(endpoint, lang = null) {
    const res = await chrome.storage.local.get(['user_lang']);
    const userLang = res.user_lang || 'ar';
    let locale = lang || userLang;
    if (locale === 'en') locale = 'eng';
    
    const url = `https://mp3quran.net/api/v3/${endpoint}?language=${locale}`;
    try {
        const response = await fetch(url);
        if(!response.ok) throw new Error("API Network request failed");
        return await response.json();
    } catch (e) {
        console.error("fetchMP3Quran error:", e);
        return null;
    }
}

chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.local.set({ playback_state: { playing: false } });
});
chrome.runtime.onStartup.addListener(() => {
    chrome.storage.local.set({ playback_state: { playing: false } });
});

// Update Badge UI
function updateUIBadge(isPlaying, title = "") {
    if (isPlaying) {
        chrome.action.setBadgeBackgroundColor({color: "#187700"});
        chrome.action.setBadgeText({text: "►"});
        chrome.action.setTitle({title: "Quran Radio - " + title});
    } else {
        chrome.action.setBadgeText({text: ""});
        chrome.action.setTitle({title: "Quran Radio"});
    }
}

async function playUrl(url, title, stateData = null) {
    await setupOffscreenDocument('offscreen.html');
    return new Promise((resolve) => {
        chrome.runtime.sendMessage({ action: 'play', url: url }, (response) => {
            updateUIBadge(true, title);
            const newState = { playing: true, url: url, title: title };
            if (stateData) Object.assign(newState, stateData);
            chrome.storage.local.set({ playback_state: newState }, () => {
                resolve(response);
            });
        });
    });
}

async function stopAudio() {
    await setupOffscreenDocument('offscreen.html');
    return new Promise((resolve) => {
        chrome.runtime.sendMessage({ action: 'stop' }, (response) => {
            updateUIBadge(false);
            chrome.storage.local.get(['playback_state'], (res) => {
                if(res.playback_state) {
                    res.playback_state.playing = false;
                    chrome.storage.local.set({ playback_state: res.playback_state }, resolve);
                } else resolve();
            });
        });
    });
}

// Handle messages from UI and Offscreen
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'play_radio') {
        playUrl(message.url, message.title, { type: 'radio', subtitle: "" }).then(sendResponse);
        return true; 
        
    } else if (message.action === 'play_surah') {
        const stateData = {
            type: 'surah',
            baseServer: message.baseServer,
            surahList: message.surahList,
            currentSurahId: message.surahId,
            subtitle: message.subtitle,
            repeatCount: parseInt(message.repeatCount) || 0,
            autoNext: message.autoNext === true
        };
        let url = message.baseServer;
        if (!url.endsWith('/')) url += '/';
        url += zeroPad(message.surahId, 3) + '.mp3';
        playUrl(url, message.title, stateData).then(sendResponse);
        return true;
        
    } else if (message.action === 'stop') {
        stopAudio().then(sendResponse);
        return true;
        
    } else if (message.action === 'status') {
        chrome.runtime.sendMessage({ action: 'get_status' }, (res) => {
            if (chrome.runtime.lastError) {
                sendResponse({ playing: false });
            } else {
                sendResponse(res || { playing: false });
            }
        });
        return true;
    } else if (message.action === 'track_ended') {
        // Handle Repeat and Auto-Next logic
        chrome.storage.local.get(['playback_state', 'user_lang'], async (res) => {
            const state = res.playback_state;
            if (state && state.type === 'surah' && state.playing) {
                // Check repeat
                if (state.repeatCount > 0) {
                    state.repeatCount -= 1;
                    const url = state.baseServer + zeroPad(state.currentSurahId, 3) + '.mp3';
                    await playUrl(url, state.title, state); // re-save updated state
                } 
                // Check auto-next
                else if (state.autoNext && state.surahList) {
                    const currentIndex = state.surahList.indexOf(String(state.currentSurahId));
                    if (currentIndex !== -1) {
                        let nextIndex = currentIndex + 1;
                        if (nextIndex >= state.surahList.length) {
                            nextIndex = 0; // Loop back to start
                        }
                        const nextSurahId = parseInt(state.surahList[nextIndex]);
                        
                        // Try to find the new Surah name for the title
                        let newTitle = state.title; 
                        const lang = res.user_lang || 'ar';
                        const cKey = `api_${lang}_suwar`;
                        const suwarCache = await chrome.storage.local.get([cKey]);
                        let cachedSuwar = suwarCache[cKey] ? suwarCache[cKey].suwar : [];
                        if (!cachedSuwar || cachedSuwar.length === 0) {
                            const data = await fetchMP3Quran('suwar', lang);
                            cachedSuwar = data ? data.suwar : [];
                        }
                        
                        if (cachedSuwar.length > 0) {
                            const surahObj = cachedSuwar.find(s => s.id === nextSurahId);
                            if (surahObj) {
                                const surahLabel = lang === 'ar' ? 'سورة' : 'Surah';
                                newTitle = `${surahLabel} ${surahObj.name}`;
                            }
                        }
                        
                        let url = state.baseServer;
                        if (!url.endsWith('/')) url += '/';
                        url += zeroPad(nextSurahId, 3) + '.mp3';
                        state.currentSurahId = nextSurahId;
                        state.title = newTitle;
                        
                        await playUrl(url, newTitle, state);
                    } else {
                        updateUIBadge(false);
                    }
                } else {
                    // No repeat, no auto-next -> Just stop UI
                    updateUIBadge(false);
                    state.playing = false;
                    chrome.storage.local.set({ playback_state: state });
                }
            } else {
                updateUIBadge(false);
            }
        });
        sendResponse({handled: true});
        return false;
    }
});