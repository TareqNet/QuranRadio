let userList = [];
let cachedSuwar = [];
let playbackState = { playing: false };
let allRadios = [];
let allReciters = [];

let selectedIndex = -1; // Index in userList

async function initI18n() {
    return new Promise((resolve) => {
        chrome.storage.local.get(['user_lang'], async (res) => {
            const lang = res.user_lang || 'ar'; 
            try {
                const url = chrome.runtime.getURL(`_locales/${lang}/messages.json`);
                const fetchRes = await fetch(url);
                const dict = await fetchRes.json();
                
                document.getElementById('html-root').dir = (lang === 'ar' || lang === 'fa') ? 'rtl' : 'ltr';
                document.title = dict.extName ? dict.extName.message : 'Quran Radio';
                
                document.querySelectorAll('[data-i18n]').forEach(el => {
                    const key = el.getAttribute('data-i18n');
                    if(dict[key]) el.innerText = dict[key].message;
                });
                
                resolve(lang);
            } catch(e) {
                console.error('i18n error', e);
                resolve('ar');
            }
        });
    });
}

function updatePlayButtonUI() {
    const btn = document.getElementById('btn-play-pause');
    if (playbackState.playing) {
        btn.src = 'Icons/pause.png';
    } else {
        btn.src = 'Icons/play.png';
    }
}

async function fetchAPI(endpoint, lang) {
    try {
        const apiLang = lang === 'en' ? 'eng' : lang;
        const res = await fetch(`https://mp3quran.net/api/v3/${endpoint}?language=${apiLang}`);
        return await res.json();
    } catch(e) {
        return null;
    }
}

async function loadData() {
    return new Promise(async (resolve) => {
        const res = await chrome.storage.local.get(['playback_state', 'user_list', 'user_lang']);
        
        if (res.playback_state) playbackState = res.playback_state;
        if (res.user_list) userList = res.user_list;
        
        let lang = res.user_lang || 'ar';
        const rKey = `api_${lang}_radios`;
        const cKey = `api_${lang}_reciters`;
        const sKey = `api_${lang}_suwar`;
        
        const allCaches = await chrome.storage.local.get([rKey, cKey, sKey]);
        
        if (allCaches[rKey] && allCaches[rKey].radios) {
            allRadios = allCaches[rKey].radios;
            allReciters = allCaches[cKey] ? allCaches[cKey].reciters : [];
        } else {
            const rData = await fetchAPI('radios', lang);
            allRadios = rData ? rData.radios : [];
            if (allRadios.length) chrome.storage.local.set({ [rKey]: {radios: allRadios} });
            
            const cData = await fetchAPI('reciters', lang);
            allReciters = cData ? cData.reciters : [];
            if (allReciters.length) chrome.storage.local.set({ [cKey]: {reciters: allReciters} });
        }
        
        if (allCaches[sKey] && allCaches[sKey].suwar) {
            cachedSuwar = allCaches[sKey].suwar;
        } else {
            const sData = await fetchAPI('suwar', lang);
            cachedSuwar = sData ? sData.suwar : [];
            if (cachedSuwar.length) chrome.storage.local.set({ [sKey]: {suwar: cachedSuwar} });
        }
        
        // Double-check real audio status securely to fix toggle bugs
        chrome.runtime.sendMessage({action: 'status'}, (statusRes) => {
            if (statusRes && typeof statusRes.playing !== 'undefined') {
                playbackState.playing = statusRes.playing;
                if (res.playback_state && res.playback_state.playing !== statusRes.playing) {
                    res.playback_state.playing = statusRes.playing;
                    chrome.storage.local.set({playback_state: res.playback_state});
                }
            }
            resolve();
        });
    });
}

function hydrateItem(item) {
    if (item.type === 'radio') {
        const r = allRadios.find(x => String(x.id) === String(item.id));
        if (r) { item.name = r.name; item.url = r.url; }
    } else if (item.type === 'reciter') {
        const r = allReciters.find(x => String(x.id) === String(item.id));
        if (r) {
            item.name = r.name;
            let mosh = item.moshafId ? r.moshaf.find(m => String(m.id) === String(item.moshafId)) : r.moshaf.find(m => m.server === item.server);
            if (mosh) {
                item.moshafName = mosh.name;
                item.server = mosh.server;
                item.surahList = mosh.surah_list;
                item.moshafId = mosh.id;
            }
        }
    }
    return item;
}

function renderUserList() {
    const ul = document.getElementById('user-list');
    const msg = document.getElementById('empty-list-msg');
    ul.innerHTML = '';
    
    if (userList.length === 0) {
        msg.style.display = 'block';
        return;
    }
    msg.style.display = 'none';

    userList.forEach((itemObj, index) => {
        const item = hydrateItem(itemObj); // Apply current language translations
        const li = document.createElement('li');
        
        const icon = item.type === 'radio' ? '📻' : '📖';
        const itemName = item.type === 'reciter' ? `${item.name} (${item.moshafName})` : item.name;
        li.innerText = `${icon} ${itemName}`;
        
        // Match active styling safely using ID or server URL to restore last selection (even if paused)
        const isActiveRadio = playbackState.type === 'radio' && item.type === 'radio' && playbackState.url === item.url;
        const isActiveReciter = playbackState.type === 'surah' && item.type === 'reciter' && playbackState.baseServer === item.server;
        
        if (isActiveRadio || isActiveReciter) {
            li.classList.add('active');
            selectedIndex = index;
        }

        li.onclick = () => selectItem(index, true); // true = forced click by user
        ul.appendChild(li);
    });
}

// forced parameter denotes if user actually clicked the list right now
function selectItem(index, forced = false) {
    selectedIndex = index;
    const item = userList[index];
    
    // UI Update
    const items = document.querySelectorAll('#user-list li');
    items.forEach(el => el.classList.remove('active'));
    if(items[index]) items[index].classList.add('active');

    const surahControls = document.getElementById('surah-controls');
    
    const isActiveRadio = playbackState.type === 'radio' && item.type === 'radio' && playbackState.url === item.url;
    const isActiveReciter = playbackState.type === 'surah' && item.type === 'reciter' && playbackState.baseServer === item.server;

    // Set title safely
    if (isActiveRadio || isActiveReciter) {
        if (playbackState.title) document.getElementById('now-playing-title').innerText = playbackState.title;
        const subLabel = document.getElementById('now-playing-subtitle');
        if (subLabel) {
            subLabel.innerText = playbackState.subtitle || "";
            subLabel.style.display = playbackState.subtitle ? 'block' : 'none';
        }
    } else {
        document.getElementById('now-playing-title').innerText = item.name;
        const subLabel = document.getElementById('now-playing-subtitle');
        if (subLabel) subLabel.style.display = 'none';
    }
    
    if (item.type === 'radio') {
        surahControls.style.display = 'none';
        if (forced) {
            triggerPlayRadio(item);
        }
    } else {
        surahControls.style.display = 'flex';
        
        populateSurahDropdown(item, forced);
    }
}

function populateSurahDropdown(reciter, forced) {
    const sel = document.getElementById('sel-surah');
    sel.innerHTML = '';
    
    if(!reciter.surahList) return;
    
    const availableSuwarIds = reciter.surahList.split(',');
    
    availableSuwarIds.forEach(idStr => {
        const id = parseInt(idStr);
        const surahObj = cachedSuwar.find(s => s.id === id);
        const sName = surahObj ? surahObj.name : `Surah ${id}`;
        
        const opt = document.createElement('option');
        opt.value = id;
        opt.text = `${id}. ${sName}`;
        sel.appendChild(opt);
    });

    const isThisReciterActive = playbackState.type === 'surah' && playbackState.baseServer === reciter.server;

    // Restore state if we were playing/paused on this reciter, else select first one
    if (isThisReciterActive) {
        sel.value = playbackState.currentSurahId;
        document.getElementById('num-repeat').value = playbackState.repeatCount || 0;
        document.getElementById('chk-autonext').checked = playbackState.autoNext || false;
    }
    
    // Auto-play requirement: If the user clicked the item directly, play immediately!
    if (forced) {
        triggerPlaySurah();
    }
}

function triggerPlayRadio(radioItem) {
    if (playbackState.playing && playbackState.type === 'radio' && playbackState.url === radioItem.url) {
        return; // Prevent double firing on the identical radio
    }
    
    playbackState.playing = true; // Set instantly for UI
    playbackState.type = 'radio';
    playbackState.url = radioItem.url;
    playbackState.title = radioItem.name;
    playbackState.subtitle = "";
    updatePlayButtonUI();

    chrome.runtime.sendMessage({
        action: 'play_radio',
        url: radioItem.url,
        title: radioItem.name
    }, () => { if(chrome.runtime.lastError) console.debug('Radio msg sent.'); });
}

function triggerPlaySurah() {
    if(selectedIndex === -1 || userList[selectedIndex].type !== 'reciter') return;
    if (playbackState.playing && playbackState.type === 'surah') {
        const currentSel = document.getElementById('sel-surah') ? parseInt(document.getElementById('sel-surah').value) : null;
        if(currentSel === playbackState.currentSurahId && playbackState.baseServer === userList[selectedIndex].server) {
            return; // Prevent repeating same trigger
        }
    }
    
    playbackState.playing = true; // Instant update
    updatePlayButtonUI();
    
    const reciter = userList[selectedIndex];
    const surahId = parseInt(document.getElementById('sel-surah').value);
    const repeatCount = parseInt(document.getElementById('num-repeat').value) || 0;
    const autoNext = document.getElementById('chk-autonext').checked;
    
    const surahObj = cachedSuwar.find(s => s.id === surahId);
    const sName = surahObj ? surahObj.name : `Surah ${surahId}`;
    // Determine the word for "Surah" dynamically or by language
    chrome.storage.local.get(['user_lang'], (langRes) => {
        const lang = langRes.user_lang || 'ar';
        const surahWord = lang === 'ar' ? 'سورة' : 'Surah';
        const surahTitle = `${surahWord} ${sName}`;
        const subTitle = `${reciter.name} - ${reciter.moshafName}`;

        document.getElementById('now-playing-title').innerText = surahTitle;
        const subLabel = document.getElementById('now-playing-subtitle');
        if (subLabel) {
            subLabel.innerText = subTitle;
            subLabel.style.display = 'block';
        }

        playbackState.type = 'surah';
        playbackState.baseServer = reciter.server;
        playbackState.currentSurahId = surahId;
        playbackState.title = surahTitle;
        playbackState.subtitle = subTitle;

        chrome.runtime.sendMessage({
            action: 'play_surah',
            baseServer: reciter.server,
            surahList: reciter.surahList.split(','),
            surahId: surahId,
            title: surahTitle, // Send only main title to background Badge UI
            repeatCount: repeatCount,
            autoNext: autoNext
        }, () => { if(chrome.runtime.lastError) console.debug('Surah msg sent.'); });
    });
}

function togglePlayPause() {
    if (playbackState.playing) {
        playbackState.playing = false; // Instant UI
        updatePlayButtonUI();
        chrome.runtime.sendMessage({ action: 'stop' }, () => { if(chrome.runtime.lastError) console.debug('Stop msg sent.'); });
    } else {
        if (selectedIndex === -1) {
            // Nothing selected, defaults to first item if available
            if (userList.length > 0) selectItem(0, true);
        } else {
            const item = userList[selectedIndex];
            if (item.type === 'radio') {
                triggerPlayRadio(item);
            } else {
                triggerPlaySurah();
            }
        }
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    await initI18n();
    await loadData();
    
    renderUserList();

    if (playbackState.title) {
        document.getElementById('now-playing-title').innerText = playbackState.title;
    } 
    
    // Always render controls for the selected item if one exists
    if (selectedIndex !== -1) {
        selectItem(selectedIndex, false);
    }

    updatePlayButtonUI();
    
    document.getElementById('btn-play-pause').onclick = togglePlayPause;
    
    // Only trigger play on change if they actually change the dropdown
    document.getElementById('sel-surah').onchange = triggerPlaySurah;
    document.getElementById('num-repeat').onchange = triggerPlaySurah;
    document.getElementById('chk-autonext').onchange = triggerPlaySurah;

    // Language Dropdown
    const langSelect = document.getElementById('sel-lang');
    if (langSelect) {
        chrome.storage.local.get(['user_lang'], (res) => {
            langSelect.value = res.user_lang || 'ar';
        });
        langSelect.addEventListener('change', (e) => {
            chrome.storage.local.set({user_lang: e.target.value}, () => {
                location.reload();
            });
        });
    }

    chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'local' && changes.playback_state) {
            playbackState = changes.playback_state.newValue || { playing: false };
            updatePlayButtonUI();
            if (playbackState.title) {
                document.getElementById('now-playing-title').innerText = playbackState.title;
            }
            const subLabel = document.getElementById('now-playing-subtitle');
            if (subLabel && playbackState.subtitle) {
                subLabel.innerText = playbackState.subtitle;
                subLabel.style.display = 'block';
            } else if (subLabel) {
                subLabel.style.display = 'none';
            }
            if (playbackState.type === 'surah' && playbackState.currentSurahId) {
                const sel = document.getElementById('sel-surah');
                if(sel && sel.value != playbackState.currentSurahId) {
                   sel.value = playbackState.currentSurahId;
                }
            }
        }
    });
});