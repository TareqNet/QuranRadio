import React, { useState, useEffect } from 'react';
import { usePlayerStore } from '../store/playerStore';
import { Play, Pause, Repeat, FastForward } from 'lucide-react';

export default function PlayerControls({ selectedItem, lang, t }) {
  const { playbackState, updatePlaybackState } = usePlayerStore();
  const [cachedSuwar, setCachedSuwar] = useState([]);
  const [surahId, setSurahId] = useState(1);
  const [repeat, setRepeat] = useState(playbackState.repeatCount || 0);
  const [autoNext, setAutoNext] = useState(playbackState.autoNext ?? true);
  
  const [currentTime, setCurrentTime] = useState(playbackState.currentTime || 0);
  const [duration, setDuration] = useState(playbackState.duration || 0);
  const [isDragging, setIsDragging] = useState(false);

  const formatTime = (s) => {
    if (!s || isNaN(s)) return "00:00:00";
    const hrs = Math.floor(s / 3600);
    const mins = Math.floor((s % 3600) / 60);
    const secs = Math.floor(s % 60);
    return [hrs, mins, secs]
      .map(v => v.toString().padStart(2, "0"))
      .join(":");
  };

  useEffect(() => {
    let interval = null;
    if (playbackState.playing) {
      interval = setInterval(() => {
        chrome.runtime.sendMessage({ action: "status" }, (res) => {
          if (res && !isDragging) {
            if (typeof res.currentTime === "number") setCurrentTime(res.currentTime);
            if (typeof res.duration === "number") setDuration(res.duration);
          }
        });
      }, 1000);
    } else {
      // Still sync once if not playing to catch last state
      chrome.storage.local.get(["playback_state"], (res) => {
        if (res.playback_state && !isDragging) {
          setCurrentTime(res.playback_state.currentTime || 0);
          setDuration(res.playback_state.duration || 0);
        }
      });
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [playbackState.playing, isDragging]);

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

  const [prevServer, setPrevServer] = useState(null);

  useEffect(() => {
    // Sync UI with playback state when Reciter is actively playing
    if (playbackState.type === 'surah' && selectedItem?.server === playbackState.baseServer) {
      if (playbackState.currentSurahId) setSurahId(playbackState.currentSurahId);
      if (playbackState.repeatCount !== undefined) setRepeat(playbackState.repeatCount);
      if (playbackState.autoNext !== undefined) setAutoNext(playbackState.autoNext);
    } 
    // If we switched to a NEW reciter that is NOT currently playing, reset to its first surah
    else if (selectedItem && selectedItem.type === 'reciter' && selectedItem.server !== prevServer) {
      const firstSurah = parseInt(selectedItem.surahList?.split(',')[0]);
      if (!isNaN(firstSurah)) {
        setSurahId(firstSurah);
        setPrevServer(selectedItem.server);
      }
    }
  }, [playbackState, selectedItem, prevServer]);

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

  const triggerPlaySurah = (overrideId = null) => {
    if (!selectedItem || selectedItem.type !== 'reciter') return;

    const activeId = overrideId || surahId;
    const surahObj = cachedSuwar.find(s => s.id === activeId);
    
    // Improved name fallback
    let sName = surahObj ? surahObj.name : activeId;
    
    // Hard fallback for Al-Fatiha if list not loaded
    if (!surahObj && activeId === 1) {
      sName = t('fatihaName');
    }

    const surahWord = t('surahLabel');
    
    // If we have a name (non-numeric string), use it. Otherwise use the ID.
    const surahTitle = isNaN(sName) ? `${surahWord} ${sName}` : `${surahWord} ${activeId}`;
    const subTitle = `${selectedItem.name} - ${selectedItem.moshafName}`;

    chrome.runtime.sendMessage({
      action: 'play_surah',
      baseServer: selectedItem.server,
      surahList: selectedItem.surahList.split(','),
      surahId: activeId,
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
      triggerPlaySurah(newId);
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

  const onSeek = (e) => {
    const val = parseFloat(e.target.value);
    setCurrentTime(val);
    setIsDragging(false);
    chrome.runtime.sendMessage({ action: "seek", time: val });
  };

  const onSeeking = (e) => {
    setIsDragging(true);
    setCurrentTime(parseFloat(e.target.value));
  };

  const isRtl = lang === 'ar' || lang === 'fa';
  const gradientDir = isRtl ? 'to left' : 'to right';

  return (
    <div className="w-full flex flex-col items-center">
      
      {/* Classic 2.0.0 Play/Pause Button */}
      <div 
        onClick={togglePlay}
        className="w-[56px] h-[56px] rounded-full bg-white flex items-center justify-center cursor-pointer shadow-[0_4px_8px_rgba(0,0,0,0.2),inset_0_0_0_2px_#d97706] hover:scale-[0.98] active:scale-95 transition-transform text-primaryDark mb-6"
      >
        {playbackState.playing ? (
          <Pause fill="currentColor" className="w-7 h-7" />
        ) : (
          <Play fill="currentColor" className="w-7 h-7 ml-1" />
        )}
      </div>

      {/* Progress Bar - Only for Surah mode, disabled otherwise */}
      <div className={`w-full px-1 mb-5 transition-all ${
        (selectedItem?.type !== 'reciter' || playbackState.type === 'radio') 
          ? 'opacity-40 grayscale pointer-events-none' 
          : 'opacity-100'
      }`} dir={isRtl ? 'rtl' : 'ltr'}>
        <div className="flex justify-between items-center mb-1">
          <span className="text-[10px] text-white/80 font-medium tabular-nums">{formatTime(currentTime)}</span>
          <span className="text-[10px] text-white/80 font-medium tabular-nums">{formatTime(duration)}</span>
        </div>
        <input 
          type="range" 
          min="0" 
          max={duration || 100} 
          step="0.1"
          value={currentTime}
          onInput={onSeeking}
          onChange={onSeek}
          className="w-full h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer accent-gold hover:accent-gold/80 transition-all"
          style={{
            background: `linear-gradient(${gradientDir}, #d97706 0%, #d97706 ${(currentTime / (duration || 1)) * 100}%, rgba(255,255,255,0.2) ${(currentTime / (duration || 1)) * 100}%, rgba(255,255,255,0.2) 100%)`
          }}
        />
      </div>

      {/* Surah Controls */}
      {/* Surah Controls - Always visible but disabled for radios */}
      <div className={`w-full bg-white/15 backdrop-blur-sm rounded-xl p-3 border border-white/20 space-y-3 shadow-sm transition-all ${
        (selectedItem?.type !== 'reciter' || playbackState.type === 'radio') 
          ? 'opacity-40 grayscale pointer-events-none' 
          : 'opacity-100'
      }`}>
        
        <div className="flex flex-col space-y-1">
          <label className="text-xs text-white pl-1 font-medium">{t('selectSurahLabel')}</label>
          <select 
            value={surahId} 
            onChange={onSurahChange}
            className="w-full bg-white/90 text-slate-800 border border-white/40 rounded-lg p-1.5 text-sm outline-none focus:border-gold transition-colors font-medium"
          >
            {selectedItem?.type === 'reciter' && selectedItem.surahList ? (
              selectedItem.surahList.split(',').map(idStr => {
                const id = parseInt(idStr);
                const s = cachedSuwar.find(x => x.id === id);
                return (
                  <option key={id} value={id}>
                    {id}. {s ? s.name : `Surah ${id}`}
                  </option>
                );
              })
            ) : (
              <option value="0">{lang === 'ar' ? 'بث إذاعي مباشر' : 'Live Radio Stream'}</option>
            )}
          </select>
        </div>

        <div className="flex justify-between items-center pt-1">
          <label className="flex items-center space-x-2 space-x-reverse cursor-pointer">
            <input 
              type="checkbox" 
              checked={autoNext} 
              onChange={onAutoNextChange}
              className="accent-primary w-4 h-4 cursor-pointer"
            />
            <span className="text-xs text-white flex items-center">
              <FastForward className="w-3 h-3 ml-1" />
              {t('autoNextLabel')}
            </span>
          </label>

          <label className="flex items-center space-x-2 space-x-reverse">
            <span className="text-xs text-white flex items-center">
              <Repeat className="w-3 h-3 ml-1" />
              {t('repeatLabel')}
            </span>
            <input 
              type="number" 
              min="0" 
              value={repeat} 
              onChange={onRepeatChange}
              className="w-12 bg-white/90 text-slate-800 border border-white/40 rounded p-1 text-xs text-center outline-none focus:border-gold font-medium"
            />
          </label>
        </div>

      </div>

    </div>
  );
}
