import React, { useEffect, useState } from 'react';
import { usePlayerStore } from '../store/playerStore';
import { useI18n } from '../utils/i18n';
import SearchableList from './SearchableList';
import MyListEditor from './MyListEditor';

export default function Options() {
  const { userList, userLang, userTheme, initialize, setLang, updateUserList } = usePlayerStore();
  const { t, loaded } = useI18n(userLang);

  const [radios, setRadios] = useState([]);
  const [reciters, setReciters] = useState([]);

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

  useEffect(() => {
    const fetchApi = async (endpoint) => {
      try {
        const apiLang = userLang === 'en' ? 'eng' : userLang;
        const res = await fetch(`https://mp3quran.net/api/v3/${endpoint}?language=${apiLang}`);
        return await res.json();
      } catch(e) { return null; }
    };

    const loadAPIData = async () => {
      const rKey = `api_${userLang}_radios`;
      const cKey = `api_${userLang}_reciters`;
      const caches = await chrome.storage.local.get([rKey, cKey]);

      let rList = caches[rKey]?.radios;
      if (!rList) {
        const rData = await fetchApi('radios');
        rList = rData?.radios || [];
        if (rList.length) chrome.storage.local.set({ [rKey]: { radios: rList } });
      }

      let cList = caches[cKey]?.reciters;
      if (!cList) {
        const cData = await fetchApi('reciters');
        cList = cData?.reciters || [];
        if (cList.length) chrome.storage.local.set({ [cKey]: { reciters: cList } });
      }

      // Sort alphabetically
      rList?.sort((a,b) => a.name.localeCompare(b.name, userLang));
      
      const uniqueMap = new Map();
      cList?.forEach(r => uniqueMap.set(r.id, r));
      const finalCList = Array.from(uniqueMap.values()).sort((a,b) => a.name.localeCompare(b.name, userLang));

      setRadios(rList || []);
      setReciters(finalCList || []);
    };
    
    loadAPIData();
  }, [userLang]);

  if (!loaded) return <div className="p-8 text-primary">{t('loadingLabel')}</div>;

  return (
    <div className={`transition-colors min-h-screen ${userTheme === 'dark' ? 'bg-bgDark text-textDark' : 'bg-bgLight text-textLight'}`}>
      <div className="max-w-6xl mx-auto p-6 md:p-10 font-sans flex flex-col h-full">
        <header className="flex flex-col md:flex-row justify-between items-center mb-10 pb-4 border-b-2 border-gold">
          <h1 className="text-3xl font-bold text-primary mb-4 md:mb-0" style={{fontFamily: "'Amiri', serif"}}>{t('optionsHeader')}</h1>
          
          <div className="flex gap-4">
            <select 
              value={userTheme}
              onChange={(e) => usePlayerStore.getState().setTheme(e.target.value)}
              className="bg-transparent text-primary font-bold border border-primary/20 rounded-lg px-3 py-1 cursor-pointer outline-none focus:border-primary hover:bg-black/5 dark:hover:bg-white/5"
            >
              <option value="light">☀️ {t('lightTheme')}</option>
              <option value="dark">🌙 {t('darkTheme')}</option>
            </select>

            <select 
              value={userLang}
              onChange={(e) => setLang(e.target.value)}
              className="bg-transparent text-primary font-bold border border-primary/20 rounded-lg px-3 py-1 cursor-pointer outline-none focus:border-primary hover:bg-black/5 dark:hover:bg-white/5"
            >
              <option value="ar">العربية</option>
              <option value="en">English</option>
              <option value="fr">Français</option>
              <option value="tr">Türkçe</option>
              <option value="fa">فارسی</option>
              <option value="es">Español</option>
            </select>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 flex-1">
          
          {/* Radios Column */}
          <div className="bg-cardLight dark:bg-cardDark rounded-xl border border-[#e2e8f0] dark:border-[#334155] shadow-sm p-5 flex flex-col h-[70vh]">
            <h2 className="text-[22px] font-semibold mb-4 text-gold border-b border-[#e2e8f0] dark:border-[#334155] pb-3" style={{fontFamily: "'Amiri', serif"}}>{t('radiosHeader')}</h2>
            <SearchableList 
              type="radio" 
              items={radios} 
              userList={userList}
              updateUserList={updateUserList}
              t={t} 
            />
          </div>

          {/* Reciters Column */}
          <div className="bg-cardLight dark:bg-cardDark rounded-xl border border-[#e2e8f0] dark:border-[#334155] shadow-sm p-5 flex flex-col h-[70vh]">
            <h2 className="text-[22px] font-semibold mb-4 text-gold border-b border-[#e2e8f0] dark:border-[#334155] pb-3" style={{fontFamily: "'Amiri', serif"}}>{t('recitersHeader')}</h2>
            <SearchableList 
              type="reciter" 
              items={reciters} 
              userList={userList}
              updateUserList={updateUserList}
              t={t} 
            />
          </div>

          {/* My List Column */}
          <div className="bg-cardLight dark:bg-cardDark rounded-xl border border-[#e2e8f0] dark:border-[#334155] shadow-md p-5 flex flex-col h-[70vh]">
            <h2 className="text-[22px] font-semibold mb-4 text-gold border-b border-[#e2e8f0] dark:border-[#334155] pb-3 flex items-center" style={{fontFamily: "'Amiri', serif"}}>
              {t('myListHeader')}
              <span className="bg-primary px-3 py-1 rounded text-sm mr-3 ml-3 text-white font-sans">{userList.length}</span>
            </h2>
            <MyListEditor 
              userList={userList} 
              updateUserList={updateUserList}
              radios={radios}
              reciters={reciters}
              t={t} 
            />
          </div>

        </div>
      </div>
    </div>
  );
}
