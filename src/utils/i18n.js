import { useState, useEffect } from 'react';

export const useI18n = (lang) => {
  const [dict, setDict] = useState({});

  useEffect(() => {
    const fetchDict = async () => {
      try {
        const url = chrome.runtime.getURL(`_locales/${lang}/messages.json`);
        const res = await fetch(url);
        const data = await res.json();
        setDict(data);
      } catch (e) {
        console.error('Failed to load i18n Dictionary', e);
      }
    };
    fetchDict();
  }, [lang]);

  const t = (key) => {
    return dict[key] ? dict[key].message : key;
  };

  return { t, loaded: Object.keys(dict).length > 0 };
};
