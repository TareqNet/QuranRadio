import React from 'react';
import { ArrowUp, ArrowDown, Trash2 } from 'lucide-react';

export default function MyListEditor({ userList, updateUserList, radios, reciters, t }) {
  
  const moveItem = (index, dir) => {
    const list = [...userList];
    if (dir === -1 && index > 0) {
      [list[index], list[index - 1]] = [list[index - 1], list[index]];
      updateUserList(list);
    } else if (dir === 1 && index < list.length - 1) {
      [list[index], list[index + 1]] = [list[index + 1], list[index]];
      updateUserList(list);
    }
  };

  const removeItem = (index) => {
    const list = [...userList];
    list.splice(index, 1);
    updateUserList(list);
  };

  if (userList.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center border-2 border-dashed border-white/10 rounded-xl">
        <p className="text-white/50">{t('noItemsMessage')}</p>
      </div>
    );
  }

  // Hydrate items just in case the language changed and we need the fresh name
  const hydratedList = userList.map(item => {
    let name = item.name;
    let moshafName = item.moshafName;
    
    if (item.type === 'radio' && radios.length) {
      const r = radios.find(x => String(x.id) === String(item.id));
      if (r) name = r.name;
    } else if (item.type === 'reciter' && reciters.length) {
      const r = reciters.find(x => String(x.id) === String(item.id));
      if (r) {
        name = r.name;
        const m = r.moshaf.find(x => x.server === item.server);
        if (m) moshafName = m.name;
      }
    }
    return { ...item, name, moshafName };
  });

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 pl-2">
      <ul className="space-y-3">
        {hydratedList.map((item, idx) => (
          <li key={idx} className="bg-black/30 border border-primary/20 p-3 rounded-lg flex justify-between items-center group">
            
            <div className="flex items-center flex-1 overflow-hidden">
              <span className="text-xl mr-3 opacity-70 ml-2">{item.type === 'radio' ? '📻' : '📖'}</span>
              <div className="flex flex-col truncate pr-2">
                <span className="font-semibold text-sm text-white truncate">{item.name}</span>
                {item.type === 'reciter' && (
                  <span className="text-xs text-emerald-400 truncate opacity-80">{item.moshafName}</span>
                )}
              </div>
            </div>

            <div className="flex items-center space-x-1 space-x-reverse shrink-0 opacity-80 group-hover:opacity-100 transition-opacity">
              <button 
                onClick={() => moveItem(idx, -1)}
                disabled={idx === 0}
                className="p-1.5 bg-black/50 hover:bg-white/10 rounded text-white/70 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="Up"
              >
                <ArrowUp className="w-4 h-4" />
              </button>
              <button 
                onClick={() => moveItem(idx, 1)}
                disabled={idx === userList.length - 1}
                className="p-1.5 bg-black/50 hover:bg-white/10 rounded text-white/70 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="Down"
              >
                <ArrowDown className="w-4 h-4" />
              </button>
              <button 
                onClick={() => removeItem(idx)}
                className="p-1.5 bg-red-500/10 hover:bg-red-500/40 border border-red-500/20 text-red-400 rounded transition-colors mr-2"
                title={t('removeLabel')}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

          </li>
        ))}
      </ul>
    </div>
  );
}
