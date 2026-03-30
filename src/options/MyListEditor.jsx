import React from 'react';
import { GripVertical, Trash2 } from 'lucide-react';

export default function MyListEditor({ userList, updateUserList, radios, reciters, t }) {
  
  const [draggedIndex, setDraggedIndex] = React.useState(null);
  const [localList, setLocalList] = React.useState(userList);

  // Sync local list with store when not dragging
  React.useEffect(() => {
    if (draggedIndex === null) {
      setLocalList(userList);
    }
  }, [userList, draggedIndex]);

  const onDragStart = (e, index) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    // Optimization for ghost image
    e.currentTarget.style.opacity = '0.5';
  };

  const onDragEnd = (e) => {
    e.currentTarget.style.opacity = '1';
    setDraggedIndex(null);
    updateUserList(localList); // Final save to storage
  };

  const onDragOver = (e, index) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    
    // Smooth reordering in local state
    const list = [...localList];
    const item = list[draggedIndex];
    list.splice(draggedIndex, 1);
    list.splice(index, 0, item);
    
    setDraggedIndex(index);
    setLocalList(list);
  };

  const onDrop = (e) => {
    e.preventDefault();
  };

  const removeItem = (index) => {
    const list = [...userList];
    list.splice(index, 1);
    updateUserList(list);
  };

  if (userList.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center border-2 border-dashed border-gray-300 dark:border-white/10 rounded-xl">
        <p className="text-gray-500 dark:text-white/50">{t('noItemsMessage')}</p>
      </div>
    );
  }

  // Hydrate items just in case the language changed and we need the fresh name
  const hydratedList = localList.map(item => {
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
          <li 
            key={idx} 
            draggable
            onDragStart={(e) => onDragStart(e, idx)}
            onDragOver={(e) => onDragOver(e, idx)}
            onDragEnd={onDragEnd}
            onDrop={onDrop}
            className={`bg-white dark:bg-black/30 border border-primary/20 p-3 rounded-lg flex justify-between items-center group shadow-sm dark:shadow-none transition-all ${draggedIndex === idx ? 'border-gold ring-1 ring-gold' : ''}`}
          >
            
            <div className="flex items-center flex-1 overflow-hidden pointer-events-none">
              <span className="text-xl mr-3 opacity-70 ml-2">{item.type === 'radio' ? '📻' : '📖'}</span>
              <div className="flex flex-col truncate pr-2">
                <span className="font-semibold text-sm text-gray-800 dark:text-white truncate">{item.name}</span>
                {item.type === 'reciter' && (
                  <span className="text-xs text-emerald-400 truncate opacity-80">{item.moshafName}</span>
                )}
              </div>
            </div>

            <div className="flex items-center space-x-1 space-x-reverse shrink-0 opacity-80 group-hover:opacity-100 transition-opacity">
              <div className="cursor-grab active:cursor-grabbing p-2 text-gray-400 hover:text-gold transition-colors">
                <GripVertical className="w-5 h-5" />
              </div>
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
