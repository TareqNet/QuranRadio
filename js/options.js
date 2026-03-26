let currentDict = {};

async function initI18n() {
    return new Promise((resolve) => {
        chrome.storage.local.get(['user_lang'], async (res) => {
            const lang = res.user_lang || 'ar'; 
            try {
                const url = chrome.runtime.getURL(`_locales/${lang}/messages.json`);
                const fetchRes = await fetch(url);
                currentDict = await fetchRes.json();
                
                document.getElementById('html-root').dir = (lang === 'ar' || lang === 'fa') ? 'rtl' : 'ltr';
                document.title = currentDict.optionsTitle ? currentDict.optionsTitle.message : 'Options';
                
                document.querySelectorAll('[data-i18n]').forEach(el => {
                    const key = el.getAttribute('data-i18n');
                    if(currentDict[key]) el.innerText = currentDict[key].message;
                });
                document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
                    const key = el.getAttribute('data-i18n-placeholder');
                    if(currentDict[key]) el.placeholder = currentDict[key].message;
                });
                resolve(lang);
            } catch(e) {
                console.error(e);
                resolve('ar');
            }
        });
    });
}

function showToast(msgKey) {
    const toast = document.getElementById('toast');
    toast.innerText = currentDict[msgKey] ? currentDict[msgKey].message : msgKey;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2000);
}

let allRadios = [];
let allReciters = [];
let userList = [];

// Fallback fetch if background cache is missing for some reason
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
    const storage = await chrome.storage.local.get(['user_list', 'user_lang', 'api_ar', 'api_en']);
    userList = storage.user_list || [];
    
    let lang = storage.user_lang || 'ar';
    
    const rKey = `api_${lang}_radios`;
    const cKey = `api_${lang}_reciters`;
    const rCache = await chrome.storage.local.get([rKey]);
    const cCache = await chrome.storage.local.get([cKey]);
    
    if (rCache[rKey] && rCache[rKey].radios && cCache[cKey] && cCache[cKey].reciters) {
        allRadios = rCache[rKey].radios;
        allReciters = cCache[cKey].reciters;
    } else {
        const rData = await fetchAPI('radios', lang);
        allRadios = rData ? rData.radios : [];
        if (allRadios.length) chrome.storage.local.set({ [rKey]: {radios: allRadios} });
        
        const cData = await fetchAPI('reciters', lang);
        allReciters = cData ? cData.reciters : [];
        if (allReciters.length) chrome.storage.local.set({ [cKey]: {reciters: allReciters} });
    }

    // Sort alphabetically by language locale
    allRadios.sort((a,b) => a.name.localeCompare(b.name, lang));
    
    // De-duplicate reciters and sort (API sometimes returns same reciter twice)
    const uniqueRecitersMap = new Map();
    allReciters.forEach(r => uniqueRecitersMap.set(r.id, r));
    allReciters = Array.from(uniqueRecitersMap.values());
    allReciters.sort((a,b) => a.name.localeCompare(b.name, lang));

    renderRadios(allRadios);
    renderReciters(allReciters);
    renderUserList();
}

function hydrateItem(item) {
    if (item.type === 'radio') {
        const r = allRadios.find(x => String(x.id) === String(item.id));
        if (r) {
            item.name = r.name;
            item.url = r.url;
        }
    } else if (item.type === 'reciter') {
        const r = allReciters.find(x => String(x.id) === String(item.id));
        if (r) {
            item.name = r.name;
            let mosh = null;
            if (item.moshafId) {
                mosh = r.moshaf.find(m => String(m.id) === String(item.moshafId));
            } else {
                mosh = r.moshaf.find(m => m.server === item.server);
            }
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

function renderRadios(radios) {
    const ul = document.getElementById('radios-results');
    ul.innerHTML = '';
    const frag = document.createDocumentFragment();
    radios.forEach(radio => {
        const li = document.createElement('li');
        const addBtnText = currentDict.addButton ? currentDict.addButton.message : 'Add';
        li.innerHTML = `<span>${radio.name}</span> <button>${addBtnText}</button>`;
        li.querySelector('button').onclick = () => addToUserList({
            type: 'radio',
            id: radio.id,
            name: radio.name,
            url: radio.url
        });
        frag.appendChild(li);
    });
    ul.appendChild(frag);
}

function renderReciters(reciters) {
    const ul = document.getElementById('reciters-results');
    ul.innerHTML = '';
    const frag = document.createDocumentFragment();
    reciters.forEach(reciter => {
        const li = document.createElement('li');
        
        // If reciter has multiple moshafs, create a select dropdown
        let selectHTML = '';
        if(reciter.moshaf.length > 1) {
            selectHTML = `<select class="moshaf-select">
                ${reciter.moshaf.map((m, i) => `<option value="${i}">${m.name}</option>`).join('')}
            </select>`;
        }

        const addBtnText = currentDict.addButton ? currentDict.addButton.message : 'Add';
        li.innerHTML = `
            <span>${reciter.name}</span>
            <div>
                ${selectHTML}
                <button>${addBtnText}</button>
            </div>
        `;

        li.querySelector('button').onclick = () => {
            const select = li.querySelector('.moshaf-select');
            const moshafIndex = select ? select.value : 0;
            const selectedMoshaf = reciter.moshaf[moshafIndex];
            
            addToUserList({
                type: 'reciter',
                id: reciter.id,
                moshafId: selectedMoshaf.id,
                name: reciter.name,
                moshafName: selectedMoshaf.name,
                server: selectedMoshaf.server,
                surahList: selectedMoshaf.surah_list
            });
        };
        frag.appendChild(li);
    });
    ul.appendChild(frag);
}

function addToUserList(item) {
    userList.push(item);
    saveUserList();
}

function removeFromUserList(index) {
    userList.splice(index, 1);
    saveUserList();
}

function moveItem(index, direction) {
    if (direction === -1 && index > 0) {
        [userList[index], userList[index - 1]] = [userList[index - 1], userList[index]];
        saveUserList();
    } else if (direction === 1 && index < userList.length - 1) {
        [userList[index], userList[index + 1]] = [userList[index + 1], userList[index]];
        saveUserList();
    }
}

function saveUserList() {
    chrome.storage.local.set({user_list: userList}, () => {
        renderUserList();
        showToast("saveMessage");
    });
}

function renderUserList() {
    const ul = document.getElementById('user-list');
    const msg = document.getElementById('empty-list-msg');
    
    ul.innerHTML = '';
    if (userList.length === 0) {
        msg.style.display = 'block';
    } else {
        msg.style.display = 'none';
        userList.forEach((itemObj, index) => {
            const item = hydrateItem(itemObj); // Ensure we show in current language!
            if (!item) return;
            const icon = item.type === 'radio' ? '📻' : '📖';
            const itemName = item.type === 'reciter' ? `${item.name} (${item.moshafName})` : item.name;
            const itemText = `${icon} ${itemName}`;
            
            const removeText = currentDict.removeLabel ? currentDict.removeLabel.message : 'Remove';
            const li = document.createElement('li');
            li.innerHTML = `
                <span>${itemText}</span>
                <div class="controls">
                    <button class="up-btn">▲</button>
                    <button class="down-btn">▼</button>
                    <button class="remove-btn">${removeText}</button>
                </div>
            `;
            
            li.querySelector('.up-btn').onclick = () => moveItem(index, -1);
            li.querySelector('.down-btn').onclick = () => moveItem(index, 1);
            li.querySelector('.remove-btn').onclick = () => removeFromUserList(index);
            
            ul.appendChild(li);
        });
    }
}

// Search functionality
document.getElementById('radios-search').addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase();
    const filtered = allRadios.filter(r => r.name.toLowerCase().includes(q));
    renderRadios(filtered);
});

document.getElementById('reciters-search').addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase();
    const filtered = allReciters.filter(r => r.name.toLowerCase().includes(q));
    renderReciters(filtered);
});

document.addEventListener('DOMContentLoaded', async () => {
    await initI18n();
    
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

    await loadData();
});