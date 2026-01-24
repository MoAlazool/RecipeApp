
import React from 'react';

interface BottomNavProps {
  activeTab: 'Home' | 'Fridge' | 'Saved' | 'Profile';
}

export const BottomNav: React.FC<BottomNavProps> = ({ activeTab }) => {
  const tabs = [
    { id: 'Home', label: 'Home', icon: 'home' },
    { id: 'Fridge', label: 'Fridge', icon: 'kitchen' },
    { id: 'Saved', label: 'Saved', icon: 'menu_book' },
    { id: 'Profile', label: 'Profile', icon: 'person' },
  ];

  return (
    <nav className="flex-none h-[84px] bg-white/95 backdrop-blur-lg border-t border-gray-100 flex items-start justify-around pt-4 z-50">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          className={`flex flex-col items-center gap-1 transition-all duration-300 relative ${
            activeTab === tab.id ? 'text-primary' : 'opacity-40 text-charcoal'
          }`}
        >
          {activeTab === tab.id && (
            <div className="w-8 h-1 bg-primary absolute -top-4 rounded-b-full"></div>
          )}
          <span className={`material-symbols-outlined text-2xl ${activeTab === tab.id ? 'material-symbols-fill' : ''}`}>
            {tab.icon}
          </span>
          <span className="text-[10px] font-bold">{tab.label}</span>
        </button>
      ))}
    </nav>
  );
};
