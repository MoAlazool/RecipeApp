
import React from 'react';

export const Header: React.FC = () => {
  return (
    <header className="flex-none pt-12 pb-2 px-6 bg-white z-50">
      <div className="flex items-center justify-between">
        <button className="w-10 h-10 -ml-2 rounded-full flex items-center justify-center text-charcoal hover:bg-black/5 transition-colors">
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <h1 className="text-lg font-extrabold text-charcoal tracking-tight">Flashcard Suggestions</h1>
        <div className="w-10"></div> {/* Spacer for symmetry */}
      </div>
    </header>
  );
};
