import React, { useEffect, useState } from 'react';
import { usePlayerStore } from '../store/playerStore';
import { useI18n } from '../utils/i18n';
import PlayerControls from './PlayerControls';
import Toast from './components/Toast';
import { Settings } from 'lucide-react';

export default function Popup() {
  const { playbackState, userList, userLang, userTheme, initialize, setLang } = usePlayerStore();
  const { t, loaded } = useI18n(userLang);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [hydratedList, setHydratedList] = useState([]);
  const [toast, setToast] = useState({ message: '', type: 'info' });

  useEffect(() => {
    const handleMessage = (message) => {
      if (message.action === 'playback_retry') {
        const template = t('playbackRetry');
        const msg = template.replace('$1', message.count);
        setToast({ message: msg, type: 'loading' });
      } else if (message.action === 'playback_failed_final') {
        setToast({ message: t('playbackFailedFinal'), type: 'error' });
      }
    };
    chrome.runtime.onMessage.addListener(handleMessage);
    return () => chrome.runtime.onMessage.removeListener(handleMessage);
  }, [userLang, t]);

  useEffect(() => {
    initialize();
  }, [initialize]);



  useEffect(() => {
    document.documentElement.dir = (userLang === 'ar' || userLang === 'fa' || userLang === 'ur') ? 'rtl' : 'ltr';
    document.documentElement.lang = userLang;
    if (userTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [userLang, userTheme]);

  // Hydrate the user list to ensure translated names are shown
  useEffect(() => {
    const hydrateList = async () => {
      const rKey = `api_${userLang}_radios`;
      const cKey = `api_${userLang}_reciters`;
      const cache = await chrome.storage.local.get([rKey, cKey]);
      
      let radios = cache[rKey]?.radios;
      let reciters = cache[cKey]?.reciters;

      // Fallback fetches if cache is empty
      if (!radios) {
        try {
          const res = await fetch(`https://mp3quran.net/api/v3/radios?language=${userLang === 'en' ? 'eng' : userLang}`);
          const data = await res.json();
          radios = data.radios;
          if (radios) chrome.storage.local.set({ [rKey]: { radios } });
        } catch(e) {}
      }
      if (!reciters) {
        try {
          const res = await fetch(`https://mp3quran.net/api/v3/reciters?language=${userLang === 'en' ? 'eng' : userLang}`);
          const data = await res.json();
          reciters = data.reciters;
          if (reciters) chrome.storage.local.set({ [cKey]: { reciters } });
        } catch(e) {}
      }

      radios = radios || [];
      reciters = reciters || [];

      const newList = userList.map(item => {
        let name = item.name;
        let moshafName = item.moshafName;
        
        if (item.type === 'radio' && radios.length) {
          const r = radios.find(x => String(x.id) === String(item.id));
          if (r) name = r.name;
        } else if (item.type === 'reciter' && reciters.length) {
          const r = reciters.find(x => String(x.id) === String(item.id));
          if (r) {
            name = r.name;
            const m = r.moshaf?.find(x => x.server === item.server);
            if (m) moshafName = m.name;
          }
        }
        return { ...item, name, moshafName };
      });
      setHydratedList(newList);
    };

    if (userList.length > 0) {
      hydrateList();
    } else {
      setHydratedList([]);
    }
  }, [userList, userLang]);

  useEffect(() => {
    // Sync index with playing item
    if (playbackState.type === 'radio') {
      const idx = userList.findIndex(item => item.type === 'radio' && item.url === playbackState.url);
      if(idx !== -1) setSelectedIndex(idx);
    } else if (playbackState.type === 'surah') {
      const idx = userList.findIndex(item => item.type === 'reciter' && item.server === playbackState.baseServer);
      if (idx !== -1) setSelectedIndex(idx);
    } else if (selectedIndex === -1 && userList.length > 0) {
      setSelectedIndex(0);
    }
  }, [playbackState, userList]);

  if (!loaded) return <div className="p-4 text-center">{t('loadingLabel')}</div>;

  const openOptions = () => {
    if (chrome.runtime.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    } else {
      window.open(chrome.runtime.getURL('options.html'));
    }
  };

  const handleSelect = (idx) => {
    setSelectedIndex(idx);
    const item = userList[idx]; // keeping original item for play triggers
    const hItem = hydratedList[idx]; // for names

    if (item.type === 'radio') {
      chrome.runtime.sendMessage({
        action: 'play_radio',
        url: item.url,
        title: hItem?.name || item.name,
        subtitle: ''
      });
    } else if (item.type === 'reciter') {
      const surahId = parseInt(item.surahList?.split(',')[0]) || 1;
      const surahWord = t('surahLabel');
      const fatihaName = t('fatihaName');
      
      const title = surahId === 1 ? `${surahWord} ${fatihaName}` : `${surahWord} ${surahId}`;
      const subtitle = `${hItem?.name || item.name} - ${hItem?.moshafName || item.moshafName}`;

      chrome.runtime.sendMessage({
        action: 'play_surah',
        baseServer: item.server,
        surahList: item.surahList.split(','),
        surahId: surahId,
        title: title,
        subtitle: subtitle,
        repeatCount: 0,
        autoNext: true
      });
    }
  };

  // Use hydrated item for display matching
  const selectedItem = selectedIndex !== -1 ? hydratedList[selectedIndex] : null;
  // pass original to PlayerControls for actual playing since we need raw IDs
  const rawSelectedItem = selectedIndex !== -1 ? userList[selectedIndex] : null;

  return (
    <div className={`flex flex-col h-[600px] w-[360px] font-sans justify-between overflow-hidden transition-colors ${userTheme === 'dark' ? 'bg-bgDark text-textDark' : 'bg-bgLight text-textLight'}`}>
      
      {/* Header and Player (Classic Gradient 2.0.0) */}
      <div className="flex flex-col items-center shrink-0 bg-gradient-to-br from-primaryDark to-primary shadow-[0_4px_15px_rgba(0,0,0,0.15)] border-b-[3px] border-gold pt-6 px-5 pb-5 text-white">
        <h2 className="text-xl font-bold mb-1 tracking-wide" style={{fontFamily: "'Amiri', serif", textShadow: '1px 1px 2px rgba(0,0,0,0.3)'}}>
          {playbackState.playing ? playbackState.title || t('extName') : (selectedItem?.name || t('extName'))}
        </h2>
        
        <p className="text-sm opacity-90 mb-6 text-center h-5">
          {playbackState.playing && playbackState.subtitle ? playbackState.subtitle : 
          (selectedItem?.type === 'reciter' ? selectedItem.moshafName : '')}
        </p>
        
        <PlayerControls selectedItem={selectedItem} lang={userLang} t={t} />
      </div>

      {/* User List */}
      <div className="flex-1 p-3 overflow-y-auto custom-scrollbar px-4">
        <h3 className="text-[16px] font-bold mb-3 text-primary border-b-2 border-[#e5e7eb] dark:border-[#334155] pb-2 sticky top-0 bg-bgLight dark:bg-bgDark z-10" style={{fontFamily: "'Amiri', serif"}}>{t('selectReciterLabel')}</h3>
        
        {userList.length === 0 ? (
          <div 
            onClick={openOptions}
            className="flex flex-col items-center justify-center py-6 px-4 bg-primary/10 hover:bg-primary/20 cursor-pointer rounded-lg border border-primary/20 transition-all text-center"
          >
            <Settings className="w-8 h-8 text-primaryLight mb-2" />
            <span className="text-sm font-bold text-primaryLight">{t('noItemsMessage')}</span>
            <span className="text-xs opacity-70 mt-1">{t('clickToAdd')}</span>
          </div>
        ) : (
          <ul className="space-y-2">
            {hydratedList.map((item, idx) => (
              <li 
                key={idx} 
                onClick={() => handleSelect(idx)}
                className={`p-3 rounded-lg cursor-pointer flex items-center transition-all border-b border-[#e5e7eb] dark:border-[#334155] last:border-0 ${
                  selectedIndex === idx 
                    ? 'bg-gold/10 text-gold font-bold border-l-4 border-l-gold border-r-4 border-r-gold px-2' 
                    : 'hover:bg-primary/10 hover:pr-4 dark:hover:pl-4 font-medium'
                }`}
              >
                <div className={`mr-3 ml-3 text-lg opacity-80 ${selectedIndex === idx ? 'opacity-100' : ''}`}>{item.type === 'radio' ? '📻' : '📖'}</div>
                <div className="flex-1 overflow-hidden">
                  <div className="text-[15px] whitespace-nowrap overflow-hidden text-ellipsis">
                    {item.name}
                  </div>
                  {item.type === 'reciter' && (
                    <div className="text-xs opacity-60 truncate font-normal">{item.moshafName}</div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Footer */}
      <div className="flex justify-between items-center py-3 px-4 border-t border-[#e5e7eb] dark:border-[#334155] bg-bgLight/90 dark:bg-bgDark/90 backdrop-blur-sm">
        <button 
          onClick={openOptions}
          className="text-primary hover:text-gold font-bold text-sm transition-colors flex items-center"
        >
          <Settings className="w-4 h-4 ml-1 mr-1" />
          {t('optionsLink')}
        </button>
        
        <select 
          value={userLang}
          onChange={(e) => setLang(e.target.value)}
          className="bg-black/30 border border-white/10 rounded px-2 py-1 text-xs focus:outline-none focus:border-primary"
        >
          <option value="ar">العربية</option>
          <option value="en">English</option>
          <option value="fr">Français</option>
          <option value="tr">Türkçe</option>
          <option value="fa">فارسی</option>
        </select>
      </div>

      <Toast 
        message={toast.message} 
        type={toast.type} 
        onClose={() => setToast({ message: '', type: 'info' })} 
      />
    </div>
  );
}
