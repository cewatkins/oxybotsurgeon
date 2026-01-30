
import React from 'react';

interface ControlKnobProps {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (val: number) => void;
  color?: string;
}

const ControlKnob: React.FC<ControlKnobProps> = ({ label, value, min, max, onChange, color = 'emerald' }) => {
  const rotation = ((value - min) / (max - min)) * 270 - 135;

  return (
    <div className="flex flex-col items-center space-y-2">
      <div className="relative group cursor-pointer" onClick={() => {
        const next = value + (max - min) / 10;
        onChange(next > max ? min : next);
      }}>
        <div className="w-12 h-12 rounded-full bg-slate-800 border-2 border-slate-700 flex items-center justify-center shadow-lg relative">
          <div 
            className="w-full h-full absolute flex items-start justify-center pt-1 transition-transform duration-200"
            style={{ transform: `rotate(${rotation}deg)` }}
          >
            <div className={`w-1 h-3 rounded-full bg-${color}-400 shadow-[0_0_5px_rgba(74,222,128,0.5)]`} />
          </div>
          <div className="w-8 h-8 rounded-full bg-slate-900 border border-slate-700 shadow-inner" />
        </div>
      </div>
      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{label}</span>
      <span className="text-[10px] font-bold text-slate-300">{value.toFixed(1)}</span>
    </div>
  );
};

export default ControlKnob;
