import React, { useState, useRef, useLayoutEffect, useCallback, useEffect } from 'react'
import { Settings2, Maximize2, Minus, X, ZoomIn, ZoomOut } from 'lucide-react'

const INITIAL_OUTER = {
  position: 'static',
  top: { value: 0, auto: true },
  right: { value: 0, auto: true },
  bottom: { value: 0, auto: true },
  left: { value: 0, auto: true },
}

const INITIAL_INNER = {
  position: 'static',
  top: { value: 0, auto: true },
  right: { value: 0, auto: true },
  bottom: { value: 0, auto: true },
  left: { value: 0, auto: true },
}

const POSITIONS = ['static', 'relative', 'absolute', 'fixed', 'sticky']

// Helper to convert config state to React style object
const getStyles = (config) => ({
  position: config.position,
  top: config.top.auto ? 'auto' : `${config.top.value}px`,
  right: config.right.auto ? 'auto' : `${config.right.value}px`,
  bottom: config.bottom.auto ? 'auto' : `${config.bottom.value}px`,
  left: config.left.auto ? 'auto' : `${config.left.value}px`,
})

// Calculate local coordinates relative to the fixed viewport window
const getLocalRect = (el, referenceWindow) => {
  if (!el || !referenceWindow) return null
  const rect = el.getBoundingClientRect()
  const refRect = referenceWindow.getBoundingClientRect()
  return {
    top: rect.top - refRect.top,
    bottom: rect.bottom - refRect.top,
    left: rect.left - refRect.left,
    right: rect.right - refRect.left,
    width: rect.width,
    height: rect.height,
  }
}

export default function App() {
  const [outerConfig, setOuterConfig] = useState(INITIAL_OUTER)
  const [innerConfig, setInnerConfig] = useState(INITIAL_INNER)
  const [arrows, setArrows] = useState([])
  const [toastVisible, setToastVisible] = useState(false)
  const [toastFadingOut, setToastFadingOut] = useState(false)
  const toastTimeoutRef = useRef(null)
  const toastFadeOutRef = useRef(null)
  const [zoom, setZoom] = useState(1)
  const ZOOM_MIN = 0.25
  const ZOOM_MAX = 1
  const zoomPercent = Math.round(zoom * 100)
  const [theme, setTheme] = useState('dark')
  const isDark = theme === 'dark'

  // Structure References
  const windowRef = useRef(null) // The fixed mock viewport (CB for fixed)
  const scrollRef = useRef(null) // The scrolling document container
  const containerRef = useRef(null) // The gray containing block (CB for absolute)

  const outerRef = useRef(null)
  const innerRef = useRef(null)
  const outerGhostRef = useRef(null)
  const innerGhostRef = useRef(null)
  const leftPanelContentRef = useRef(null)
  const innerPanelRef = useRef(null)
  const [mockBrowserHeight, setMockBrowserHeight] = useState(null)

  const updateMeasurements = useCallback(() => {
    const win = windowRef.current
    if (!win) return

    const outerRect = getLocalRect(outerRef.current, win)
    const innerRect = getLocalRect(innerRef.current, win)
    const outerGhostRect = getLocalRect(outerGhostRef.current, win)
    const innerGhostRect = getLocalRect(innerGhostRef.current, win)
    const containerRect = getLocalRect(containerRef.current, win)

    if (!outerRect || !innerRect || !outerGhostRect || !innerGhostRect || !containerRect) return

    const winRect = win.getBoundingClientRect()
    const visibleViewportCB = {
      top: 0, left: 0, bottom: winRect.height, right: winRect.width, width: winRect.width, height: winRect.height
    }

    const newArrows = []

    const getCB = (isOuter) => {
      const pos = isOuter ? outerConfig.position : innerConfig.position
      if (pos === 'fixed' || pos === 'sticky') return visibleViewportCB
      if (pos === 'relative') return isOuter ? outerGhostRect : innerGhostRect
      if (pos === 'absolute') {
        return (!isOuter && outerConfig.position !== 'static') ? outerRect : containerRect
      }
      return null
    }

    const addArrowsForEl = (config, elRect, isOuter) => {
      if (config.position === 'static') return
      const cb = getCB(isOuter)
      if (!cb) return

      const color = isOuter ? '#0284c7' : '#ea580c'
      const elCenterX = elRect.left + elRect.width / 2
      const elCenterY = elRect.top + elRect.height / 2

      const create = (prop, sX, sY, eX, eY, label) => {
        newArrows.push({ id: `${isOuter ? 'outer' : 'inner'}-${prop}`, sX, sY, eX, eY, color, label })
      }

      if (config.position === 'sticky') {
        const scale = zoom || 1

        if (!config.top.auto) create(
          'top',
          elCenterX,
          cb.top,
          elCenterX,
          cb.top + config.top.value * scale,
          `top: ${config.top.value}px`,
        )

        if (!config.bottom.auto) create(
          'bottom',
          elCenterX,
          cb.bottom,
          elCenterX,
          cb.bottom - config.bottom.value * scale,
          `bottom: ${config.bottom.value}px`,
        )

        if (!config.left.auto) create(
          'left',
          cb.left,
          elCenterY,
          cb.left + config.left.value * scale,
          elCenterY,
          `left: ${config.left.value}px`,
        )

        if (!config.right.auto) create(
          'right',
          cb.right,
          elCenterY,
          cb.right - config.right.value * scale,
          elCenterY,
          `right: ${config.right.value}px`,
        )
      } else {
        if (!config.top.auto) create('top', elCenterX, cb.top, elCenterX, elRect.top, `top: ${config.top.value}px`)
        if (!config.bottom.auto) create('bottom', elCenterX, cb.bottom, elCenterX, elRect.bottom, `bottom: ${config.bottom.value}px`)
        if (!config.left.auto) create('left', cb.left, elCenterY, elRect.left, elCenterY, `left: ${config.left.value}px`)
        if (!config.right.auto) create('right', cb.right, elCenterY, elRect.right, elCenterY, `right: ${config.right.value}px`)
      }
    }

    addArrowsForEl(outerConfig, outerRect, true)
    addArrowsForEl(innerConfig, innerRect, false)

    setArrows(newArrows)
  }, [outerConfig, innerConfig, zoom])

  useLayoutEffect(() => {
    updateMeasurements()
  }, [updateMeasurements])

  const centerScroll = useCallback(() => {
    const scrollEl = scrollRef.current
    if (!scrollEl) return

    const logicalViewportHeight = scrollEl.clientHeight / zoom
    const logicalViewportWidth = scrollEl.clientWidth / zoom

    const nextTop = (scrollEl.scrollHeight - logicalViewportHeight) / 2
    const nextLeft = (scrollEl.scrollWidth - logicalViewportWidth) / 2

    scrollEl.scrollTop = nextTop > 0 ? nextTop : 0
    scrollEl.scrollLeft = nextLeft > 0 ? nextLeft : 0
  }, [zoom])

  useEffect(() => {
    centerScroll()
  }, [centerScroll])

  useEffect(() => {
    const scrollEl = scrollRef.current
    if (!scrollEl) return

    scrollEl.addEventListener('scroll', updateMeasurements)
    window.addEventListener('resize', updateMeasurements)

    return () => {
      scrollEl.removeEventListener('scroll', updateMeasurements)
      window.removeEventListener('resize', updateMeasurements)
    }
  }, [updateMeasurements])

  const handlePosChange = (isOuter, pos) => {
    if (isOuter) setOuterConfig(prev => ({ ...prev, position: pos }))
    else setInnerConfig(prev => ({ ...prev, position: pos }))

    if (['fixed', 'sticky'].includes(pos)) {
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current)
      if (toastFadeOutRef.current) clearTimeout(toastFadeOutRef.current)
      setToastFadingOut(false)
      setToastVisible(true)
      toastTimeoutRef.current = setTimeout(() => {
        setToastFadingOut(true)
        toastFadeOutRef.current = setTimeout(() => {
          setToastVisible(false)
          setToastFadingOut(false)
          toastTimeoutRef.current = null
          toastFadeOutRef.current = null
        }, 1500)
      }, 3000)
    }
  }

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current)
      if (toastFadeOutRef.current) clearTimeout(toastFadeOutRef.current)
    }
  }, [])

  const syncMockBrowserHeight = useCallback(() => {
    const contentEl = leftPanelContentRef.current
    const innerEl = innerPanelRef.current
    if (!contentEl || !innerEl) return
    const contentTop = contentEl.getBoundingClientRect().top
    const innerBottom = innerEl.getBoundingClientRect().bottom
    const topPadding = 20
    setMockBrowserHeight(Math.round(innerBottom - contentTop - topPadding))
  }, [])

  useLayoutEffect(() => {
    syncMockBrowserHeight()
    const contentEl = leftPanelContentRef.current
    const innerEl = innerPanelRef.current
    if (!contentEl || !innerEl) return
    const ro = new ResizeObserver(syncMockBrowserHeight)
    ro.observe(contentEl)
    ro.observe(innerEl)
    return () => ro.disconnect()
  }, [syncMockBrowserHeight])

  return (
    <div
      className={`theme-${theme} flex flex-col h-screen w-full font-sans overflow-hidden ${
        isDark ? 'bg-slate-900 text-slate-200' : 'bg-slate-100 text-slate-900'
      }`}
    >
      {/* Full-width header */}
      <header
        className={`w-full shrink-0 p-5 border-b flex items-center gap-3 z-20 ${
          isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'
        }`}
        role="banner"
      >
        <Settings2
          className={`w-6 h-6 ${isDark ? 'text-indigo-300' : 'text-indigo-500'}`}
          aria-hidden
        />
        <h1
          className={`text-xl font-bold tracking-wide ${
            isDark ? 'text-white' : 'text-slate-900'
          }`}
        >
          CSS Position
        </h1>
        <div className="ml-auto">
          <button
            type="button"
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
              isDark
                ? 'border-slate-600 bg-slate-900/80 text-slate-200 hover:bg-slate-800'
                : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
            }`}
            aria-label={`Switch to ${isDark ? 'light' : 'dark'} theme`}
          >
            {isDark ? 'Light theme' : 'Dark theme'}
          </button>
        </div>
      </header>

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Sidebar Controls */}
        <div
          className={`w-[480px] shrink-0 border-r flex flex-col overflow-y-auto shadow-xl z-10 custom-scrollbar ${
            isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'
          }`}
        >
          <div ref={leftPanelContentRef} className="p-5 space-y-8">
          <ControlPanel
            title="Outer Element"
            config={outerConfig}
            setConfig={setOuterConfig}
            onPosChange={pos => handlePosChange(true, pos)}
            colorTheme="sky"
            isDark={isDark}
          />
          <div ref={innerPanelRef}>
            <ControlPanel
              title="Inner Element"
              config={innerConfig}
              setConfig={setInnerConfig}
              onPosChange={pos => handlePosChange(false, pos)}
              colorTheme="orange"
              isDark={isDark}
            />
          </div>
          </div>
        </div>

        {/* Main Area / Mock Browser */}
        <div
          className={`flex-1 px-8 pt-5 pb-0 flex flex-col items-center min-h-0 overflow-hidden relative ${
            isDark ? 'bg-slate-950' : 'bg-slate-100'
          }`}
        >
          <div
            className={`w-full max-w-5xl rounded-xl shadow-2xl flex flex-col overflow-hidden border ${
              isDark ? 'bg-white border-slate-700' : 'bg-white border-slate-300'
            } ${mockBrowserHeight ? '' : 'flex-1 min-h-0'}`}
            style={mockBrowserHeight ? { height: mockBrowserHeight } : undefined}
          >

          {/* Browser Header */}
          <div
            className={`h-14 border-b flex items-center px-4 shrink-0 ${
              isDark ? 'bg-slate-100 border-slate-300' : 'bg-slate-50 border-slate-200'
            }`}
          >
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
            className={`flex-1 relative overflow-hidden transform-gpu [background-size:20px_20px] ${
              isDark
                ? 'bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] text-slate-800'
                : 'bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] text-slate-700'
            }`}
          >
            {/* Toast: fixed/sticky hint (inside viewport) */}
            {toastVisible && (
              <div
                className={`absolute top-4 right-4 z-[60] px-4 py-3 rounded-lg bg-amber-200/40 text-slate-800 text-sm font-medium shadow-lg border border-amber-400/50 pointer-events-none ${toastFadingOut ? 'toast-fade-out' : 'toast-fade-in'}`}
                role="status"
                aria-live="polite"
              >
                Scroll horizontally and vertically to test sticky/fixed
              </div>
            )}

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
            <div
              ref={scrollRef}
              className="w-full h-full overflow-auto relative"
              style={{ zoom }}
            >
              <div className="w-[3000px] h-[3000px] flex flex-col items-center justify-center relative z-10 gap-12">

                {/* Light Gray Containing Block */}
                <div
                  ref={containerRef}
                  className="w-[1000px] bg-slate-100 rounded-xl border-2 border-slate-300 relative shadow-inner shrink-0"
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

            {/* Floating zoom control - pill shaped, bottom right */}
            <div
              className={`absolute bottom-3 right-3 z-50 flex flex-col items-center gap-3 py-3 px-2 rounded-full shadow-lg pointer-events-auto min-w-[40px] ${
                isDark ? 'bg-slate-800/95 border border-slate-600' : 'bg-slate-200/95 border border-slate-300'
              }`}
              role="group"
              aria-label="Canvas zoom"
            >
              <button
                type="button"
                className="flex items-center justify-center w-7 h-7 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70"
                onDoubleClick={() => setZoom(1)}
                aria-label="Reset zoom to 100%"
              >
                <ZoomIn
                  className={`w-4 h-4 shrink-0 ${isDark ? 'text-slate-200' : 'text-slate-700'}`}
                  aria-hidden
                />
              </button>

              <div className="flex items-center justify-center h-32 w-8" style={{ transform: 'rotate(-90deg)' }}>
                <input
                  type="range"
                  min={ZOOM_MIN * 100}
                  max={ZOOM_MAX * 100}
                  value={zoomPercent}
                  onChange={e => setZoom(Number(e.target.value) / 100)}
                  onDoubleClick={() => setZoom(1)}
                  className={`w-28 h-5 accent-sky-500 appearance-none rounded-full cursor-pointer range-vertical ${
                    isDark ? 'bg-slate-700' : 'bg-slate-300'
                  }`}
                  aria-label="Zoom level"
                  aria-valuemin={ZOOM_MIN * 100}
                  aria-valuemax={ZOOM_MAX * 100}
                  aria-valuenow={zoomPercent}
                  aria-valuetext={`${zoomPercent}%`}
                />
              </div>

              <ZoomOut
                className={`w-4 h-4 shrink-0 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}
                aria-hidden
              />
              <span
                className={`text-xs font-mono tabular-nums shrink-0 ${
                  isDark ? 'text-slate-300' : 'text-slate-700'
                }`}
                aria-hidden
              >
                {zoomPercent}%
              </span>
            </div>
          </div>
          </div>
        </div>
      </div>
      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { width: 8px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background-color: #475569; border-radius: 20px; border: 2px solid #1e293b; }
        @keyframes toast-fade-in { from { opacity: 0; } to { opacity: 1; } }
        .toast-fade-in { animation: toast-fade-in 0.2s ease-out forwards; }
        @keyframes toast-fade-out { to { opacity: 0; } }
        .toast-fade-out { animation: toast-fade-out 1.5s ease-out forwards; }
        .range-vertical { padding-left: 10px; padding-right: 10px; }
        .theme-dark .range-vertical::-webkit-slider-runnable-track { height: 6px; border-radius: 3px; background: #475569; }
        .theme-dark .range-vertical::-moz-range-track { height: 6px; border-radius: 3px; background: #475569; }
        .theme-light .range-vertical::-webkit-slider-runnable-track { height: 6px; border-radius: 3px; background: #cbd5f5; }
        .theme-light .range-vertical::-moz-range-track { height: 6px; border-radius: 3px; background: #cbd5f5; }
        .range-vertical::-webkit-slider-thumb { -webkit-appearance: none; width: 14px; height: 14px; border-radius: 50%; background: #0ea5e9; cursor: pointer; margin-top: -4px; }
        .range-vertical::-moz-range-thumb { width: 14px; height: 14px; border-radius: 50%; background: #0ea5e9; cursor: pointer; border: 0; }
        .theme-light [class*="text-slate-"] { color: #0f172a !important; }
        .theme-light input,
        .theme-light textarea {
          color: #0f172a !important;
          background-color: #ffffff !important;
        }
      `}} />
    </div>
  )
}

// Subcomponent for the Control Panel (Left Sidebar)
function ControlPanel({ title, config, setConfig, onPosChange, colorTheme, isDark }) {
  const isOuter = colorTheme === 'sky'
  const [activeTab, setActiveTab] = useState('controls')
  const [codeText, setCodeText] = useState('')

  const themeColors = isDark
    ? {
        title: isOuter ? 'text-sky-400' : 'text-orange-400',
        bg: isOuter ? 'bg-sky-500/10' : 'bg-orange-500/10',
        border: isOuter ? 'border-sky-500/30' : 'border-orange-500/30',
        activeBtn: isOuter ? 'bg-sky-600 text-white border-sky-500' : 'bg-orange-600 text-white border-orange-500',
        inactiveBtn: 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700 hover:text-slate-200',
        sliderAccent: isOuter ? 'accent-sky-500' : 'accent-orange-500',
        tabActive: isOuter ? 'border-sky-500 text-sky-400' : 'border-orange-500 text-orange-400',
        tabInactive: 'border-transparent text-slate-500 hover:text-slate-400',
        focusRing: isOuter ? 'focus:ring-sky-500/50' : 'focus:ring-orange-500/50',
      }
    : {
        title: isOuter ? 'text-sky-700' : 'text-orange-700',
        bg: isOuter ? 'bg-sky-50' : 'bg-orange-50',
        border: isOuter ? 'border-sky-200' : 'border-orange-200',
        activeBtn: isOuter ? 'bg-sky-600 text-white border-sky-500' : 'bg-orange-600 text-white border-orange-500',
        inactiveBtn:
          'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200 hover:text-slate-900',
        sliderAccent: isOuter ? 'accent-sky-500' : 'accent-orange-500',
        tabActive: isOuter ? 'border-sky-500 text-sky-700' : 'border-orange-500 text-orange-700',
        tabInactive: 'border-transparent text-slate-500 hover:text-slate-700',
        focusRing: isOuter ? 'focus:ring-sky-500/40' : 'focus:ring-orange-500/40',
      }

  useEffect(() => {
    if (activeTab === 'controls') {
      const cls = isOuter ? '.outer-div' : '.inner-div'
      setCodeText(`${cls} {\n  position: ${config.position};\n  top: ${config.top.auto ? 'auto' : config.top.value + 'px'};\n  right: ${config.right.auto ? 'auto' : config.right.value + 'px'};\n  bottom: ${config.bottom.auto ? 'auto' : config.bottom.value + 'px'};\n  left: ${config.left.auto ? 'auto' : config.left.value + 'px'};\n}`)
    }
  }, [config, activeTab, isOuter])

  const handleCodeChange = (e) => {
    const val = e.target.value
    setCodeText(val)

    const newConfig = { ...config }
    let posChanged = false
    let insetsChanged = false

    const blockMatch = val.match(/\{([\s\S]*?)\}/)
    if (blockMatch) {
      const declarations = blockMatch[1].split(';')
      declarations.forEach(decl => {
        const colonIdx = decl.indexOf(':')
        if (colonIdx === -1) return

        const prop = decl.substring(0, colonIdx).trim()
        const v = decl.substring(colonIdx + 1).trim()

        if (prop === 'position') {
          if (POSITIONS.includes(v) && v !== config.position) {
            newConfig.position = v
            posChanged = true
          }
        } else if (prop === 'inset') {
          const parts = v.split(/\s+/)
          let t, r, b, l
          if (parts.length === 1) t = r = b = l = parts[0]
          else if (parts.length === 2) { t = b = parts[0]; r = l = parts[1] }
          else if (parts.length === 3) { t = parts[0]; r = l = parts[1]; b = parts[2] }
          else if (parts.length >= 4) { t = parts[0]; r = parts[1]; b = parts[2]; l = parts[3] }

          const parseVal = (str, oldVal) => {
            if (str === 'auto') return { auto: true, value: oldVal }
            const match = str?.match(/^(-?\d+)px$/)
            if (match) return { auto: false, value: parseInt(match[1], 10) }
            return null
          }

          const pt = parseVal(t, config.top.value); if (pt) { newConfig.top = pt; insetsChanged = true }
          const pr = parseVal(r, config.right.value); if (pr) { newConfig.right = pr; insetsChanged = true }
          const pb = parseVal(b, config.bottom.value); if (pb) { newConfig.bottom = pb; insetsChanged = true }
          const pl = parseVal(l, config.left.value); if (pl) { newConfig.left = pl; insetsChanged = true }
        } else if (['top', 'right', 'bottom', 'left'].includes(prop)) {
          if (v === 'auto') {
            newConfig[prop] = { auto: true, value: config[prop].value }
            insetsChanged = true
          } else {
            const match = v.match(/^(-?\d+)px$/)
            if (match) {
              newConfig[prop] = { auto: false, value: parseInt(match[1], 10) }
              insetsChanged = true
            }
          }
        }
      })
    }

    if (posChanged) {
      if (onPosChange) onPosChange(newConfig.position)
      else setConfig(prev => ({ ...prev, position: newConfig.position }))
    }

    if (insetsChanged) {
      setConfig(prev => ({ ...prev, top: newConfig.top, right: newConfig.right, bottom: newConfig.bottom, left: newConfig.left }))
    }
  }

  const handlePosChange = (pos) => {
    if (onPosChange) onPosChange(pos)
    else setConfig(prev => ({ ...prev, position: pos }))
  }

  const handleInsetChange = (prop, value, isAuto) => {
    setConfig(prev => ({
      ...prev,
      [prop]: {
        value: value !== undefined ? Number(value) : prev[prop].value,
        auto: isAuto !== undefined ? isAuto : prev[prop].auto
      }
    }))
  }

  return (
    <div className={`p-5 rounded-xl border ${themeColors.border} ${themeColors.bg}`}>
      <div className="flex items-end justify-between border-b border-slate-700/60 mb-5">
        <h2 className={`text-lg font-bold pb-2 flex items-center gap-2 ${themeColors.title}`}>
          <div className={`w-3 h-3 rounded-full ${isOuter ? 'bg-sky-500' : 'bg-orange-500'}`} />
          {title}
        </h2>

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
              const disabled = config.position === 'static'
              const isAuto = config[prop].auto

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
                    className={`flex-1 h-1.5 rounded-lg appearance-none transition-all duration-200 cursor-pointer ${isAuto ? 'bg-slate-700/60 accent-slate-500 hover:accent-slate-400' : `bg-slate-700 ${themeColors.sliderAccent}`}`}
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
              )
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
  )
}

// Subcomponent to draw SVG arrows with parallel labels
function ArrowLine({ sX, sY, eX, eY, color, label }) {
  const isOuter = color === '#0284c7'
  const markerId = isOuter ? 'url(#arrow-outer)' : 'url(#arrow-inner)'
  const strokeColor = isOuter ? '#0284c7' : '#ea580c'

  const dist = Math.sqrt(Math.pow(eX - sX, 2) + Math.pow(eY - sY, 2))
  if (dist < 5) return null

  const mX = (sX + eX) / 2
  const mY = (sY + eY) / 2

  let angle = Math.atan2(eY - sY, eX - sX) * (180 / Math.PI)
  if (angle > 90 || angle < -90) angle += 180

  const offset = 12
  const rad = angle * (Math.PI / 180)
  const textX = mX + Math.sin(rad) * offset
  const textY = mY - Math.cos(rad) * offset

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
  )
}
