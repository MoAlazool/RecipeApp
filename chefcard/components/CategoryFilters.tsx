
import React from 'react';
import { MealType } from '../types';

interface CategoryFiltersProps {
  activeType: MealType;
  onSelect: (type: MealType) => void;
}

export const CategoryFilters: React.FC<CategoryFiltersProps> = ({ activeType, onSelect }) => {
  const types: { id: MealType; label: string; icon: string }[] = [
    { id: 'Breakfast', label: 'Breakfast', icon: 'wb_sunny' },
    { id: 'Lunch', label: 'Lunch', icon: 'restaurant' },
    { id: 'Dinner', label: 'Dinner', icon: 'dark_mode' },
  ];

  return (
    <div className="py-4">
      <div className="flex gap-2">
        {types.map((type) => (
          <button
            key={type.id}
            onClick={() => onSelect(type.id)}
            className={`flex-1 flex flex-col items-center justify-center gap-1 py-3 rounded-2xl font-bold text-xs transition-all duration-300 ${
              activeType === type.id
                ? 'bg-primary text-white shadow-[0_4px_14px_0_rgba(255,75,43,0.3)]'
                : 'bg-white border border-gray-100 text-gray-400 hover:border-gray-200'
            }`}
          >
            <span className={`material-symbols-outlined text-[20px] ${activeType === type.id ? 'fill-white' : ''}`}>
              {type.icon}
            </span>
            {type.label}
          </button>
        ))}
      </div>
    </div>
  );
};
