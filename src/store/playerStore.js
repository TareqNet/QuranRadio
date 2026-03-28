import { create } from 'zustand'

export const usePlayerStore = create((set, get) => ({
  playbackState: { playing: false },
  userList: [],
  userLang: 'ar',
  
  initialize: () => {
    // Load initial state from chrome.storage
    chrome.storage.local.get(['playback_state', 'user_list', 'user_lang'], (res) => {
      set({
        playbackState: res.playback_state || { playing: false },
        userList: res.user_list || [],
        userLang: res.user_lang || 'ar'
      });
    });

    // Listen for storage changes
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local') {
        const stateUpdates = {};
        if (changes.playback_state) stateUpdates.playbackState = changes.playback_state.newValue || { playing: false };
        if (changes.user_list) stateUpdates.userList = changes.user_list.newValue || [];
        if (changes.user_lang) stateUpdates.userLang = changes.user_lang.newValue || 'ar';
        
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
    chrome.storage.local.set({ user_lang: lang });
  },
  
  updateUserList: (list) => {
    chrome.storage.local.set({ user_list: list });
  },

  updatePlaybackState: (updates) => {
    const newState = { ...get().playbackState, ...updates };
    chrome.storage.local.set({ playback_state: newState });
  }
}))
