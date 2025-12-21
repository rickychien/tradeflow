
import React from 'react';

interface WinRateChartProps {
  percentage: number;
  count: number;
}

export const WinRateChart: React.FC<WinRateChartProps> = ({ percentage, count }) => {
  const radius = 8;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;
  
  const colorClass = count === 0 
      ? 'text-slate-600' 
      : percentage >= 50 
          ? 'text-emerald-500' 
          : 'text-rose-500';

  return (
    <div className="relative w-6 h-6 flex items-center justify-center flex-shrink-0">
       <svg className="w-full h-full transform -rotate-90" viewBox="0 0 20 20">
          <circle 
            cx="10" cy="10" r={radius} 
            fill="transparent" 
            stroke="currentColor" 
            strokeWidth="2.5" 
            className="text-slate-700" 
          />
          {count > 0 && (
              <circle 
              cx="10" cy="10" r={radius} 
              fill="transparent" 
              stroke="currentColor" 
              strokeWidth="2.5" 
              strokeDasharray={circumference} 
              strokeDashoffset={offset} 
              strokeLinecap="round"
              className={`${colorClass} transition-all duration-500 ease-out`} 
              />
          )}
       </svg>
    </div>
  );
};
