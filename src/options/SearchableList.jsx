import React, { useState } from 'react';
import { Plus } from 'lucide-react';

export default function SearchableList({ type, items, userList, updateUserList, t }) {
  const [query, setQuery] = useState('');

  const filtered = items.filter(i => i.name.toLowerCase().includes(query.toLowerCase()));

  const handleAdd = (item, moshafIndex = 0) => {
    let newItem = {};
    if (type === 'radio') {
      newItem = { type: 'radio', id: item.id, name: item.name, url: item.url };
    } else {
      const selectedMoshaf = item.moshaf[moshafIndex];
      newItem = {
        type: 'reciter',
        id: item.id,
        moshafId: selectedMoshaf.id,
        name: item.name,
        moshafName: selectedMoshaf.name,
        server: selectedMoshaf.server,
        surahList: selectedMoshaf.surah_list
      };
    }

    const updated = [...userList, newItem];
    updateUserList(updated);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <input 
        type="text" 
        placeholder={t('searchPlaceholder')} 
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 mb-4 text-sm outline-none focus:border-primary transition-colors"
      />

      <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 pl-2">
        <ul className="space-y-3">
          {filtered.map(item => (
            <li key={item.id} className="bg-black/20 p-3 rounded-lg border border-white/5 flex flex-col justify-between hover:bg-black/40 transition-colors group">
              
              <div className="flex justify-between items-start w-full">
                <span className="font-medium text-sm text-white/90 leading-relaxed max-w-[70%]">
                  {item.name}
                </span>
                
                {/* Add button for single items or fallback */}
                {type === 'radio' && (
                  <button 
                    onClick={() => handleAdd(item)}
                    className="bg-primary/20 hover:bg-primary text-primaryLight hover:text-white p-1.5 rounded-md transition-all shrink-0"
                    title={t('addButton')}
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                )}
              </div>

              {type === 'reciter' && item.moshaf && item.moshaf.length > 0 && (
                <div className="mt-3 flex gap-2 items-center">
                  <select 
                    id={`moshaf-${item.id}`}
                    className="flex-1 bg-black/50 border border-white/10 rounded p-1.5 text-xs text-white/70 outline-none truncate"
                  >
                    {item.moshaf.map((m, idx) => (
                      <option key={m.id} value={idx}>{m.name}</option>
                    ))}
                  </select>
                  <button 
                    onClick={() => {
                      const select = document.getElementById(`moshaf-${item.id}`);
                      handleAdd(item, parseInt(select.value));
                    }}
                    className="bg-primary/20 hover:bg-primary text-primaryLight hover:text-white px-3 py-1.5 rounded-md transition-all text-xs font-bold"
                  >
                    {t('addButton')}
                  </button>
                </div>
              )}

            </li>
          ))}
          {filtered.length === 0 && (
            <div className="text-center text-white/50 text-sm mt-8">لا يوجد نتائج</div>
          )}
        </ul>
      </div>
    </div>
  );
}
