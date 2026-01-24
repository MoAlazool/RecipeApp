
import React, { useState } from 'react';
import { motion, useMotionValue, useTransform } from 'framer-motion';
import { Recipe } from '../types';

interface FlashcardProps {
  recipe: Recipe;
  nextRecipe?: Recipe;
  onSwipe: (direction: 'left' | 'right') => void;
  activeIndex: number;
  totalItems: number;
}

export const Flashcard: React.FC<FlashcardProps> = ({ recipe, nextRecipe, onSwipe, activeIndex, totalItems }) => {
  const [isSaved, setIsSaved] = useState(false);
  
  // -- ANIMATION CORE --
  const x = useMotionValue(0);
  
  // Top card transformations
  const rotate = useTransform(x, [-200, 200], [-12, 12]);
  const opacity = useTransform(x, [-250, -150, 0, 150, 250], [0, 1, 1, 1, 0]);

  // Next card (background) transformations - It scales up as you drag the top card away
  const nextScale = useTransform(x, [-200, 0, 200], [1, 0.96, 1]);
  const nextTranslateY = useTransform(x, [-200, 0, 200], [0, 12, 0]);
  const nextBlueGlow = useTransform(x, [-200, 0, 200], ["rgba(59, 130, 246, 0.5)", "rgba(59, 130, 246, 0)", "rgba(59, 130, 246, 0.5)"]);

  const handleDragEnd = (_: any, info: any) => {
    if (Math.abs(info.offset.x) > 100) {
      onSwipe(info.offset.x > 0 ? 'right' : 'left');
    }
  };

  const inStock = recipe.ingredients.filter(i => i.inStock);
  const needed = recipe.ingredients.filter(i => !i.inStock);

  return (
    <div className="absolute inset-0 select-none">
      {/* 
        PREVIEW NEXT CARD (The "Blue" visual effect) 
        This card sits behind and becomes active as you swipe.
      */}
      {nextRecipe && (
        <motion.div 
          style={{ 
            scale: nextScale, 
            y: nextTranslateY,
            boxShadow: `0 0 40px ${nextBlueGlow.get()}`
          }}
          className="absolute inset-0 bg-white border-2 border-blue-100 rounded-[2.5rem] overflow-hidden z-10 shadow-lg"
        >
          {/* Subtle blue themed background for the next card preview */}
          <div className="absolute inset-0 bg-blue-50/30"></div>
          <div className="absolute top-4 right-6 flex items-center gap-1.5 opacity-40">
            <span className="text-[10px] font-black uppercase tracking-widest text-blue-600">Next Up</span>
            <span className="material-symbols-outlined text-[14px] text-blue-600">fast_forward</span>
          </div>
          <img 
            src={nextRecipe.image} 
            className="w-full h-1/2 object-cover opacity-20 grayscale-[0.5]" 
            alt="Next preview"
          />
        </motion.div>
      )}

      {/* The Swipable Top Card */}
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ 
          x: x.get() > 0 ? 600 : -600, 
          opacity: 0, 
          rotate: x.get() > 0 ? 30 : -30,
          transition: { duration: 0.4, ease: "easeOut" } 
        }}
        style={{ x, rotate, opacity }}
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        onDragEnd={handleDragEnd}
        whileTap={{ scale: 0.98 }}
        className="absolute inset-0 z-20 bg-white rounded-[2.5rem] shadow-[0_30px_60px_rgba(0,0,0,0.15)] border border-gray-100 overflow-hidden flex flex-col cursor-grab active:cursor-grabbing"
      >
        <div className="relative h-[46%] overflow-hidden">
          <img 
            alt={recipe.name} 
            className="w-full h-full object-cover pointer-events-none" 
            src={recipe.image} 
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent"></div>
          
          <div className="absolute top-6 left-6 flex flex-col gap-2">
            {recipe.isChefChoice && (
              <div className="bg-white/95 backdrop-blur-md px-3.5 py-2 rounded-xl shadow-sm flex items-center gap-1.5 w-fit border border-white/20">
                <span className="material-symbols-outlined text-olive text-[16px] font-bold material-symbols-fill">verified</span>
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-charcoal">Chef's Choice</span>
              </div>
            )}
            <div className="bg-primary px-3.5 py-2 rounded-xl shadow-lg flex items-center gap-1.5 w-fit text-white">
              <span className="text-[10px] font-black tracking-widest uppercase">{recipe.matchPercentage}% Match</span>
            </div>
          </div>

          <button 
            onClick={(e) => { 
              e.stopPropagation(); 
              setIsSaved(!isSaved); 
            }}
            className={`absolute top-6 right-6 w-12 h-12 rounded-full flex items-center justify-center transition-all duration-500 transform active:scale-75 ${
              isSaved ? 'bg-primary text-white shadow-xl scale-110' : 'bg-white/20 backdrop-blur-md text-white border border-white/40 hover:bg-white/30'
            }`}
          >
            <span className={`material-symbols-outlined text-[26px] ${isSaved ? 'material-symbols-fill' : ''}`}>
              favorite
            </span>
          </button>

          <div className="absolute bottom-6 left-7 right-7">
            <h2 className="text-2xl font-black text-white leading-tight mb-2.5 tracking-tight">{recipe.name}</h2>
            <div className="flex items-center gap-5">
              <span className="flex items-center gap-2 text-[12px] font-bold text-white/90">
                <span className="material-symbols-outlined text-[18px]">schedule</span> {recipe.prepTime}
              </span>
              <span className="flex items-center gap-2 text-[12px] font-bold text-white/90">
                <span className="material-symbols-outlined text-[18px]">stairs</span> {recipe.difficulty}
              </span>
            </div>
          </div>
        </div>

        <div className="px-7 py-8 flex-1 flex flex-col bg-white">
          <div className="flex flex-row h-full">
            <div className="flex-1 pr-6">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-2 h-2 rounded-full bg-olive shadow-[0_0_8px_rgba(96,108,56,0.4)]"></div>
                <h3 className="text-[11px] font-black text-gray-400 uppercase tracking-[0.18em]">In Stock</h3>
              </div>
              <div className="overflow-y-auto no-scrollbar max-h-[140px]">
                <p className="text-[15px] font-bold text-slate-700 leading-relaxed">
                  {inStock.length > 0 ? inStock.map(i => i.name).join(', ') : 'No items found'}
                </p>
              </div>
            </div>

            <div className="w-[1px] bg-gradient-to-b from-gray-50 via-gray-100 to-gray-50"></div>

            <div className="flex-1 pl-6">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-2 h-2 rounded-full bg-primary shadow-[0_0_8px_rgba(255,75,43,0.4)]"></div>
                <h3 className="text-[11px] font-black text-gray-400 uppercase tracking-[0.18em]">Needed</h3>
              </div>
              <div className="overflow-y-auto no-scrollbar max-h-[140px]">
                <p className="text-[15px] font-bold text-slate-700 leading-relaxed">
                  {needed.length > 0 ? needed.map(i => i.name).join(', ') : 'Ready to cook!'}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-auto pt-8 flex justify-center items-center gap-2">
            {Array.from({ length: totalItems }).map((_, i) => (
              <div 
                key={i} 
                className={`h-1.5 rounded-full transition-all duration-500 ease-in-out ${
                  i === activeIndex ? 'w-10 bg-[#121417]' : 'w-1.5 bg-gray-200/80'
                }`}
              ></div>
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  );
};
