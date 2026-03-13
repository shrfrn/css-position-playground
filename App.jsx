import React, { useState, useRef, useLayoutEffect, useCallback, useEffect } from 'react';
import { Settings2, Maximize2, Minus, X, Info, ZoomIn, ZoomOut } from 'lucide-react';

const INITIAL_OUTER = {
  position: 'static',
  top: { value: 0, auto: true },
  right: { value: 0, auto: true },
  bottom: { value: 0, auto: true },
  left: { value: 0, auto: true },
};

const INITIAL_INNER = {
  position: 'static',
  top: { value: 0, auto: true },
  right: { value: 0, auto: true },
  bottom: { value: 0, auto: true },
  left: { value: 0, auto: true },
};

const POSITIONS = ['static', 'relative', 'absolute', 'fixed', 'sticky'];

// Helper to convert config state to React style object
const getStyles = (config) => ({
  position: config.position,
  top: config.top.auto ? 'auto' : `${config.top.value}px`,
  right: config.right.auto ? 'auto' : `${config.right.value}px`,
  bottom: config.bottom.auto ? 'auto' : `${config.bottom.value}px`,
  left: config.left.auto ? 'auto' : `${config.left.value}px`,
});

// Calculate local coordinates relative to the fixed viewport window
const getLocalRect = (el, referenceWindow) => {
  if (!el || !referenceWindow) return null;
  const rect = el.getBoundingClientRect();
  const refRect = referenceWindow.getBoundingClientRect();
  return {
    top: rect.top - refRect.top,
    bottom: rect.bottom - refRect.top,
    left: rect.left - refRect.left,
    right: rect.right - refRect.left,
    width: rect.width,
    height: rect.height,
  };
};

export default function App() {
  const [outerConfig, setOuterConfig] = useState(INITIAL_OUTER);
  const [innerConfig, setInnerConfig] = useState(INITIAL_INNER);
  const [arrows, setArrows] = useState([]);
  const [animKey, setAnimKey] = useState(0);
  const [zoom, setZoom] = useState(1);

  const ZOOM_MIN = 0.25;
  const ZOOM_MAX = 1;
  const zoomPercent = Math.round(zoom * 100);

  // Structure References
  const windowRef = useRef(null); // The fixed mock viewport (CB for fixed)
  const scrollRef = useRef(null); // The scrolling document container
  const containerRef = useRef(null); // The gray containing block (CB for absolute)
  
  const outerRef = useRef(null);
  const innerRef = useRef(null);
  const outerGhostRef = useRef(null);
  const innerGhostRef = useRef(null);

  const updateMeasurements = useCallback(() => {
    const win = windowRef.current;
    if (!win) return;

    const outerRect = getLocalRect(outerRef.current, win);
    const innerRect = getLocalRect(innerRef.current, win);
    const outerGhostRect = getLocalRect(outerGhostRef.current, win);
    const innerGhostRect = getLocalRect(innerGhostRef.current, win);
    const containerRect = getLocalRect(containerRef.current, win);

    if (!outerRect || !innerRect || !outerGhostRect || !innerGhostRect || !containerRect) return;

    const winRect = win.getBoundingClientRect();
    const visibleViewportCB = {
      top: 0, left: 0, bottom: winRect.height, right: winRect.width, width: winRect.width, height: winRect.height
    };

    const newArrows = [];

    const getCB = (isOuter) => {
      const pos = isOuter ? outerConfig.position : innerConfig.position;
      if (pos === 'fixed' || pos === 'sticky') return visibleViewportCB;
      if (pos === 'relative') return isOuter ? outerGhostRect : innerGhostRect;
      if (pos === 'absolute') {
        // Inner absolute relies on positioned Outer. Otherwise falls back to the Containing Block (Gray Box).
        return (!isOuter && outerConfig.position !== 'static') ? outerRect : containerRect;
      }
      return null;
    };

    const addArrowsForEl = (config, elRect, isOuter) => {
      if (config.position === 'static') return;
      const cb = getCB(isOuter);
      if (!cb) return;

      const color = isOuter ? '#0284c7' : '#ea580c'; // Sky : Orange
      const elCenterX = elRect.left + elRect.width / 2;
      const elCenterY = elRect.top + elRect.height / 2;

      const create = (prop, sX, sY, eX, eY, label) => {
        newArrows.push({ id: `${isOuter ? 'outer' : 'inner'}-${prop}`, sX, sY, eX, eY, color, label });
      };

      if (config.position === 'sticky') {
        // Sticky arrows point to the threshold line relative to viewport bounds
        if (!config.top.auto) create('top', elCenterX, cb.top, elCenterX, cb.top + config.top.value, `top: ${config.top.value}px`);
        if (!config.bottom.auto) create('bottom', elCenterX, cb.bottom, elCenterX, cb.bottom - config.bottom.value, `bottom: ${config.bottom.value}px`);
        if (!config.left.auto) create('left', cb.left, elCenterY, cb.left + config.left.value, elCenterY, `left: ${config.left.value}px`);
        if (!config.right.auto) create('right', cb.right, elCenterY, cb.right - config.right.value, elCenterY, `right: ${config.right.value}px`);
      } else {
        // Other positions map from the containing block edge to the element's actual edge
        if (!config.top.auto) create('top', elCenterX, cb.top, elCenterX, elRect.top, `top: ${config.top.value}px`);
        if (!config.bottom.auto) create('bottom', elCenterX, cb.bottom, elCenterX, elRect.bottom, `bottom: ${config.bottom.value}px`);
        if (!config.left.auto) create('left', cb.left, elCenterY, elRect.left, elCenterY, `left: ${config.left.value}px`);
        if (!config.right.auto) create('right', cb.right, elCenterY, elRect.right, elCenterY, `right: ${config.right.value}px`);
      }
    };

    addArrowsForEl(outerConfig, outerRect, true);
    addArrowsForEl(innerConfig, innerRect, false);

    setArrows(newArrows);
  }, [outerConfig, innerConfig]);

  useLayoutEffect(() => {
    updateMeasurements();
  }, [updateMeasurements]);

  useLayoutEffect(() => {
    // Pre-scroll the canvas to the center so the user has immediate left/right scroll room
    if (scrollRef.current) {
      scrollRef.current.scrollTop = (scrollRef.current.scrollHeight - scrollRef.current.clientHeight) / 2;
      scrollRef.current.scrollLeft = (scrollRef.current.scrollWidth - scrollRef.current.clientWidth) / 2;
    }
  }, []);

  useEffect(() => {
    const scrollEl = scrollRef.current;
    if (!scrollEl) return;
    
    scrollEl.addEventListener('scroll', updateMeasurements);
    window.addEventListener('resize', updateMeasurements);
    
    return () => {
      scrollEl.removeEventListener('scroll', updateMeasurements);
      window.removeEventListener('resize', updateMeasurements);
    };
  }, [updateMeasurements]);

  const handlePosChange = (isOuter, pos) => {
    if (isOuter) {
      setOuterConfig(prev => ({ ...prev, position: pos }));
    } else {
      setInnerConfig(prev => ({ ...prev, position: pos }));
    }
    
    if (['fixed', 'sticky'].includes(pos)) {
      setAnimKey(k => k + 1);
    }
  };

  const isFixedOrSticky = ['fixed', 'sticky'].includes(outerConfig.position) || ['fixed', 'sticky'].includes(innerConfig.position);

  return (
    <div className="flex flex-col h-screen w-full bg-slate-900 text-slate-200 font-sans overflow-hidden">
      {/* Full-width header */}
      <header className="w-full shrink-0 p-5 border-b border-slate-700 flex items-center gap-3 bg-slate-800 z-20">
        <Settings2 className="w-6 h-6 text-indigo-400" aria-hidden />
        <h1 className="text-xl font-bold text-white tracking-wide">CSS Position</h1>
      </header>

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Sidebar Controls */}
        <div className="w-[480px] shrink-0 bg-transparent border-r border-slate-800/70 flex flex-col overflow-y-auto shadow-xl z-10 custom-scrollbar">
          <div className="p-5 space-y-8">
          <ControlPanel
            title="Outer Element"
            config={outerConfig}
            setConfig={setOuterConfig}
            onPosChange={(pos) => handlePosChange(true, pos)}
            colorTheme="sky"
          />
          <ControlPanel
            title="Inner Element"
            config={innerConfig}
            setConfig={setInnerConfig}
            onPosChange={(pos) => handlePosChange(false, pos)}
            colorTheme="orange"
          />
          </div>
        </div>

        {/* Main Area / Mock Browser */}
        <div className="flex-1 p-8 pt-12 flex items-start justify-center bg-slate-950 overflow-hidden relative">
          <div className="w-full max-w-5xl max-h-[560px] mt-6 bg-white rounded-xl shadow-2xl flex flex-col overflow-hidden border border-slate-700">
          
          {/* Browser Header */}
          <div className="h-14 bg-slate-100 border-b border-slate-300 flex items-center px-4 shrink-0">
            <div className="flex gap-2 w-20">
              <div className="w-3.5 h-3.5 rounded-full bg-red-400 shadow-inner"></div>
              <div className="w-3.5 h-3.5 rounded-full bg-amber-400 shadow-inner"></div>
              <div className="w-3.5 h-3.5 rounded-full bg-green-400 shadow-inner"></div>
            </div>
            <div className="flex-1 bg-white/60 rounded-md border border-slate-300/60 h-8 flex items-center justify-center px-4 text-sm text-slate-500 font-mono shadow-inner mx-4">
              playground.css/position
            </div>
            <div className="flex gap-4 text-slate-400 w-20 justify-end">
              <Minus className="w-4 h-4" />
              <Maximize2 className="w-4 h-4" />
              <X className="w-4 h-4" />
            </div>
          </div>

          {/* Viewport Canvas (Establishes Containing Block for Fixed Elements) */}
          <div
            ref={windowRef}
            className="flex-1 relative overflow-hidden transform-gpu bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:20px_20px] text-slate-800"
          >
            {/* SVG Overlay (Stays securely fixed to the mock window) */}
            <div className="absolute top-0 left-0 w-full h-full z-50 pointer-events-none">
              <svg className="w-full h-full overflow-visible">
                <defs>
                  <marker id="arrow-outer" markerWidth="14" markerHeight="14" refX="7" refY="6" orient="auto" markerUnits="userSpaceOnUse">
                    <polyline points="2,2 8,6 2,10" fill="none" stroke="#0284c7" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </marker>
                  <marker id="arrow-inner" markerWidth="14" markerHeight="14" refX="7" refY="6" orient="auto" markerUnits="userSpaceOnUse">
                    <polyline points="2,2 8,6 2,10" fill="none" stroke="#ea580c" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </marker>
                </defs>
                {arrows.map((arrow) => (
                  <ArrowLine key={arrow.id} {...arrow} />
                ))}
              </svg>
            </div>

            {/* Scrollable Document Area */}
            <div ref={scrollRef} className="w-full h-full overflow-auto relative">
              <div
                className="flex flex-col items-center justify-center relative z-10 gap-12 origin-top-left"
                style={{
                  width: 3000,
                  height: 3000,
                  transform: `scale(${zoom})`,
                }}
              >
                
                <div className="h-[120px] w-[1000px] border-4 border-dashed border-slate-300/50 rounded-xl flex items-center justify-start px-12 text-slate-400 font-sans font-medium text-xl bg-white/40 backdrop-blur-sm shadow-sm shrink-0">
                  <div key={animKey} className={`text-center w-full flex justify-between items-center ${isFixedOrSticky && animKey > 0 ? 'attention-active' : ''}`}>
                    <div className="flex flex-col items-start text-left">
                      <div>Scroll horizontally and vertically</div>
                      <div>to test sticky/fixed</div>
                    </div>
                    <div className="flex items-center justify-center gap-6 text-slate-400">
                        {/* Left Arrow */}
                        <svg width="60" height="24" viewBox="0 0 60 24" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M60 12 L4 12 M18 2 L4 12 L18 22" />
                        </svg>
                        {/* Right Arrow */}
                        <svg width="60" height="24" viewBox="0 0 60 24" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M0 12 L56 12 M42 2 L56 12 L42 22" />
                        </svg>
                    </div>
                  </div>
                </div>

                {/* Light Gray Containing Block */}
                <div 
                  ref={containerRef}
                  className="w-[1000px] bg-slate-100 rounded-xl border-2 border-slate-300 px-12 py-16 relative shadow-inner shrink-0"
                >
                  <span className="absolute top-4 left-4 text-xs font-bold text-slate-400 uppercase tracking-wider font-sans">Containing Block</span>

                  {/* Top Flow Space to give sticky elements room to slide UP */}
                  <div className="w-full h-[250px] border-2 border-dashed border-slate-300/60 rounded-lg flex items-center justify-center text-slate-400/80 mb-12 bg-slate-50/50">
                      <span className="font-mono text-sm uppercase tracking-widest">Flow Content Above</span>
                  </div>

                  {/* Invisible Spacer perfectly centers Outer in the 904px content box (1000px - px-12 padding) */}
                  <div className="float-left w-[302px] h-[10px]"></div>

                  {/* Outer Ghost */}
                  <div className="float-left w-0 h-0 overflow-visible pointer-events-none">
                    <div
                      ref={outerGhostRef}
                      className={`w-[300px] h-[300px] outline outline-2 outline-dashed outline-sky-400 bg-sky-50/30 rounded-lg transition-opacity duration-300 ${outerConfig.position !== 'static' ? 'opacity-100' : 'opacity-0'}`}
                    ></div>
                  </div>

                  {/* Actual Outer Element (Uses CSS Grid to perfectly overlay children without absolute positioning traps) */}
                  <div
                    ref={outerRef}
                    className="float-left w-[300px] h-[300px] outline outline-2 outline-sky-500 bg-sky-100/40 shadow-lg rounded-lg z-20 grid"
                    style={{ ...getStyles(outerConfig), gridTemplateColumns: '1fr', gridTemplateRows: '1fr' }}
                  >
                    {/* Content Layer (Inner Elements) */}
                    <div style={{ gridArea: '1/1' }} className="w-full h-full text-left">
                      {/* Inner Ghost */}
                      <div className="float-left w-0 h-0 overflow-visible pointer-events-none">
                        <div
                          ref={innerGhostRef}
                          className={`w-[140px] h-[140px] outline outline-2 outline-dashed outline-orange-400 bg-orange-50/30 rounded-md transition-opacity duration-300 mix-blend-multiply ${innerConfig.position !== 'static' ? 'opacity-100' : 'opacity-0'}`}
                        ></div>
                      </div>

                      {/* Actual Inner Element */}
                      <div
                        ref={innerRef}
                        className="float-left w-[140px] h-[140px] outline outline-2 outline-orange-500 bg-orange-100/40 shadow-md rounded-md z-30 mix-blend-multiply grid"
                        style={{ ...getStyles(innerConfig), gridTemplateColumns: '1fr', gridTemplateRows: '1fr' }}
                      >
                        <div style={{ gridArea: '1/1' }} className="w-full h-full flex items-end justify-end p-2 pointer-events-none">
                          <span className="text-sm font-bold text-orange-800/60 uppercase tracking-wider font-sans leading-none">Inner Div</span>
                        </div>
                      </div>
                      <div className="clear-both"></div>
                    </div>

                    {/* Text Layer - Safely locked to bottom right of element box */}
                    <div style={{ gridArea: '1/1' }} className="w-full h-full flex items-end justify-end p-3 pointer-events-none">
                      <span className="text-sm font-bold text-sky-800/60 uppercase tracking-wider font-sans leading-none">Outer Div</span>
                    </div>
                  </div>
                  
                  <div className="clear-both"></div>

                  {/* Bottom Flow Space to give sticky elements room to slide DOWN */}
                  <div className="w-full h-[250px] border-2 border-dashed border-slate-300/60 rounded-lg flex items-center justify-center text-slate-400/80 mt-12 bg-slate-50/50">
                      <span className="font-mono text-sm uppercase tracking-widest">Flow Content Below</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Floating zoom control - bottom right */}
            <div
              className="absolute bottom-3 right-3 z-50 flex flex-col items-center gap-2 py-2 px-2.5 rounded-lg bg-slate-800/95 border border-slate-600 shadow-lg pointer-events-auto"
              role="group"
              aria-label="Canvas zoom"
            >
              <ZoomIn className="w-4 h-4 text-slate-400 shrink-0" aria-hidden />
              <div className="flex items-center justify-center h-28 w-6" style={{ transform: 'rotate(-90deg)' }}>
                <input
                  type="range"
                  min={ZOOM_MIN * 100}
                  max={ZOOM_MAX * 100}
                  value={zoomPercent}
                  onChange={(e) => setZoom(Number(e.target.value) / 100)}
                  className="w-28 h-5 accent-sky-500 appearance-none bg-slate-600 rounded-full cursor-pointer range-vertical"
                  aria-label="Zoom level"
                  aria-valuemin={ZOOM_MIN * 100}
                  aria-valuemax={ZOOM_MAX * 100}
                  aria-valuenow={zoomPercent}
                  aria-valuetext={`${zoomPercent}%`}
                />
              </div>
              <ZoomOut className="w-4 h-4 text-slate-400 shrink-0" aria-hidden />
              <span className="text-xs font-mono text-slate-400 tabular-nums shrink-0" aria-hidden>{zoomPercent}%</span>
            </div>
          </div>
          </div>
        </div>
      </div>
      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { width: 8px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background-color: #475569; border-radius: 20px; border: 2px solid #1e293b; }
        
        @keyframes shimmer-mask {
          0% { -webkit-mask-position: 100% 0; mask-position: 100% 0; }
          100% { -webkit-mask-position: 0% 0; mask-position: 0% 0; }
        }
        .attention-active {
          -webkit-mask-image: linear-gradient(60deg, #000 35%, rgba(0,0,0,0.2) 50%, #000 65%);
          mask-image: linear-gradient(60deg, #000 35%, rgba(0,0,0,0.2) 50%, #000 65%);
          -webkit-mask-size: 400% 100%;
          mask-size: 400% 100%;
          animation: shimmer-mask 1.5s ease-in-out 3 forwards;
        }
        .range-vertical::-webkit-slider-runnable-track {
          height: 8px;
          border-radius: 9999px;
          background: linear-gradient(90deg, #1f2937, #4b5563);
          box-shadow:
            inset 0 0 0 1px rgba(15, 23, 42, 0.9),
            0 0 0 1px rgba(15, 23, 42, 0.9);
        }
        .range-vertical::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: #0ea5e9;
          cursor: pointer;
          margin-top: -4px;
        }
        .range-vertical::-moz-range-track {
          height: 8px;
          border-radius: 9999px;
          background: linear-gradient(90deg, #1f2937, #4b5563);
          box-shadow:
            inset 0 0 0 1px rgba(15, 23, 42, 0.9),
            0 0 0 1px rgba(15, 23, 42, 0.9);
        }
        .range-vertical::-moz-range-thumb {
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: #0ea5e9;
          cursor: pointer;
          border: 0;
        }
        .inset-range::-webkit-slider-runnable-track {
          height: 6px;
          border-radius: 9999px;
          background: radial-gradient(circle at 50% 50%, #64748b 0, #1f2937 55%);
          box-shadow:
            inset 0 0 0 1px rgba(15, 23, 42, 0.9),
            0 0 0 1px rgba(15, 23, 42, 0.9);
        }
        .inset-range::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 14px;
          height: 14px;
          border-radius: 9999px;
          background: #e5e7eb;
          box-shadow:
            0 0 0 1px rgba(15, 23, 42, 0.9),
            0 4px 8px rgba(15, 23, 42, 0.75);
          cursor: pointer;
          margin-top: -4px;
        }
        .inset-range::-moz-range-track {
          height: 6px;
          border-radius: 9999px;
          background: radial-gradient(circle at 50% 50%, #64748b 0, #1f2937 55%);
          box-shadow:
            inset 0 0 0 1px rgba(15, 23, 42, 0.9),
            0 0 0 1px rgba(15, 23, 42, 0.9);
        }
        .inset-range::-moz-range-thumb {
          width: 14px;
          height: 14px;
          border-radius: 9999px;
          background: #e5e7eb;
          box-shadow:
            0 0 0 1px rgba(15, 23, 42, 0.9),
            0 4px 8px rgba(15, 23, 42, 0.75);
          cursor: pointer;
          border: 0;
        }
      `}} />
    </div>
  );
}

// Subcomponent for the Control Panel (Left Sidebar)
function ControlPanel({ title, config, setConfig, onPosChange, colorTheme }) {
  const isOuter = colorTheme === 'sky';
  const [activeTab, setActiveTab] = useState('controls');
  const [codeText, setCodeText] = useState('');

  const themeColors = {
    title: isOuter ? 'text-sky-400' : 'text-orange-400',
    bg: isOuter ? 'bg-sky-500/10' : 'bg-orange-500/10',
    border: isOuter ? 'border-sky-500/30' : 'border-orange-500/30',
    activeBtn: isOuter ? 'bg-sky-600 text-white border-sky-500' : 'bg-orange-600 text-white border-orange-500',
    inactiveBtn: 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700 hover:text-slate-200',
    sliderAccent: isOuter ? 'accent-sky-500' : 'accent-orange-500',
    tabActive: isOuter ? 'border-sky-500 text-sky-400' : 'border-orange-500 text-orange-400',
    tabInactive: 'border-transparent text-slate-500 hover:text-slate-400',
    focusRing: isOuter ? 'focus:ring-sky-500/50' : 'focus:ring-orange-500/50'
  };

  // Sync visual controls to code editor when not actively typing
  useEffect(() => {
    if (activeTab === 'controls') {
      const cls = isOuter ? '.outer-div' : '.inner-div';
      setCodeText(`${cls} {\n  position: ${config.position};\n  top: ${config.top.auto ? 'auto' : config.top.value + 'px'};\n  right: ${config.right.auto ? 'auto' : config.right.value + 'px'};\n  bottom: ${config.bottom.auto ? 'auto' : config.bottom.value + 'px'};\n  left: ${config.left.auto ? 'auto' : config.left.value + 'px'};\n}`);
    }
  }, [config, activeTab, isOuter]);

  const handleCodeChange = (e) => {
    const val = e.target.value;
    setCodeText(val);

    const newConfig = { ...config };
    let posChanged = false;
    let insetsChanged = false;

    // Extract the CSS block to parse sequentially (imitating the CSS cascade)
    const blockMatch = val.match(/\{([\s\S]*?)\}/);
    if (blockMatch) {
      const declarations = blockMatch[1].split(';');
      declarations.forEach(decl => {
        const colonIdx = decl.indexOf(':');
        if (colonIdx === -1) return;
        
        const prop = decl.substring(0, colonIdx).trim();
        const v = decl.substring(colonIdx + 1).trim();

        if (prop === 'position') {
          if (POSITIONS.includes(v) && v !== config.position) {
            newConfig.position = v;
            posChanged = true;
          }
        } else if (prop === 'inset') {
          const parts = v.split(/\s+/);
          let t, r, b, l;
          if (parts.length === 1) t = r = b = l = parts[0];
          else if (parts.length === 2) { t = b = parts[0]; r = l = parts[1]; }
          else if (parts.length === 3) { t = parts[0]; r = l = parts[1]; b = parts[2]; }
          else if (parts.length >= 4) { t = parts[0]; r = parts[1]; b = parts[2]; l = parts[3]; }

          const parseVal = (str, oldVal) => {
            if (str === 'auto') return { auto: true, value: oldVal };
            const match = str?.match(/^(-?\d+)px$/);
            if (match) return { auto: false, value: parseInt(match[1], 10) };
            return null;
          };

          const pt = parseVal(t, config.top.value); if (pt) { newConfig.top = pt; insetsChanged = true; }
          const pr = parseVal(r, config.right.value); if (pr) { newConfig.right = pr; insetsChanged = true; }
          const pb = parseVal(b, config.bottom.value); if (pb) { newConfig.bottom = pb; insetsChanged = true; }
          const pl = parseVal(l, config.left.value); if (pl) { newConfig.left = pl; insetsChanged = true; }
        } else if (['top', 'right', 'bottom', 'left'].includes(prop)) {
          if (v === 'auto') {
            newConfig[prop] = { auto: true, value: config[prop].value };
            insetsChanged = true;
          } else {
            const match = v.match(/^(-?\d+)px$/);
            if (match) {
              newConfig[prop] = { auto: false, value: parseInt(match[1], 10) };
              insetsChanged = true;
            }
          }
        }
      });
    }

    if (posChanged) {
      if (onPosChange) onPosChange(newConfig.position);
      else setConfig(prev => ({ ...prev, position: newConfig.position }));
    }
    
    if (insetsChanged) {
      setConfig(prev => ({ ...prev, top: newConfig.top, right: newConfig.right, bottom: newConfig.bottom, left: newConfig.left }));
    }
  };

  const handlePosChange = (pos) => {
    if (onPosChange) {
      onPosChange(pos);
    } else {
      setConfig(prev => ({ ...prev, position: pos }));
    }
  };

  const handleInsetChange = (prop, value, isAuto) => {
    setConfig(prev => ({
      ...prev,
      [prop]: {
        value: value !== undefined ? Number(value) : prev[prop].value,
        auto: isAuto !== undefined ? isAuto : prev[prop].auto
      }
    }));
  };

  return (
    <div className={`p-5 rounded-xl border ${themeColors.border} ${themeColors.bg}`}>
      {/* Header Row with Title and Tabs */}
      <div className="flex items-end justify-between border-b border-slate-700/60 mb-5">
        <h2 className={`text-lg font-bold pb-2 flex items-center gap-2 ${themeColors.title}`}>
          <div className={`w-3 h-3 rounded-full ${isOuter ? 'bg-sky-500' : 'bg-orange-500'}`} />
          {title}
        </h2>

        {/* Tabs */}
        <div className="flex gap-5">
          <button
            onClick={() => setActiveTab('controls')}
            className={`pb-2 text-sm font-semibold border-b-2 -mb-[1px] transition-colors ${activeTab === 'controls' ? themeColors.tabActive : themeColors.tabInactive}`}
          >
            Controls
          </button>
          <button
            onClick={() => setActiveTab('code')}
            className={`pb-2 text-sm font-semibold border-b-2 -mb-[1px] transition-colors ${activeTab === 'code' ? themeColors.tabActive : themeColors.tabInactive}`}
          >
            Code Editor
          </button>
        </div>
      </div>

      {activeTab === 'controls' ? (
        <div className="animate-in fade-in duration-200">
          <div className="mb-6">
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Position</label>
            <div className="flex gap-1.5 w-full">
              {POSITIONS.map(pos => (
                <button
                  key={pos}
                  onClick={() => handlePosChange(pos)}
                  className={`flex-1 py-1.5 rounded-md text-[11px] font-medium border transition-colors ${config.position === pos ? themeColors.activeBtn : themeColors.inactiveBtn}`}
                >
                  {pos}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Offsets (Insets)</label>
            {['top', 'right', 'bottom', 'left'].map((prop) => {
              const disabled = config.position === 'static';
              const isAuto = config[prop].auto;
              
              return (
                <div key={prop} className={`flex items-center gap-3 transition-opacity ${disabled ? 'opacity-40 grayscale pointer-events-none' : ''}`}>
                  <div className="w-14 text-sm font-medium text-slate-300 capitalize">{prop}</div>
                  
                  <button
                    onClick={() => handleInsetChange(prop, undefined, !isAuto)}
                    className={`w-12 py-1 text-[10px] uppercase tracking-wider font-bold rounded border transition-colors ${isAuto ? themeColors.activeBtn : themeColors.inactiveBtn}`}
                  >
                    Auto
                  </button>

                  <input
                    type="range"
                    min="-150" max="300"
                    value={config[prop].value}
                    onChange={(e) => handleInsetChange(prop, e.target.value, false)}
                    onDoubleClick={() => handleInsetChange(prop, 0, false)}
                    disabled={disabled}
                    className={`flex-1 h-1.5 rounded-lg appearance-none transition-all duration-200 cursor-pointer inset-range ${isAuto ? 'bg-slate-700/60 accent-slate-500 hover:accent-slate-400' : `bg-slate-700 ${themeColors.sliderAccent}`}`}
                  />
                  
                  <div className="w-20 flex items-center bg-slate-800 border border-slate-700 rounded overflow-hidden">
                     <input
                      type="number"
                      value={config[prop].value}
                      onChange={(e) => handleInsetChange(prop, e.target.value, false)}
                      disabled={disabled}
                      className={`w-full bg-transparent text-right pr-1 py-1 text-sm font-mono focus:outline-none transition-all duration-200 ${isAuto ? 'text-slate-500 line-through decoration-slate-500/50' : 'text-slate-200'}`}
                    />
                    <span className={`text-xs pr-2 font-mono transition-all duration-200 ${isAuto ? 'text-slate-600' : 'text-slate-500'}`}>px</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="w-full animate-in fade-in duration-200">
          <textarea
            value={codeText}
            onChange={handleCodeChange}
            className={`w-full h-[180px] bg-slate-900 text-slate-300 font-mono text-[13px] leading-relaxed p-4 rounded-lg border border-slate-700 focus:outline-none focus:border-transparent focus:ring-2 resize-none ${themeColors.focusRing}`}
            spellCheck="false"
          />
        </div>
      )}
    </div>
  );
}

// Subcomponent to draw SVG arrows with parallel labels
function ArrowLine({ sX, sY, eX, eY, color, label, id }) {
  const isOuter = color === '#0284c7';
  const markerId = isOuter ? 'url(#arrow-outer)' : 'url(#arrow-inner)';
  const strokeColor = isOuter ? '#0284c7' : '#ea580c';

  // Distance check to avoid drawing tiny dots when distance is negligible
  const dist = Math.sqrt(Math.pow(eX - sX, 2) + Math.pow(eY - sY, 2));
  if (dist < 5) return null;

  // Midpoint for text
  const mX = (sX + eX) / 2;
  const mY = (sY + eY) / 2;

  // Calculate text rotation parallel to the line
  let angle = Math.atan2(eY - sY, eX - sX) * (180 / Math.PI);
  // Keep text upright
  if (angle > 90 || angle < -90) {
    angle += 180;
  }

  // Slightly offset text from line
  const offset = 12;
  const rad = angle * (Math.PI / 180);
  const textX = mX + Math.sin(rad) * offset;
  const textY = mY - Math.cos(rad) * offset;

  return (
    <g>
      <line
        x1={sX} y1={sY}
        x2={eX} y2={eY}
        stroke={strokeColor}
        strokeWidth="1.5"
        strokeDasharray="4 3"
        markerEnd={markerId}
      />
      <text
        x={textX} y={textY}
        transform={`rotate(${angle} ${textX} ${textY})`}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize="12"
        fontWeight="bold"
        fill={strokeColor}
        stroke="white"
        strokeWidth="4"
        paintOrder="stroke"
        className="font-mono tracking-tighter shadow-sm"
      >
        {label}
      </text>
    </g>
  );
}