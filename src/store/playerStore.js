import { create } from 'zustand'

export const usePlayerStore = create((set, get) => ({
  playbackState: { playing: false },
  userList: [],
  userLang: 'ar',
  userTheme: 'dark',
  userVolume: 1.0,
  
  initialize: () => {
    // Load initial state from chrome.storage
    chrome.storage.local.get(['playback_state', 'user_list', 'user_lang', 'user_theme', 'user_volume'], (res) => {
      let finalLang = res.user_lang || 'ar';
      try {
        if (localStorage.getItem('user_lang')) {
          finalLang = localStorage.getItem('user_lang');
        }
      } catch (e) {}

      set({
        playbackState: res.playback_state || { playing: false },
        userList: res.user_list || [],
        userLang: finalLang,
        userTheme: res.user_theme || 'dark',
        userVolume: res.user_volume !== undefined ? res.user_volume : 1.0
      });
    });

    // Listen for storage changes
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local') {
        const stateUpdates = {};
        if (changes.playback_state) stateUpdates.playbackState = changes.playback_state.newValue || { playing: false };
        if (changes.user_list) stateUpdates.userList = changes.user_list.newValue || [];
        if (changes.user_lang) {
          stateUpdates.userLang = changes.user_lang.newValue || 'ar';
          try { localStorage.setItem('user_lang', stateUpdates.userLang); } catch(e) {}
        }
        if (changes.user_theme) stateUpdates.userTheme = changes.user_theme.newValue || 'dark';
        if (changes.user_volume) stateUpdates.userVolume = changes.user_volume.newValue !== undefined ? changes.user_volume.newValue : 1.0;
        
        if (Object.keys(stateUpdates).length > 0) {
          set(stateUpdates);
        }
      }
    });

    // Double check actual playing status
    chrome.runtime.sendMessage({action: 'status'}, (statusRes) => {
      if (statusRes && typeof statusRes.playing !== 'undefined') {
        set(state => {
          const newPlaying = statusRes.playing;
          if (state.playbackState.playing !== newPlaying) {
            const newState = { ...state.playbackState, playing: newPlaying };
            chrome.storage.local.set({ playback_state: newState });
            return { playbackState: newState };
          }
          return state;
        });
      }
    });
  },

  setLang: (lang) => {
    set({ userLang: lang });
    try { localStorage.setItem('user_lang', lang); } catch (e) {}
    chrome.storage.local.set({ user_lang: lang });
  },

  setTheme: (theme) => {
    set({ userTheme: theme });
    chrome.storage.local.set({ user_theme: theme });
  },
  
  updateUserList: (list) => {
    chrome.storage.local.set({ user_list: list });
  },

  setVolume: (volume) => {
    set({ userVolume: volume });
    chrome.storage.local.set({ user_volume: volume });
  },

  updatePlaybackState: (updates) => {
    const newState = { ...get().playbackState, ...updates };
    chrome.storage.local.set({ playback_state: newState });
  }
}))
