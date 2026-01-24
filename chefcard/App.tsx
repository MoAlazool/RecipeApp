
import React, { useState, useCallback } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Header } from './components/Header';
import { CategoryFilters } from './components/CategoryFilters';
import { Flashcard } from './components/Flashcard';
import { MOCK_RECIPES } from './constants';
import { MealType, Recipe } from './types';

const App: React.FC = () => {
  const [mealType, setMealType] = useState<MealType>('Breakfast');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [recipes] = useState<Recipe[]>(MOCK_RECIPES);
  const [myIngredients, setMyIngredients] = useState([
    'Green juice', 'Yellow juice', 'Bread', 'Eggs', 'Hummus', 'Dill'
  ]);

  const handleSwipe = useCallback((direction: 'left' | 'right') => {
    if (direction === 'right') {
      setCurrentIndex((prev) => (prev + 1) % recipes.length);
    } else {
      setCurrentIndex((prev) => (prev - 1 + recipes.length) % recipes.length);
    }
  }, [recipes.length]);

  const currentRecipe = recipes[currentIndex];
  const nextRecipe = recipes[(currentIndex + 1) % recipes.length];

  return (
    <div className="flex flex-col h-screen max-w-md mx-auto bg-[#FDFDFD] shadow-2xl relative overflow-hidden font-sans">
      <Header />
      
      <main className="flex-1 flex flex-col px-6 overflow-hidden pb-8">
        <CategoryFilters 
          activeType={mealType} 
          onSelect={setMealType} 
        />

        {/* My Ingredients Slider Section */}
        <div className="flex-none mb-4 overflow-hidden">
           <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3 ml-1">My Pantry</p>
           <div className="flex items-center gap-3 overflow-x-auto no-scrollbar pb-4 -mx-6 px-6">
              <button className="flex-none w-11 h-11 rounded-full border-2 border-dashed border-gray-200 flex items-center justify-center text-gray-300 hover:border-primary hover:text-primary transition-all active:scale-90">
                <span className="material-symbols-outlined text-[24px]">add</span>
              </button>
              {myIngredients.map((ing, idx) => (
                <div key={idx} className="flex-none h-11 px-5 bg-white border border-slate-100 rounded-full flex items-center gap-2.5 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
                   <img src="https://fonts.gstatic.com/s/i/short_term/release/googlesymbols/kitchen/default/24px.svg" className="w-4 h-4 opacity-40" alt="" />
                   <span className="text-[13px] font-bold text-[#34495E] whitespace-nowrap">{ing}</span>
                </div>
              ))}
           </div>
        </div>

        {/* Dynamic Title Section */}
        <div className="flex-none mt-2 mb-6">
          <h2 className="text-[26px] font-black text-charcoal tracking-tight leading-none">
            Top Matches for {mealType}
          </h2>
          <p className="text-[13px] font-medium text-slate-400 mt-2 flex items-center gap-1.5">
            Swipe to browse <span className="text-[10px] opacity-40">•</span> Sorted by match %
          </p>
        </div>

        <div className="flex-1 relative mt-1 mb-6 perspective-1000">
          <AnimatePresence mode="popLayout" initial={false}>
            <Flashcard 
              key={currentRecipe.id}
              recipe={currentRecipe}
              nextRecipe={nextRecipe}
              onSwipe={handleSwipe}
              activeIndex={currentIndex}
              totalItems={recipes.length}
            />
          </AnimatePresence>
        </div>

        <div className="pt-2 flex-none">
          <div className="flex bg-[#121417] rounded-3xl overflow-hidden shadow-2xl transition-transform active:scale-[0.98]">
            <button className="flex-1 py-5 px-6 text-white font-bold text-sm text-center flex items-center justify-center gap-2 hover:bg-white/5 tracking-wide uppercase text-[12px] font-black">
              Cook This Meal Now
              <span className="material-symbols-outlined text-[18px]">restaurant</span>
            </button>
            <div className="w-[1px] bg-white/10 my-4"></div>
            <button className="px-6 py-5 flex items-center gap-2 text-white hover:bg-white/5">
              <span className="material-symbols-outlined text-xl">tune</span>
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;
