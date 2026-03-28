import React, { useEffect, useState } from 'react';
import { usePlayerStore } from '../store/playerStore';
import { useI18n } from '../utils/i18n';
import SearchableList from './SearchableList';
import MyListEditor from './MyListEditor';

export default function Options() {
  const { userList, userLang, initialize, setLang, updateUserList } = usePlayerStore();
  const { t, loaded } = useI18n(userLang);

  const [radios, setRadios] = useState([]);
  const [reciters, setReciters] = useState([]);

  useEffect(() => {
    initialize();
  }, [initialize]);

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

  if (!loaded) return <div className="p-8 text-white">Loading Settings...</div>;

  return (
    <div className="max-w-6xl mx-auto p-6 md:p-10 font-sans min-h-screen flex flex-col">
      <header className="flex justify-between items-center mb-10 pb-4 border-b border-white/10">
        <h1 className="text-3xl font-bold tracking-tight text-primaryLight">{t('optionsHeader')}</h1>
        <select 
          value={userLang}
          onChange={(e) => setLang(e.target.value)}
          className="bg-black/40 border border-white/20 rounded-lg px-4 py-2 text-sm outline-none focus:border-primary transition-colors cursor-pointer"
        >
          <option value="ar">العربية</option>
          <option value="en">English</option>
          <option value="fr">Français</option>
          <option value="tr">Türkçe</option>
          <option value="fa">فارسی</option>
          <option value="es">Español</option>
        </select>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 flex-1">
        
        {/* Radios Column */}
        <div className="bg-white/5 rounded-2xl border border-white/10 p-5 flex flex-col h-[70vh]">
          <h2 className="text-xl font-semibold mb-4 text-emerald-400">{t('radiosHeader')}</h2>
          <SearchableList 
            type="radio" 
            items={radios} 
            userList={userList}
            updateUserList={updateUserList}
            t={t} 
          />
        </div>

        {/* Reciters Column */}
        <div className="bg-white/5 rounded-2xl border border-white/10 p-5 flex flex-col h-[70vh]">
          <h2 className="text-xl font-semibold mb-4 text-emerald-400">{t('recitersHeader')}</h2>
          <SearchableList 
             type="reciter" 
             items={reciters} 
             userList={userList}
             updateUserList={updateUserList}
             t={t} 
          />
        </div>

        {/* My List Column */}
        <div className="bg-primary/5 rounded-2xl border border-primary/20 p-5 flex flex-col h-[70vh] lg:shadow-xl lg:shadow-primary/5">
          <h2 className="text-xl font-semibold mb-4 text-white flex items-center">
            <span className="bg-primary px-3 py-1 rounded-md text-sm mr-3 ml-3">{userList.length}</span>
            {t('myListHeader')}
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
  );
}
