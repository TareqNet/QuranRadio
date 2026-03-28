import React, { useEffect, useState } from 'react';
import { usePlayerStore } from '../store/playerStore';
import { useI18n } from '../utils/i18n';
import PlayerControls from './PlayerControls';
import { Settings } from 'lucide-react';

export default function Popup() {
  const { playbackState, userList, userLang, initialize, setLang } = usePlayerStore();
  const { t, loaded } = useI18n(userLang);
  const [selectedIndex, setSelectedIndex] = useState(-1);

  useEffect(() => {
    initialize();
  }, [initialize]);

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

  if (!loaded) return <div className="p-4 text-center">Loading...</div>;

  const openOptions = () => {
    if (chrome.runtime.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    } else {
      window.open(chrome.runtime.getURL('options.html'));
    }
  };

  const handleSelect = (idx) => {
    setSelectedIndex(idx);
    const item = userList[idx];
    if (item.type === 'radio') {
      chrome.runtime.sendMessage({
        action: 'play_radio',
        url: item.url,
        title: item.name,
        subtitle: ''
      });
    }
  };

  const selectedItem = selectedIndex !== -1 ? userList[selectedIndex] : null;

  return (
    <div className="flex flex-col h-full bg-gradient-to-br from-bgDark to-bgCard p-5 font-sans justify-between min-h-[500px]">
      
      {/* Header and Player */}
      <div className="flex flex-col items-center flex-1">
        <h2 className="text-xl font-bold mb-1 text-primaryLight tracking-wide">
          {playbackState.playing ? playbackState.title || t('extName') : (selectedItem?.name || t('extName'))}
        </h2>
        
        <p className="text-sm opacity-80 mb-6 text-center h-5">
          {playbackState.playing && playbackState.subtitle ? playbackState.subtitle : 
          (selectedItem?.type === 'reciter' ? selectedItem.moshafName : '')}
        </p>
        
        <PlayerControls selectedItem={selectedItem} lang={userLang} t={t} />
      </div>

      {/* User List */}
      <div className="mt-6 flex-1 bg-white/5 rounded-xl border border-white/10 p-3 overflow-y-auto max-h-[180px] custom-scrollbar">
        <h3 className="text-sm font-semibold mb-3 text-emerald-400 pl-1">{t('selectReciterLabel')}</h3>
        
        {userList.length === 0 ? (
          <div 
            onClick={openOptions}
            className="flex flex-col items-center justify-center py-6 px-4 bg-primary/10 hover:bg-primary/20 cursor-pointer rounded-lg border border-primary/20 transition-all text-center"
          >
            <Settings className="w-8 h-8 text-primaryLight mb-2" />
            <span className="text-sm font-bold text-primaryLight">{t('noItemsMessage')}</span>
            <span className="text-xs opacity-70 mt-1">انقر لإضافة قراء وإذاعات</span>
          </div>
        ) : (
          <ul className="space-y-2">
            {userList.map((item, idx) => (
              <li 
                key={idx} 
                onClick={() => handleSelect(idx)}
                className={`p-3 rounded-lg cursor-pointer flex items-center transition-all ${
                  selectedIndex === idx 
                    ? 'bg-primary/30 border border-primary/50 text-white shadow-lg shadow-primary/20' 
                    : 'bg-white/5 hover:bg-white/10 border border-transparent'
                }`}
              >
                <div className="mr-3 text-lg opacity-80">{item.type === 'radio' ? '📻' : '📖'}</div>
                <div className="flex-1 overflow-hidden">
                  <div className="text-sm font-medium whitespace-nowrap overflow-hidden text-ellipsis">
                    {item.name}
                  </div>
                  {item.type === 'reciter' && (
                    <div className="text-xs opacity-60 truncate">{item.moshafName}</div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Footer */}
      <div className="mt-4 flex justify-between items-center pt-3 border-t border-white/10">
        <button 
          onClick={openOptions}
          className="text-primaryLight hover:text-white font-semibold text-sm transition-colors flex items-center"
        >
          <Settings className="w-4 h-4 ml-1" />
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

    </div>
  );
}
