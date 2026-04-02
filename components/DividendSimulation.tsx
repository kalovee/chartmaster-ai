
import React, { useState, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { ETFHolding } from '../types';

interface DividendSimulationProps {
  holdings: ETFHolding[];
  totalValue: number;
  totalIncome: number;
  onClose: () => void;
}

const DividendSimulation: React.FC<DividendSimulationProps> = ({ holdings, totalValue, totalIncome, onClose }) => {
  const [years, setYears] = useState(20);
  const [priceGrowth, setPriceGrowth] = useState(5); // 5% annual price appreciation
  const [divGrowth, setDivGrowth] = useState(3); // 3% annual dividend growth
  const [monthlyContribution, setMonthlyContribution] = useState(0);

  const simulationData = useMemo(() => {
    if (totalValue === 0) return [];

    const data = [];
    
    // Initial state for No DRIP
    let priceNoDrip = 100;
    let sharesNoDrip = totalValue / 100;
    let divRateNoDrip = totalIncome / sharesNoDrip;
    let cumulativeDivNoDrip = 0;

    // Initial state for With DRIP
    let priceWithDrip = 100;
    let sharesWithDrip = totalValue / 100;
    let divRateWithDrip = totalIncome / sharesWithDrip;
    let cumulativeDivWithDrip = 0;

    // Year 0
    data.push({
      year: 0,
      valueNoDrip: Math.round(totalValue),
      valueWithDrip: Math.round(totalValue),
      annualDivNoDrip: Math.round(totalIncome),
      annualDivWithDrip: Math.round(totalIncome),
    });

    for (let i = 1; i <= years; i++) {
      // Update Price and DivRate (same for both)
      priceNoDrip *= (1 + priceGrowth / 100);
      divRateNoDrip *= (1 + divGrowth / 100);
      
      priceWithDrip *= (1 + priceGrowth / 100);
      divRateWithDrip *= (1 + divGrowth / 100);

      // Monthly contributions (added at end of year for simplicity)
      const annualContribution = monthlyContribution * 12;
      
      // No DRIP Calculation
      const divNoDrip = sharesNoDrip * divRateNoDrip;
      cumulativeDivNoDrip += divNoDrip;
      sharesNoDrip += (annualContribution / priceNoDrip);
      const valueNoDrip = (sharesNoDrip * priceNoDrip);

      // With DRIP Calculation
      const divWithDrip = sharesWithDrip * divRateWithDrip;
      cumulativeDivWithDrip += divWithDrip;
      sharesWithDrip += ((divWithDrip + annualContribution) / priceWithDrip);
      const valueWithDrip = (sharesWithDrip * priceWithDrip);

      data.push({
        year: i,
        valueNoDrip: Math.round(valueNoDrip),
        valueWithDrip: Math.round(valueWithDrip),
        annualDivNoDrip: Math.round(divNoDrip),
        annualDivWithDrip: Math.round(divWithDrip),
      });
    }

    return data;
  }, [totalValue, totalIncome, years, priceGrowth, divGrowth, monthlyContribution]);

  const finalValueNoDrip = simulationData[simulationData.length - 1]?.valueNoDrip || 0;
  const finalValueWithDrip = simulationData[simulationData.length - 1]?.valueWithDrip || 0;
  const dripAdvantage = finalValueWithDrip - finalValueNoDrip;
  const dripMultiplier = finalValueNoDrip > 0 ? (finalValueWithDrip / finalValueNoDrip).toFixed(2) : '1.00';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white dark:bg-gray-900 w-full max-w-5xl max-h-[90vh] rounded-3xl shadow-2xl border border-gray-200 dark:border-gray-800 flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50/50 dark:bg-gray-950/50">
          <div>
            <h2 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight flex items-center gap-3">
              <span className="w-3 h-3 rounded-full bg-trading-green animate-pulse"></span>
              Dividend Reinvestment Simulator
            </h2>
            <p className="text-xs text-gray-500 font-mono mt-1">PROJECTION_ENGINE_V1.0 // COMPOUND_INTEREST_MODEL</p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-full transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-grow overflow-y-auto p-8 custom-scrollbar">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
            
            {/* Controls */}
            <div className="lg:col-span-4 space-y-8">
              <div className="space-y-6 bg-gray-50 dark:bg-gray-800/30 p-6 rounded-2xl border border-gray-100 dark:border-gray-800">
                <h3 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] mb-4">Simulation Parameters</h3>
                
                <div className="space-y-5">
                  <div>
                    <div className="flex justify-between mb-2">
                      <label className="text-xs font-bold text-gray-700 dark:text-gray-300">Time Horizon (Years)</label>
                      <span className="text-xs font-mono text-trading-green">{years}y</span>
                    </div>
                    <input 
                      type="range" min="1" max="50" value={years} 
                      onChange={(e) => setYears(parseInt(e.target.value))}
                      className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-trading-green"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between mb-2">
                      <label className="text-xs font-bold text-gray-700 dark:text-gray-300">Annual Price Growth (%)</label>
                      <span className="text-xs font-mono text-blue-400">{priceGrowth}%</span>
                    </div>
                    <input 
                      type="range" min="0" max="20" value={priceGrowth} 
                      onChange={(e) => setPriceGrowth(parseInt(e.target.value))}
                      className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between mb-2">
                      <label className="text-xs font-bold text-gray-700 dark:text-gray-300">Annual Dividend Growth (%)</label>
                      <span className="text-xs font-mono text-trading-yellow">{divGrowth}%</span>
                    </div>
                    <input 
                      type="range" min="0" max="20" value={divGrowth} 
                      onChange={(e) => setDivGrowth(parseInt(e.target.value))}
                      className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-trading-yellow"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-2">Monthly Contribution ($)</label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-gray-500 text-xs font-mono">$</span>
                      <input 
                        type="number" 
                        value={monthlyContribution} 
                        onChange={(e) => setMonthlyContribution(Math.max(0, parseInt(e.target.value) || 0))}
                        className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg py-2 pl-7 pr-3 text-sm font-mono focus:ring-1 focus:ring-trading-green outline-none"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Stats Summary */}
              <div className="space-y-4">
                <div className="p-5 bg-black rounded-2xl border border-gray-800 shadow-xl">
                  <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Projected Value (With DRIP)</p>
                  <p className="text-3xl font-black text-white font-mono">${finalValueWithDrip.toLocaleString()}</p>
                  <div className="mt-3 flex items-center gap-2">
                    <span className="text-[10px] font-bold bg-trading-green/20 text-trading-green px-2 py-0.5 rounded-full">+{dripMultiplier}x Growth</span>
                    <span className="text-[10px] font-bold text-gray-500">vs Initial</span>
                  </div>
                </div>

                <div className="p-5 bg-trading-green/5 dark:bg-trading-green/10 rounded-2xl border border-trading-green/20">
                  <p className="text-[10px] font-black text-trading-green uppercase tracking-widest mb-1">DRIP Advantage</p>
                  <p className="text-2xl font-black text-trading-green font-mono">+${dripAdvantage.toLocaleString()}</p>
                  <p className="text-[10px] text-gray-500 mt-1 italic">Extra wealth generated by reinvesting</p>
                </div>
              </div>
            </div>

            {/* Chart Area */}
            <div className="lg:col-span-8 space-y-8">
              <div className="bg-white dark:bg-gray-900/50 p-6 rounded-3xl border border-gray-100 dark:border-gray-800 h-[450px]">
                <h3 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] mb-6">Portfolio Growth Projection</h3>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={simulationData}>
                    <defs>
                      <linearGradient id="colorWithDrip" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#00FF7F" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#00FF7F" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorNoDrip" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#64748b" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#64748b" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} opacity={0.1} />
                    <XAxis 
                      dataKey="year" 
                      stroke="#64748b" 
                      fontSize={10} 
                      tickLine={false} 
                      axisLine={false}
                      tickFormatter={(val) => `Year ${val}`}
                    />
                    <YAxis 
                      stroke="#64748b" 
                      fontSize={10} 
                      tickLine={false} 
                      axisLine={false}
                      tickFormatter={(val) => `$${(val / 1000).toFixed(0)}k`}
                    />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', fontSize: '12px' }}
                      itemStyle={{ padding: '2px 0' }}
                      formatter={(value: number) => [`$${value.toLocaleString()}`, '']}
                      labelFormatter={(label) => `Year ${label}`}
                    />
                    <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', paddingBottom: '20px' }} />
                    <Area 
                      type="monotone" 
                      dataKey="valueWithDrip" 
                      name="With Reinvestment" 
                      stroke="#00FF7F" 
                      strokeWidth={3}
                      fillOpacity={1} 
                      fill="url(#colorWithDrip)" 
                    />
                    <Area 
                      type="monotone" 
                      dataKey="valueNoDrip" 
                      name="No Reinvestment" 
                      stroke="#64748b" 
                      strokeWidth={2}
                      fillOpacity={1} 
                      fill="url(#colorNoDrip)" 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Dividend Chart */}
              <div className="bg-white dark:bg-gray-900/50 p-6 rounded-3xl border border-gray-100 dark:border-gray-800 h-[250px]">
                <h3 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] mb-6">Annual Dividend Income Projection</h3>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={simulationData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} opacity={0.1} />
                    <XAxis 
                      dataKey="year" 
                      stroke="#64748b" 
                      fontSize={10} 
                      tickLine={false} 
                      axisLine={false}
                    />
                    <YAxis 
                      stroke="#64748b" 
                      fontSize={10} 
                      tickLine={false} 
                      axisLine={false}
                      tickFormatter={(val) => `$${val.toLocaleString()}`}
                    />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', fontSize: '12px' }}
                      formatter={(value: number) => [`$${value.toLocaleString()}`, '']}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="annualDivWithDrip" 
                      name="Div (With DRIP)" 
                      stroke="#00FF7F" 
                      strokeWidth={2} 
                      dot={false}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="annualDivNoDrip" 
                      name="Div (No DRIP)" 
                      stroke="#64748b" 
                      strokeWidth={2} 
                      strokeDasharray="5 5"
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-gray-50 dark:bg-gray-950/80 border-t border-gray-100 dark:border-gray-800 text-center">
          <p className="text-[10px] text-gray-500 font-mono uppercase tracking-widest">
            * Simulation assumes constant growth rates and no taxes. Past performance is not indicative of future results.
          </p>
        </div>
      </div>
    </div>
  );
};

export default DividendSimulation;
