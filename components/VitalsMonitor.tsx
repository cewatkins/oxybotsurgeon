
import React, { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, CartesianGrid } from 'recharts';
import { VitalsData } from '../types';

interface VitalsMonitorProps {
  data: VitalsData[];
}

const VitalsMonitor: React.FC<VitalsMonitorProps> = ({ data }) => {
  return (
    <div className="w-full h-48 bg-black border border-slate-800 rounded p-2 overflow-hidden relative">
      <div className="absolute top-2 left-2 z-10 flex space-x-4 text-[10px] font-bold">
        <span className="text-green-500">EKG: STABLE</span>
        <span className="text-red-500">BPM: {data[data.length - 1]?.heartRate || 72}</span>
        <span className="text-blue-400">O2: {data[data.length - 1]?.oxygen || 98}%</span>
      </div>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
          <XAxis dataKey="time" hide />
          <YAxis hide domain={['auto', 'auto']} />
          <Line 
            type="monotone" 
            dataKey="heartRate" 
            stroke="#4ade80" 
            strokeWidth={2} 
            dot={false} 
            isAnimationActive={false} 
          />
          <Line 
            type="monotone" 
            dataKey="oxygen" 
            stroke="#38bdf8" 
            strokeWidth={1} 
            dot={false} 
            isAnimationActive={false} 
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default VitalsMonitor;
