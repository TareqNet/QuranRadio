import React, { useState, useEffect } from 'react';
import { usePlayerStore } from '../store/playerStore';
import { Play, Pause, Repeat, FastForward } from 'lucide-react';

export default function PlayerControls({ selectedItem, lang, t }) {
  const { playbackState, updatePlaybackState } = usePlayerStore();
  const [cachedSuwar, setCachedSuwar] = useState([]);
  const [surahId, setSurahId] = useState(1);
  const [repeat, setRepeat] = useState(playbackState.repeatCount || 0);
  const [autoNext, setAutoNext] = useState(playbackState.autoNext ?? true);

  useEffect(() => {
    // Load suwar list dictionary from storage
    const fetchSuwar = async () => {
      const sKey = `api_${lang}_suwar`;
      const res = await chrome.storage.local.get([sKey]);
      if (res[sKey] && res[sKey].suwar) {
        setCachedSuwar(res[sKey].suwar);
      } else {
        // Fallback fetch
        try {
          const apiLang = lang === 'en' ? 'eng' : lang;
          const fRes = await fetch(`https://mp3quran.net/api/v3/suwar?language=${apiLang}`);
          const data = await fRes.json();
          if (data && data.suwar) {
            setCachedSuwar(data.suwar);
            chrome.storage.local.set({ [sKey]: { suwar: data.suwar } });
          }
        } catch(e) {}
      }
    };
    fetchSuwar();
  }, [lang]);

  useEffect(() => {
    // Sync UI with playback state when Reciter is actively playing
    if (playbackState.type === 'surah' && selectedItem?.server === playbackState.baseServer) {
      if (playbackState.currentSurahId) setSurahId(playbackState.currentSurahId);
      if (playbackState.repeatCount !== undefined) setRepeat(playbackState.repeatCount);
      if (playbackState.autoNext !== undefined) setAutoNext(playbackState.autoNext);
    }
  }, [playbackState, selectedItem]);

  const togglePlay = () => {
    if (playbackState.playing) {
      chrome.runtime.sendMessage({ action: 'stop' });
      // Instantly update UI for snappy feeling
      updatePlaybackState({ playing: false });
    } else {
      if (!selectedItem) return;
      
      updatePlaybackState({ playing: true });

      if (selectedItem.type === 'radio') {
        chrome.runtime.sendMessage({
          action: 'play_radio',
          url: selectedItem.url,
          title: selectedItem.name,
          subtitle: ""
        });
      } else {
        triggerPlaySurah();
      }
    }
  };

  const triggerPlaySurah = () => {
    if (!selectedItem || selectedItem.type !== 'reciter') return;

    const surahObj = cachedSuwar.find(s => s.id === surahId);
    const sName = surahObj ? surahObj.name : `Surah ${surahId}`;
    const surahWord = lang === 'ar' ? 'سورة' : 'Surah';
    const surahTitle = `${surahWord} ${sName}`;
    const subTitle = `${selectedItem.name} - ${selectedItem.moshafName}`;

    chrome.runtime.sendMessage({
      action: 'play_surah',
      baseServer: selectedItem.server,
      surahList: selectedItem.surahList.split(','),
      surahId: surahId,
      title: surahTitle,
      subtitle: subTitle,
      repeatCount: repeat,
      autoNext: autoNext
    });
  };

  const onSurahChange = (e) => {
    const newId = parseInt(e.target.value);
    setSurahId(newId);
    // Auto-play when user changes the dropdown manually
    if (selectedItem?.type === 'reciter') {
      setTimeout(() => triggerPlaySurah(), 50); // Small delay to let React update state
    }
  };

  const onRepeatChange = (e) => {
    const val = parseInt(e.target.value) || 0;
    setRepeat(val);
    chrome.storage.local.set({ user_repeat: val });
    if (playbackState.type === 'surah' && playbackState.baseServer === selectedItem?.server) {
      updatePlaybackState({ repeatCount: val });
    }
  };

  const onAutoNextChange = (e) => {
    const val = e.target.checked;
    setAutoNext(val);
    chrome.storage.local.set({ user_auto_next: val });
    if (playbackState.type === 'surah' && playbackState.baseServer === selectedItem?.server) {
      updatePlaybackState({ autoNext: val });
    }
  };

  return (
    <div className="w-full flex flex-col items-center">
      
      {/* Play/Pause Button */}
      <div 
        onClick={togglePlay}
        className="w-20 h-20 rounded-full bg-gradient-to-tr from-primaryDark to-primaryLight 
                   flex items-center justify-center cursor-pointer shadow-lg shadow-primary/40 
                   hover:scale-105 active:scale-95 transition-all text-white mb-6 border-4 border-white/10"
      >
        {playbackState.playing ? (
          <Pause fill="currentColor" className="w-8 h-8 mr-1" />
        ) : (
          <Play fill="currentColor" className="w-8 h-8 ml-1" />
        )}
      </div>

      {/* Surah Controls */}
      {selectedItem?.type === 'reciter' && (
        <div className="w-full bg-black/20 rounded-xl p-4 border border-white/5 space-y-3">
          
          <div className="flex flex-col space-y-1">
            <label className="text-xs text-white/60 pl-1">{t('selectSurahLabel')}</label>
            <select 
              value={surahId} 
              onChange={onSurahChange}
              className="w-full bg-bgDark border border-white/10 rounded-lg p-2 text-sm outline-none focus:border-primaryLight transition-colors"
            >
              {selectedItem.surahList?.split(',').map(idStr => {
                const id = parseInt(idStr);
                const s = cachedSuwar.find(x => x.id === id);
                return (
                  <option key={id} value={id}>
                    {id}. {s ? s.name : `Surah ${id}`}
                  </option>
                );
              })}
            </select>
          </div>

          <div className="flex justify-between items-center bg-black/30 p-2 rounded-lg border border-white/5">
            <label className="flex items-center space-x-2 space-x-reverse cursor-pointer">
              <input 
                type="checkbox" 
                checked={autoNext} 
                onChange={onAutoNextChange}
                className="accent-primary w-4 h-4 cursor-pointer"
              />
              <span className="text-xs text-white/80 flex items-center">
                <FastForward className="w-3 h-3 ml-1" />
                {t('autoNextLabel')}
              </span>
            </label>

            <label className="flex items-center space-x-2 space-x-reverse">
              <span className="text-xs text-white/80 flex items-center">
                <Repeat className="w-3 h-3 ml-1" />
                {t('repeatLabel')}
              </span>
              <input 
                type="number" 
                min="0" 
                value={repeat} 
                onChange={onRepeatChange}
                className="w-12 bg-bgDark border border-white/10 rounded p-1 text-xs text-center outline-none focus:border-primaryLight"
              />
            </label>
          </div>

        </div>
      )}

    </div>
  );
}
