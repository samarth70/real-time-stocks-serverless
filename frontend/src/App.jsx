import { useState, useEffect, useCallback } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';
import { Activity, TrendingUp, TrendingDown, RefreshCcw, Moon, Sun, Search, X, Pause, Play } from 'lucide-react';
import './App.css';

const API_BASE = "https://real-time-stocks-api.sam747331.workers.dev";
const DEFAULT_SYMBOLS = ["AAPL", "MSFT", "TSLA", "GOOGL", "AMZN"];

const DUMMY_LATEST = [
  { symbol: 'AAPL', current_price: 175.4, change: 1.2, percent_change: 0.68 },
  { symbol: 'MSFT', current_price: 335.2, change: -2.1, percent_change: -0.62 },
  { symbol: 'TSLA', current_price: 240.5, change: 5.4, percent_change: 2.30 },
  { symbol: 'GOOGL', current_price: 132.1, change: 0.8, percent_change: 0.61 },
  { symbol: 'NVDA', current_price: 880.8, change: 12.3, percent_change: 1.40 }
];

const DUMMY_HISTORY = Array.from({ length: 60 }).map((_, i) => ({
  label: `10:${i.toString().padStart(2, '0')}`,
  close: 172 + Math.random() * 5,
})).reverse();

function App() {
  // Application State
  const [symbols, setSymbols] = useState(() => {
    const saved = localStorage.getItem('marketpulse_symbols');
    return saved ? JSON.parse(saved) : DEFAULT_SYMBOLS;
  });
  const [latestData, setLatestData] = useState([]);
  const [historyData, setHistoryData] = useState([]);
  
  // UI Controls State
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');
  const [selectedSymbol, setSelectedSymbol] = useState(symbols[0] || 'AAPL');
  const [timeframe, setTimeframe] = useState('1H'); 
  const [sortMode, setSortMode] = useState('DEFAULT'); 
  
  // UX State
  const [loading, setLoading] = useState(true);
  const [liveSync, setLiveSync] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [needsApiKey, setNeedsApiKey] = useState(false);

  // Theme Sync
  useEffect(() => {
    document.body.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Save Symbols
  useEffect(() => {
    localStorage.setItem('marketpulse_symbols', JSON.stringify(symbols));
    if (!symbols.includes(selectedSymbol) && symbols.length > 0) {
      setSelectedSymbol(symbols[0]);
    }
  }, [symbols, selectedSymbol]);

  // Dynamic Autocomplete Search Effect
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }
    
    const timeoutId = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(`${API_BASE}/api/stocks/search?q=${searchQuery}`);
        const data = await res.json();
        setSearchResults(data);
        setShowDropdown(true);
      } catch (err) {
        console.error("Search failed", err);
      } finally {
        setIsSearching(false);
      }
    }, 300); // 300ms debounce
    
    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  // API Fetching Layer
  const fetchDashboardData = useCallback(async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    try {
      if (symbols.length === 0) return;
      const symbolsQuery = symbols.join(',');
      
      const latestRes = await fetch(`${API_BASE}/api/stocks/latest?symbols=${symbolsQuery}`);
      let latest = await latestRes.json();
      
      if (latest.length === 0) {
         setNeedsApiKey(true);
         latest = DUMMY_LATEST.filter(d => symbols.includes(d.symbol));
         if (latest.length === 0 && symbols.length > 0) {
             latest = [{ symbol: symbols[0], current_price: 100, change: 0, percent_change: 0 }];
         }
      } else {
         setNeedsApiKey(false);
      }

      if (sortMode === 'GAINERS') {
        latest = [...latest].sort((a, b) => b.percent_change - a.percent_change);
      } else if (sortMode === 'LOSERS') {
        latest = [...latest].sort((a, b) => a.percent_change - b.percent_change);
      }
      setLatestData(latest);
      
      let historyURL = `${API_BASE}/api/stocks/history?symbol=${selectedSymbol}`;
      if (timeframe === '1D') {
        historyURL = `${API_BASE}/api/stocks/candles?symbol=${selectedSymbol}&resolution=D&count=30`;
      } else if (timeframe === '1W') {
        historyURL = `${API_BASE}/api/stocks/candles?symbol=${selectedSymbol}&resolution=W&count=26`;
      }
      
      const historyRes = await fetch(historyURL);
      const history = await historyRes.json();
      
      if (history.length === 0) {
          setHistoryData(DUMMY_HISTORY);
          return;
      }

      let mappedHistory = [];
      if (timeframe === '1H') {
         mappedHistory = history.map(item => {
           const date = new Date(item.fetched_at * 1000);
           return {
             label: `${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`,
             close: item.current_price
           };
         });
      } else {
         mappedHistory = history.map(item => {
           const date = new Date(item.time * 1000);
           return {
             label: timeframe === '1D' ? `${date.getMonth()+1}/${date.getDate()}` : `${date.getMonth()+1}/${date.getFullYear()}`,
             close: item.close
           };
         });
      }
      setHistoryData(mappedHistory);
    } catch (e) {
      console.warn("API Fetch Failed:", e);
    } finally {
      if (!isBackground) setLoading(false);
    }
  }, [symbols, selectedSymbol, timeframe, sortMode]);

  useEffect(() => {
    fetchDashboardData();
    let interval;
    if (liveSync) {
       interval = setInterval(() => fetchDashboardData(true), 60000);
    }
    return () => clearInterval(interval);
  }, [fetchDashboardData, liveSync]);

  // Handlers
  const handleSelectSymbol = (newSym) => {
    if (!symbols.includes(newSym)) {
      setSymbols([...symbols, newSym]);
    }
    setSelectedSymbol(newSym);
    setSearchQuery("");
    setShowDropdown(false);
  };

  const handeManualAdd = (e) => {
    e.preventDefault();
    const cleanSym = searchQuery.trim().toUpperCase();
    if (cleanSym) handleSelectSymbol(cleanSym);
  }

  const handleRemoveSymbol = (e, symToRemove) => {
    e.stopPropagation();
    setSymbols(symbols.filter(s => s !== symToRemove));
  };

  // Sub-components
  const KPICard = ({ data }) => {
    const isPositive = data.percent_change >= 0;
    const isSelected = selectedSymbol === data.symbol;
    return (
      <div 
        className={`glass-panel kpi-card animate-fade-in ${isSelected ? 'selected' : ''}`} 
        onClick={() => setSelectedSymbol(data.symbol)} 
        style={{cursor: 'pointer'}}
      >
        <button className="kpi-remove" onClick={(e) => handleRemoveSymbol(e, data.symbol)}>
          <X size={16} />
        </button>
        <span className="kpi-title">{data.symbol} - Latest</span>
        <div className="kpi-value">
          ${data.current_price?.toFixed(2) || '---'}
          <span className={`kpi-change ${isPositive ? 'text-success' : 'text-danger'}`}>
            {isPositive ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
            {Math.abs(data.percent_change || 0).toFixed(2)}%
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="app-container">
      {needsApiKey && (
        <div style={{background: 'var(--danger-color)', color: 'white', padding: '10px 16px', borderRadius: '8px', marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', animation: 'fadeIn 0.5s ease-out'}}>
          <span><strong>⚠️ Live Data Missing:</strong> Your Finnhub API Key is required or empty. Currently displaying mock simulation data.</span>
          <button onClick={() => setNeedsApiKey(false)} style={{background: 'transparent', border: 'none', color: 'white', cursor: 'pointer'}}><X size={16}/></button>
        </div>
      )}

      {/* Header */}
      <header className="header animate-fade-in">
        <div>
          <h1>MarketPulse</h1>
          <p className="text-secondary">Global Serverless Financial Dashboard</p>
        </div>
        <div className="controls">
          <button 
             className="pill-btn" 
             onClick={() => setLiveSync(!liveSync)}
          >
            {liveSync ? <Pause size={16} /> : <Play size={16} />} 
            {liveSync ? 'Live Syncing' : 'Paused'}
          </button>
          
          <button className="pill-btn" onClick={() => fetchDashboardData()} disabled={loading}>
            <RefreshCcw size={16} className={loading && liveSync ? 'spin' : ''} />
          </button>
          
          <button className="pill-btn" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </div>
      </header>

      {/* Toolbar / Search / Sorting */}
      <div className="dashboard-toolbar animate-fade-in">
         <div className="search-container">
           <form className="toolbar-group" onSubmit={handeManualAdd}>
             <Search size={18} className="search-icon" />
             <input 
               type="text" 
               className="input-field" 
               placeholder="Search Symbol (e.g. NVDA)" 
               value={searchQuery}
               onChange={(e) => setSearchQuery(e.target.value)}
             />
             <button type="submit" style={{display: 'none'}}>Add</button>
           </form>
           
           {/* Autocomplete Dropdown */}
           {showDropdown && (
             <div className="search-dropdown">
                {isSearching ? (
                  <div className="search-dropdown-item"><span className="search-desc">Searching...</span></div>
                ) : searchResults.length > 0 ? (
                  searchResults.map(result => (
                    <div 
                      key={result.symbol} 
                      className="search-dropdown-item"
                      onClick={() => handleSelectSymbol(result.symbol)}
                    >
                       <span className="search-symbol">{result.symbol}</span>
                       <span className="search-desc">{result.description}</span>
                    </div>
                  ))
                ) : (
                  <div className="search-dropdown-item"><span className="search-desc">No US stocks found.</span></div>
                )}
             </div>
           )}
         </div>
         
         <div className="toolbar-group">
            <span className="text-secondary text-sm">Sort By:</span>
            <select 
               className="select-dropdown" 
               value={sortMode}
               onChange={(e) => setSortMode(e.target.value)}
            >
              <option value="DEFAULT">Added Order</option>
              <option value="GAINERS">Top Gainers</option>
              <option value="LOSERS">Top Losers</option>
            </select>
         </div>
      </div>

      <div className="dashboard-grid">
        {/* KPI Layer */}
        <div className="kpi-wrapper">
          {latestData.length > 0 ? latestData.map((d) => (
            <KPICard key={d.symbol} data={d} />
          )) : <div className="text-secondary" style={{padding: '1rem', border: '1px dashed var(--border-color)', borderRadius: '16px'}}>No symbols tracked. Search for a stock above to begin.</div>}
        </div>

        {/* Dynamic Context Chart */}
        <div className="glass-panel chart-wrapper main-chart animate-fade-in" style={{ animationDelay: '0.1s'}}>
          <div className="chart-header">
            <h3>{selectedSymbol} Trendline</h3>
            <div className="controls">
              <button className={`pill-btn ${timeframe === '1H' ? 'active' : ''}`} onClick={() => setTimeframe('1H')}>1H</button>
              <button className={`pill-btn ${timeframe === '1D' ? 'active' : ''}`} onClick={() => setTimeframe('1D')}>1D (Daily)</button>
              <button className={`pill-btn ${timeframe === '1W' ? 'active' : ''}`} onClick={() => setTimeframe('1W')}>1W (Weekly)</button>
            </div>
          </div>
          <div style={{ height: 400 }}>
            {historyData.length > 0 ? (
               <ResponsiveContainer width="100%" height="100%">
                 <AreaChart data={historyData}>
                   <defs>
                     <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                       <stop offset="5%" stopColor={theme === 'dark' ? "#58a6ff" : "#0969da"} stopOpacity={0.4}/>
                       <stop offset="95%" stopColor={theme === 'dark' ? "#58a6ff" : "#0969da"} stopOpacity={0}/>
                     </linearGradient>
                   </defs>
                   <CartesianGrid strokeDasharray="3 3" stroke="rgba(150,150,150,0.1)" vertical={false} />
                   <XAxis dataKey="label" stroke="var(--text-secondary)" tick={{fill: 'var(--text-secondary)'}} tickMargin={10} />
                   <YAxis domain={['auto', 'auto']} stroke="var(--text-secondary)" tick={{fill: 'var(--text-secondary)'}} tickFormatter={val => `$${val.toFixed(2)}`} />
                   <Tooltip 
                     contentStyle={{ backgroundColor: 'var(--bg-color)', border: '1px solid var(--border-color)', borderRadius: '8px' }}
                     itemStyle={{ color: 'var(--text-primary)' }}
                     labelStyle={{ color: 'var(--text-secondary)' }}
                   />
                   <Area type="monotone" dataKey="close" stroke={theme === 'dark' ? "#58a6ff" : "#0969da"} strokeWidth={2} fillOpacity={1} fill="url(#colorPrice)" />
                 </AreaChart>
               </ResponsiveContainer>
            ) : <div className="text-secondary" style={{display:'flex', justifyContent:'center', alignItems:'center', height:'100%'}}>Loading historical data...</div>}
          </div>
        </div>

        {/* Tree/Bar Context Chart */}
        <div className="glass-panel chart-wrapper side-chart animate-fade-in" style={{ animationDelay: '0.2s'}}>
          <div className="chart-header" style={{marginBottom: 0}}>
            <h3>Volatility Tracker</h3>
          </div>
          <p className="text-secondary text-sm" style={{marginBottom: '1.5rem'}}>Percentage Change %</p>
          <div style={{ height: 350 }}>
             {latestData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={latestData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(150,150,150,0.1)" horizontal={false} />
                    <XAxis type="number" hide />
                    <YAxis dataKey="symbol" type="category" stroke="var(--text-secondary)" tick={{fill: 'var(--text-secondary)'}} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: 'var(--bg-color)', border: '1px solid var(--border-color)', borderRadius: '8px' }}
                      itemStyle={{ color: 'var(--text-primary)' }}
                      labelStyle={{ color: 'var(--text-secondary)' }}
                      cursor={{fill: 'rgba(255, 255, 255, 0.1)'}}
                    />
                    <Bar dataKey="percent_change" radius={[0, 4, 4, 0]}>
                      {latestData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.percent_change >= 0 ? 'var(--success-color)' : 'var(--danger-color)'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
             ) : <div className="text-secondary">No data.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
