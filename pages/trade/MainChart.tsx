
import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
    createChart, ColorType, CrosshairMode, IChartApi, ISeriesApi,
    MouseEventParams, Time, LineData, IPriceLine,
    CandlestickSeries, LineSeries, HistogramSeries
} from 'lightweight-charts';
import { useSettings } from '../../contexts/SettingsContext';
import { fetchOandaCandles } from '../../services/oandaService';
import { ChartCandle, TradeType } from '../../types';
import { OrderState } from './index';
import {
    RefreshCw, AlertCircle, MousePointer2,
    Minus, Square, Triangle, Activity, TrendingUp, Settings, X
} from 'lucide-react';

// --- Helpers ---

const calculateSMA = (data: ChartCandle[], period: number) => {
    const smaData: LineData[] = [];
    if (data.length < period) return smaData;
    for (let i = period - 1; i < data.length; i++) {
        const sum = data.slice(i - period + 1, i + 1).reduce((acc, val) => acc + val.close, 0);
        smaData.push({ time: data[i].time as Time, value: sum / period });
    }
    return smaData;
};

const calculateEMA = (data: ChartCandle[], period: number) => {
    const emaData: LineData[] = [];
    if (data.length < period) return emaData;
    const k = 2 / (period + 1);
    let initialSum = 0;
    for (let i = 0; i < period; i++) initialSum += data[i].close;
    let prevEma = initialSum / period;
    emaData.push({ time: data[period - 1].time as Time, value: prevEma });
    for (let i = period; i < data.length; i++) {
        const currentEma = (data[i].close * k) + (prevEma * (1 - k));
        emaData.push({ time: data[i].time as Time, value: currentEma });
        prevEma = currentEma;
    }
    return emaData;
};

// --- Drawing System (Abbreviated) ---
interface Point { time: Time; price: number; }
interface Drawing { id: string; type: string; points: Point[]; }

class DrawingsRenderer {
    _data: { drawings: Drawing[], current: Drawing | null, mousePoint: Point | null } | null = null;
    _chart: IChartApi | null = null;
    _series: ISeriesApi<"Candlestick"> | null = null;
    constructor(data: any, chart: any, series: any) { this._data = data; this._chart = chart; this._series = series; }
    draw(target: any) {
        if (!this._data || !this._chart || !this._series) return;
        target.useMediaCoordinateSpace((scope: any) => {
            const ctx = scope.context;
            const timeScale = this._chart!.timeScale();
            const series = this._series!;
            const drawShape = (d: Drawing, isPreview: boolean) => {
                const pointsToRender = [...d.points];
                if (isPreview && this._data!.mousePoint && (d.type === 'line' || d.type === 'rectangle' || d.type === 'triangle')) pointsToRender.push(this._data!.mousePoint);
                const coords = pointsToRender.map(p => ({ x: timeScale.timeToCoordinate(p.time), y: series.priceToCoordinate(p.price) })).filter(p => p.x !== null && p.y !== null) as { x: number, y: number }[];
                if (coords.length === 0) return;
                ctx.beginPath(); ctx.strokeStyle = '#3b82f6'; ctx.lineWidth = 2; ctx.fillStyle = 'rgba(59, 130, 246, 0.1)';
                if (d.type === 'horizontal') { const y = coords[0].y; ctx.moveTo(0, y); ctx.lineTo(scope.mediaSize.width, y); }
                else if (d.type === 'line') { if (coords.length > 0) ctx.moveTo(coords[0].x, coords[0].y); for (let i = 1; i < coords.length; i++) ctx.lineTo(coords[i].x, coords[i].y); }
                else if (d.type === 'rectangle' && coords.length >= 2) { ctx.rect(Math.min(coords[0].x, coords[1].x), Math.min(coords[0].y, coords[1].y), Math.abs(coords[1].x - coords[0].x), Math.abs(coords[1].y - coords[0].y)); ctx.fill(); }
                else if (d.type === 'triangle' && coords.length >= 2) { ctx.moveTo(coords[0].x, coords[0].y); ctx.lineTo(coords[1].x, coords[1].y); if (coords.length >= 3) ctx.lineTo(coords[2].x, coords[2].y); ctx.closePath(); ctx.fill(); }
                ctx.stroke();
                ctx.fillStyle = '#ffffff'; ctx.lineWidth = 1; coords.forEach(c => { ctx.beginPath(); ctx.arc(c.x, c.y, 3, 0, 2 * Math.PI); ctx.fill(); ctx.stroke(); });
            };
            this._data.drawings.forEach(d => drawShape(d, false));
            if (this._data.current) drawShape(this._data.current, true);
        });
    }
}
class DrawingsPaneView { _source: any; constructor(source: any) { this._source = source; } renderer() { return new DrawingsRenderer(this._source._data, this._source._attachedParams?.chart, this._source._attachedParams?.series); } }
class DrawingsPrimitive {
    _attachedParams: any = null; _data: any = { drawings: [], current: null, mousePoint: null }; _view: DrawingsPaneView;
    constructor() { this._view = new DrawingsPaneView(this); }
    setData(drawings: any, current: any, mousePoint: any) { this._data = { drawings, current, mousePoint }; this.updateAllViews(); }
    attached(params: any) { this._attachedParams = params; } detached() { this._attachedParams = null; }
    updateAllViews() { if (this._attachedParams) this._attachedParams.requestUpdate(); } paneViews() { return [this._view]; }
}

// --- Component ---

interface MainChartProps {
    symbol: string;
    isWatchlistVisible: boolean;
    onToggleWatchlist: () => void;
    orderState: OrderState;
    setOrderState: React.Dispatch<React.SetStateAction<OrderState>>;
}

const TIMEFRAMES: Record<string, number> = { '1m': 60, '5m': 300, '15m': 900, '1h': 3600, '4h': 14400, 'D': 86400 };
const OANDA_TF_MAP: Record<string, string> = { '1m': 'M1', '5m': 'M5', '15m': 'M15', '1h': 'H1', '4h': 'H4', 'D': 'D' };

export const MainChart: React.FC<MainChartProps> = ({ symbol, isWatchlistVisible, onToggleWatchlist, orderState, setOrderState }) => {
    const { oandaApiKey, oandaEnv, timezone, availableInstruments, theme } = useSettings();

    const chartContainerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);
    const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
    const drawingsPrimitiveRef = useRef<DrawingsPrimitive | null>(null);

    // Refs for order lines (lightweight charts objects)
    const entryLineRef = useRef<IPriceLine | null>(null);
    const slLineRef = useRef<IPriceLine | null>(null);
    const tpLineRef = useRef<IPriceLine | null>(null);

    // Refs for HTML labels
    const entryLabelRef = useRef<HTMLDivElement>(null);
    const slLabelRef = useRef<HTMLDivElement>(null);
    const tpLabelRef = useRef<HTMLDivElement>(null);

    const smaSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
    const emaSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
    const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);

    const indicatorsRef = useRef<HTMLDivElement>(null);
    const styleRef = useRef<HTMLDivElement>(null);

    const [activeTimeframe, setActiveTimeframe] = useState('5m');
    const [chartData, setChartData] = useState<ChartCandle[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [drawings, setDrawings] = useState<Drawing[]>([]);
    const [currentDrawing, setCurrentDrawing] = useState<Drawing | null>(null);
    const [activeTool, setActiveTool] = useState<string>('cursor');
    const activeToolRef = useRef('cursor');
    const mousePointRef = useRef<Point | null>(null);

    // Order Interaction State
    const [menuState, setMenuState] = useState<{ x: number, y: number, price: number } | null>(null);
    const isAltDownRef = useRef(false);
    const orderStateRef = useRef(orderState);
    const isDraggingRef = useRef<'entry' | 'sl' | 'tp' | null>(null);
    const rafIdRef = useRef<number | null>(null);

    const [isIndicatorsMenuOpen, setIsIndicatorsMenuOpen] = useState(false);
    const [isStyleMenuOpen, setIsStyleMenuOpen] = useState(false);
    const [indicators, setIndicators] = useState({ sma: false, smaPeriod: 20, ema: false, emaPeriod: 20, volume: false });
    const [chartStyle, setChartStyle] = useState({ isHollow: true, upColor: '#26a69a', downColor: '#ef5350' });

    useEffect(() => { activeToolRef.current = activeTool; }, [activeTool]);
    useEffect(() => { orderStateRef.current = orderState; }, [orderState]);

    // --- ANIMATION LOOP FOR LABEL SYNC ---
    useEffect(() => {
        const syncLabels = () => {
            if (!candleSeriesRef.current || !chartContainerRef.current) {
                rafIdRef.current = requestAnimationFrame(syncLabels);
                return;
            }

            const series = candleSeriesRef.current;
            const containerHeight = chartContainerRef.current.clientHeight;

            // Helper to sync one label
            const sync = (el: HTMLDivElement | null, price: number) => {
                if (!el) return;

                if (!price || price <= 0) {
                    el.style.display = 'none';
                    return;
                }

                const y = series.priceToCoordinate(price);

                // Hide if null (off-screen usually returns coordinate, but if data is missing it might be null)
                // Also check bounds with some padding
                if (y === null || y < -50 || y > containerHeight + 50) {
                    el.style.display = 'none';
                } else {
                    el.style.display = 'flex';
                    // Use transform for performance
                    el.style.transform = `translateY(${y - 12}px)`;
                }
            };

            sync(entryLabelRef.current, orderStateRef.current.entryPrice);
            sync(slLabelRef.current, orderStateRef.current.stopLoss);
            sync(tpLabelRef.current, orderStateRef.current.takeProfit);

            rafIdRef.current = requestAnimationFrame(syncLabels);
        };

        rafIdRef.current = requestAnimationFrame(syncLabels);
        return () => {
            if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
        };
    }, []);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (indicatorsRef.current && !indicatorsRef.current.contains(event.target as Node)) setIsIndicatorsMenuOpen(false);
            if (styleRef.current && !styleRef.current.contains(event.target as Node)) setIsStyleMenuOpen(false);

            // Close Order Menu if clicked outside
            const target = event.target as HTMLElement;
            if (!target.closest('#chart-order-menu')) {
                setMenuState(null);
            }
        };

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

            if (e.key === 'Alt') {
                isAltDownRef.current = true;
                if (chartContainerRef.current) {
                    chartContainerRef.current.style.cursor = 'crosshair';
                }
            }
        };

        const handleKeyUp = (e: KeyboardEvent) => {
            if (e.key === 'Alt') {
                isAltDownRef.current = false;
                if (chartContainerRef.current) {
                    chartContainerRef.current.style.cursor = 'default';
                }
            }
        };

        const handleMouseUp = () => {
            if (isDraggingRef.current) {
                isDraggingRef.current = null;
                if (chartRef.current) {
                    chartRef.current.applyOptions({ handleScroll: true, handleScale: true });
                }
                if (chartContainerRef.current) {
                    chartContainerRef.current.style.cursor = 'default';
                }
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        window.addEventListener('mouseup', handleMouseUp);

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, []);

    useEffect(() => {
        const loadData = async () => {
            if (!oandaApiKey || !symbol) return;
            setLoading(true);
            setError(null);
            setChartData([]);
            try {
                const granularity = OANDA_TF_MAP[activeTimeframe] || 'H1';
                const data = await fetchOandaCandles(symbol, granularity, 500, oandaApiKey, undefined, undefined, oandaEnv, availableInstruments);
                setChartData(data);
            } catch (e: any) {
                setError(e.message);
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, [symbol, activeTimeframe, oandaApiKey, oandaEnv, availableInstruments]);

    // Update Visual Order Lines
    useEffect(() => {
        if (!candleSeriesRef.current || chartData.length === 0) return;
        const series = candleSeriesRef.current;

        const isShort = orderState.type === TradeType.SHORT;
        const entryColor = isShort ? '#ef4444' : '#10b981';

        const applyLine = (ref: React.MutableRefObject<IPriceLine | null>, price: number, color: string, style: number = 0, width: number = 1) => {
            if (price > 0) {
                if (!ref.current) {
                    ref.current = series.createPriceLine({
                        price: price,
                        color: color, lineWidth: width as any, lineStyle: style, axisLabelVisible: true, title: '',
                    });
                } else {
                    ref.current.applyOptions({ price: price, title: '', color: color, lineWidth: width as any });
                }
            } else if (ref.current) {
                series.removePriceLine(ref.current);
                ref.current = null;
            }
        };

        applyLine(entryLineRef, orderState.entryPrice, entryColor, 0, 1);
        applyLine(slLineRef, orderState.stopLoss, '#ef4444', 2, 2);
        applyLine(tpLineRef, orderState.takeProfit, '#10b981', 2, 2);

    }, [orderState.entryPrice, orderState.stopLoss, orderState.takeProfit, orderState.type, chartData]);

    useEffect(() => {
        if (!chartContainerRef.current) return;

        const chart = createChart(chartContainerRef.current, {
            layout: { background: { type: ColorType.Solid, color: theme === 'light' ? '#ffffff' : '#0f172a' }, textColor: theme === 'light' ? '#334155' : '#94a3b8', fontSize: 10 },
            grid: { vertLines: { color: theme === 'light' ? '#e2e8f0' : '#1e293b' }, horzLines: { color: theme === 'light' ? '#e2e8f0' : '#1e293b' } },
            width: chartContainerRef.current.clientWidth,
            height: chartContainerRef.current.clientHeight,
            rightPriceScale: { borderColor: theme === 'light' ? '#cbd5e1' : '#334155', minimumWidth: 60 },
            timeScale: { borderColor: theme === 'light' ? '#cbd5e1' : '#334155', timeVisible: true, secondsVisible: false, barSpacing: 12, minBarSpacing: 2, rightOffset: 10 },
            crosshair: { mode: CrosshairMode.Normal },
            localization: {
                timeFormatter: (time: number) => {
                    try { return new Intl.DateTimeFormat(undefined, { timeZone: timezone, hour: '2-digit', minute: '2-digit', hour12: false, month: 'short', day: 'numeric' }).format(new Date(time * 1000)); } catch (e) { return String(time); }
                },
            },
        });

        // V5 Syntax: chart.addSeries(CandlestickSeries, options)
        const series = chart.addSeries(CandlestickSeries, {
            upColor: chartStyle.isHollow ? (theme === 'light' ? '#ffffff' : '#0f172a') : chartStyle.upColor,
            downColor: chartStyle.isHollow ? (theme === 'light' ? '#ffffff' : '#0f172a') : chartStyle.downColor,
            borderVisible: true, wickUpColor: chartStyle.upColor, wickDownColor: chartStyle.downColor,
            borderUpColor: chartStyle.upColor, borderDownColor: chartStyle.downColor,
            priceFormat: { type: 'price', precision: 3, minMove: 0.001 },
            lastValueVisible: false, // Hide default dynamic label
        });

        if (chartData.length > 0) {
            const formattedData = chartData.map(d => ({ time: d.time as Time, open: d.open, high: d.high, low: d.low, close: d.close }));
            series.setData(formattedData);
            chart.timeScale().setVisibleLogicalRange({ from: Math.max(0, formattedData.length - 150), to: formattedData.length + 5 });

            // Add Custom Gray Price Line for Current Price
            const lastCandle = formattedData[formattedData.length - 1];
            series.createPriceLine({
                price: lastCandle.close,
                color: '#606369ff', // Gray (Slate-400)
                lineWidth: 1,
                lineStyle: 2, // Dashed
                axisLabelVisible: true,
                title: '',
            });
        }

        chartRef.current = chart;
        candleSeriesRef.current = series;

        const drawingsPrimitive = new DrawingsPrimitive();
        (series as any).attachPrimitive(drawingsPrimitive);
        drawingsPrimitiveRef.current = drawingsPrimitive;

        chart.subscribeCrosshairMove((param: MouseEventParams) => {
            if (!param.point || !param.time) {
                mousePointRef.current = null;
                if (activeToolRef.current === 'cursor' && !isDraggingRef.current) document.body.style.cursor = 'default';
                return;
            }

            const price = series.coordinateToPrice(param.point.y);
            if (price === null) return;

            mousePointRef.current = { time: param.time as Time, price };

            if (isDraggingRef.current) {
                const roundedPrice = Number(price.toFixed(3));
                setOrderState(prev => {
                    const updates = { ...prev };
                    if (isDraggingRef.current === 'entry') updates.entryPrice = roundedPrice;
                    if (isDraggingRef.current === 'sl') updates.stopLoss = roundedPrice;
                    if (isDraggingRef.current === 'tp') updates.takeProfit = roundedPrice;
                    return updates;
                });
                document.body.style.cursor = 'ns-resize';
                return;
            }

            if (activeToolRef.current === 'cursor') {
                const HIT_TEST_PIXELS = 6;
                const entryY = orderStateRef.current.entryPrice ? series.priceToCoordinate(orderStateRef.current.entryPrice) : null;
                const slY = orderStateRef.current.stopLoss ? series.priceToCoordinate(orderStateRef.current.stopLoss) : null;
                const tpY = orderStateRef.current.takeProfit ? series.priceToCoordinate(orderStateRef.current.takeProfit) : null;

                const mouseY = param.point.y;
                let isHoveringLine = false;

                if (entryY !== null && Math.abs(mouseY - entryY) < HIT_TEST_PIXELS) isHoveringLine = true;
                else if (slY !== null && Math.abs(mouseY - slY) < HIT_TEST_PIXELS) isHoveringLine = true;
                else if (tpY !== null && Math.abs(mouseY - tpY) < HIT_TEST_PIXELS) isHoveringLine = true;

                if (isHoveringLine) {
                    document.body.style.cursor = 'ns-resize';
                    chart.applyOptions({ handleScroll: false, handleScale: false });
                } else {
                    document.body.style.cursor = isAltDownRef.current ? 'crosshair' : 'default';
                    chart.applyOptions({ handleScroll: true, handleScale: true });
                }
            }
        });

        chart.subscribeClick((param: MouseEventParams) => {
            if (!param.point || !param.time) return;
            const price = series.coordinateToPrice(param.point.y);
            if (!price) return;

            if (isAltDownRef.current) {
                setMenuState({ x: param.point.x, y: param.point.y, price: price });
                return;
            }

            if (activeToolRef.current !== 'cursor') {
                const point: Point = { time: param.time as Time, price: price };
                const tool = activeToolRef.current;
                setCurrentDrawing(prev => {
                    if (!prev) return { id: Math.random().toString(), type: tool, points: [point] };
                    const newPoints = [...prev.points, point];
                    let isComplete = false;
                    if (tool === 'horizontal' && newPoints.length >= 1) isComplete = true;
                    if ((tool === 'line' || tool === 'rectangle') && newPoints.length >= 2) isComplete = true;
                    if (tool === 'triangle' && newPoints.length >= 3) isComplete = true;
                    if (isComplete) { setDrawings(ds => [...ds, { ...prev, points: newPoints }]); return null; }
                    else return { ...prev, points: newPoints };
                });
            }
        });

        const resizeObserver = new ResizeObserver(entries => {
            if (entries.length > 0 && entries[0].contentRect) {
                chart.applyOptions({ width: entries[0].contentRect.width, height: entries[0].contentRect.height });
            }
        });
        resizeObserver.observe(chartContainerRef.current);

        return () => {
            resizeObserver.disconnect();
            chart.remove();
            chartRef.current = null;
            candleSeriesRef.current = null;
            entryLineRef.current = null;
            slLineRef.current = null;
            tpLineRef.current = null;
        };
    }, [timezone, theme, chartData]);

    // Handle Drag Start
    const handleMouseDown = (e: React.MouseEvent) => {
        if (!chartRef.current || !candleSeriesRef.current || activeToolRef.current !== 'cursor') return;

        const rect = e.currentTarget.getBoundingClientRect();
        const y = e.clientY - rect.top;

        const series = candleSeriesRef.current;
        const price = series.coordinateToPrice(y);
        if (price === null) return;

        const entryY = orderStateRef.current.entryPrice ? series.priceToCoordinate(orderStateRef.current.entryPrice) : null;
        const slY = orderStateRef.current.stopLoss ? series.priceToCoordinate(orderStateRef.current.stopLoss) : null;
        const tpY = orderStateRef.current.takeProfit ? series.priceToCoordinate(orderStateRef.current.takeProfit) : null;

        const HIT_TEST_PIXELS = 6;

        if (entryY !== null && Math.abs(y - entryY) < HIT_TEST_PIXELS) {
            isDraggingRef.current = 'entry';
        } else if (slY !== null && Math.abs(y - slY) < HIT_TEST_PIXELS) {
            isDraggingRef.current = 'sl';
        } else if (tpY !== null && Math.abs(y - tpY) < HIT_TEST_PIXELS) {
            isDraggingRef.current = 'tp';
        }

        if (isDraggingRef.current) {
            chartRef.current.applyOptions({ handleScroll: false, handleScale: false });
        }
    };

    const startDragFromLabel = (type: 'entry' | 'sl' | 'tp') => {
        isDraggingRef.current = type;
        if (chartRef.current) {
            chartRef.current.applyOptions({ handleScroll: false, handleScale: false });
        }
    };

    useEffect(() => {
        const interval = setInterval(() => {
            if (drawingsPrimitiveRef.current) drawingsPrimitiveRef.current.setData(drawings, currentDrawing, mousePointRef.current);
        }, 16);
        return () => clearInterval(interval);
    }, [drawings, currentDrawing]);

    // Handle Indicators (V5 Syntax Update)
    useEffect(() => {
        if (!chartRef.current || chartData.length === 0) return;
        if (indicators.sma) {
            if (!smaSeriesRef.current) smaSeriesRef.current = chartRef.current.addSeries(LineSeries, { color: '#2962FF', lineWidth: 2, title: `SMA ${indicators.smaPeriod}`, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
            else smaSeriesRef.current.applyOptions({ title: `SMA ${indicators.smaPeriod}` });
            smaSeriesRef.current.setData(calculateSMA(chartData, indicators.smaPeriod));
        } else if (smaSeriesRef.current) { chartRef.current.removeSeries(smaSeriesRef.current); smaSeriesRef.current = null; }
        if (indicators.ema) {
            if (!emaSeriesRef.current) emaSeriesRef.current = chartRef.current.addSeries(LineSeries, { color: '#FF6D00', lineWidth: 2, title: `EMA ${indicators.emaPeriod}`, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
            else emaSeriesRef.current.applyOptions({ title: `EMA ${indicators.emaPeriod}` });
            emaSeriesRef.current.setData(calculateEMA(chartData, indicators.emaPeriod));
        } else if (emaSeriesRef.current) { chartRef.current.removeSeries(emaSeriesRef.current); emaSeriesRef.current = null; }
        if (indicators.volume) {
            if (!volumeSeriesRef.current) { volumeSeriesRef.current = chartRef.current.addSeries(HistogramSeries, { priceFormat: { type: 'volume' }, priceScaleId: '' }); volumeSeriesRef.current.priceScale().applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } }); }
            volumeSeriesRef.current.setData(chartData.map(d => ({ time: d.time as Time, value: d.volume || 0, color: d.close >= d.open ? 'rgba(38, 166, 154, 0.5)' : 'rgba(239, 83, 80, 0.5)' })));
        } else if (volumeSeriesRef.current) { chartRef.current.removeSeries(volumeSeriesRef.current); volumeSeriesRef.current = null; }
    }, [indicators, chartData]);

    const handleMenuOrder = (type: TradeType) => {
        if (menuState) {
            const price = menuState.price;
            const sl = type === TradeType.LONG ? price * 0.99 : price * 1.01;
            const tp = type === TradeType.LONG ? price * 1.02 : price * 0.98;
            setOrderState(prev => ({
                ...prev,
                type: type,
                entryPrice: Number(price.toFixed(3)),
                stopLoss: Number(sl.toFixed(3)),
                takeProfit: Number(tp.toFixed(3))
            }));
            setMenuState(null);
        }
    };

    const handleClearEntry = () => setOrderState(prev => ({ ...prev, entryPrice: 0, stopLoss: 0, takeProfit: 0 }));
    const handleClearSL = () => setOrderState(prev => ({ ...prev, stopLoss: 0 }));
    const handleClearTP = () => setOrderState(prev => ({ ...prev, takeProfit: 0 }));

    const handleAddSL = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (orderState.stopLoss > 0) return;
        const price = orderState.entryPrice;
        if (!price) return;
        const isLong = orderState.type === TradeType.LONG;
        const offset = price * 0.005;
        const sl = isLong ? price - offset : price + offset;
        setOrderState(prev => ({ ...prev, stopLoss: Number(sl.toFixed(5)) }));
    };

    const handleAddTP = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (orderState.takeProfit > 0) return;
        const price = orderState.entryPrice;
        if (!price) return;
        const isLong = orderState.type === TradeType.LONG;
        const offset = price * 0.01;
        const tp = isLong ? price + offset : price - offset;
        setOrderState(prev => ({ ...prev, takeProfit: Number(tp.toFixed(5)) }));
    };

    const getLastPrice = () => {
        if (chartData.length === 0) return 0;
        return chartData[chartData.length - 1].close;
    };

    const currentPrice = getLastPrice();
    const isAbove = menuState ? menuState.price > currentPrice : false;

    const getEntryText = () => {
        const lastClose = chartData.length > 0 ? chartData[chartData.length - 1].close : 0;
        if (orderState.type === TradeType.LONG) {
            return orderState.entryPrice <= lastClose ? 'Buy Limit' : 'Buy Stop';
        } else {
            return orderState.entryPrice >= lastClose ? 'Sell Limit' : 'Sell Stop';
        }
    };

    const LabelComponent = ({
        type,
        text,
        colorClass,
        onClear,
        elRef,
        quantity,
        onAddTP,
        onAddSL,
        showAddTP,
        showAddSL
    }: {
        type: 'entry' | 'sl' | 'tp',
        text: string,
        colorClass: string,
        onClear: () => void,
        elRef: React.RefObject<HTMLDivElement>,
        quantity?: number,
        onAddTP?: (e: React.MouseEvent) => void,
        onAddSL?: (e: React.MouseEvent) => void,
        showAddTP?: boolean,
        showAddSL?: boolean
    }) => {
        return (
            <div
                ref={elRef}
                className={`absolute right-[65px] z-20 flex items-center shadow-md rounded-md cursor-pointer select-none transition-transform hover:scale-105 ${colorClass}`}
                style={{ display: 'none', top: 0 }}
                onMouseDown={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    startDragFromLabel(type);
                }}
            >
                {quantity && (
                    <div className="px-2 py-1 text-[10px] font-bold bg-slate-700 border-r border-slate-600 rounded-l-md h-6 flex items-center text-slate-300">
                        {quantity}
                    </div>
                )}

                <div className={`px-2 py-1 text-[10px] font-bold uppercase flex items-center gap-2 bg-slate-800 border-y border-r border-slate-600 h-6 ${!quantity ? 'rounded-l-md' : ''}`}>
                    {text}
                </div>

                {type === 'entry' && showAddTP && (
                    <div onClick={onAddTP} className="px-2 py-1 text-[10px] font-bold text-slate-500 hover:text-emerald-400 bg-slate-800/50 hover:bg-slate-700 border-y border-r border-slate-600 border-dashed cursor-pointer h-6 flex items-center transition-colors" title="Add Take Profit" onMouseDown={(e) => e.stopPropagation()}>TP</div>
                )}
                {type === 'entry' && showAddSL && (
                    <div onClick={onAddSL} className="px-2 py-1 text-[10px] font-bold text-slate-500 hover:text-rose-400 bg-slate-800/50 hover:bg-slate-700 border-y border-r border-slate-600 border-dashed cursor-pointer h-6 flex items-center transition-colors" title="Add Stop Loss" onMouseDown={(e) => e.stopPropagation()}>SL</div>
                )}

                <div className="h-6 w-6 flex items-center justify-center bg-slate-700 hover:bg-rose-500 text-slate-300 hover:text-white border-y border-r border-slate-600 hover:border-rose-500 rounded-r-md transition-colors cursor-pointer" onClick={(e) => { e.stopPropagation(); onClear(); }} onMouseDown={(e) => { e.stopPropagation(); }} title="Cancel">
                    <X size={12} />
                </div>
            </div>
        );
    };

    const isShort = orderState.type === TradeType.SHORT;
    const entryLabelColor = isShort ? 'text-rose-400' : 'text-emerald-400';

    return (
        <div className="flex flex-col h-full bg-slate-900 border border-slate-700 rounded-xl overflow-hidden relative">
            <div className="flex items-center justify-between px-4 py-2 bg-slate-800 border-b border-slate-700 z-20">
                <div className="flex items-center gap-4">
                    <div className="flex items-baseline gap-2 border-r border-slate-700 pr-4">
                        <div className="font-bold text-white text-lg tracking-tight">
                            {symbol.replace('_', '')}
                        </div>
                        <span className="text-[9px] text-[#557C68] font-bold tracking-wide">by OANDA</span>
                    </div>
                    <div className="flex gap-0.5">
                        {Object.keys(TIMEFRAMES).map(tf => (
                            <button key={tf} onClick={() => setActiveTimeframe(tf)} className={`px-2 py-0.5 text-xs rounded ${activeTimeframe === tf ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-700'}`}>{tf}</button>
                        ))}
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 bg-slate-900/50 p-1 rounded-lg border border-slate-700/50">
                        <button onClick={() => setActiveTool('cursor')} className={`p-1.5 rounded ${activeTool === 'cursor' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-700'}`} title="Cursor"><MousePointer2 size={14} /></button>
                        <button onClick={() => setActiveTool('line')} className={`p-1.5 rounded ${activeTool === 'line' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-700'}`} title="Trend Line"><Minus size={14} className="-rotate-45" /></button>
                        <button onClick={() => setActiveTool('horizontal')} className={`p-1.5 rounded ${activeTool === 'horizontal' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-700'}`} title="Horizontal Line"><Minus size={14} /></button>
                        <button onClick={() => setActiveTool('rectangle')} className={`p-1.5 rounded ${activeTool === 'rectangle' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-700'}`} title="Rectangle"><Square size={14} /></button>
                        <button onClick={() => setActiveTool('triangle')} className={`p-1.5 rounded ${activeTool === 'triangle' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-700'}`} title="Triangle"><Triangle size={14} /></button>
                        <button onClick={() => { setDrawings([]); setCurrentDrawing(null); handleClearEntry(); }} className="p-1.5 rounded text-rose-400 hover:text-white hover:bg-rose-500/20" title="Clear All"><X size={14} /></button>
                    </div>
                    <div className="h-4 w-px bg-slate-700"></div>
                    <div className="relative" ref={indicatorsRef}>
                        <button onClick={() => { setIsIndicatorsMenuOpen(!isIndicatorsMenuOpen); setIsStyleMenuOpen(false); }} className={`flex items-center gap-1.5 px-3 py-1.5 rounded transition-colors text-xs font-medium border ${isIndicatorsMenuOpen ? 'bg-slate-700 text-white border-slate-600' : 'text-slate-400 border-transparent hover:text-white hover:bg-slate-700'}`} title="Indicators"><Activity size={14} /><span>Indicators</span></button>
                        {isIndicatorsMenuOpen && (
                            <div className="absolute right-0 top-full mt-2 w-52 bg-slate-800 border border-slate-700 rounded-xl shadow-xl z-50 overflow-hidden">
                                <div className="p-1">
                                    <div className="flex items-center justify-between px-3 h-8 text-xs text-slate-300 hover:bg-slate-700 rounded transition-colors"><div className="flex items-center gap-2 flex-1 cursor-pointer" onClick={() => setIndicators(p => ({ ...p, sma: !p.sma }))}><TrendingUp size={14} /> SMA</div><div className="flex items-center gap-2">{indicators.sma && <input type="number" value={indicators.smaPeriod} onChange={(e) => setIndicators(p => ({ ...p, smaPeriod: parseInt(e.target.value) || 20 }))} className="w-10 h-6 bg-slate-900 border border-slate-600 rounded px-1 text-right text-xs focus:ring-1 focus:ring-blue-500 outline-none" />}<div onClick={() => setIndicators(p => ({ ...p, sma: !p.sma }))} className={`w-3 h-3 rounded border flex items-center justify-center cursor-pointer ${indicators.sma ? 'bg-blue-600 border-blue-600' : 'border-slate-500'}`}>{indicators.sma && <div className="w-1.5 h-1.5 bg-white rounded-full" />}</div></div></div>
                                    <div className="flex items-center justify-between px-3 h-8 text-xs text-slate-300 hover:bg-slate-700 rounded transition-colors"><div className="flex items-center gap-2 flex-1 cursor-pointer" onClick={() => setIndicators(p => ({ ...p, ema: !p.ema }))}><TrendingUp size={14} /> EMA</div><div className="flex items-center gap-2">{indicators.ema && <input type="number" value={indicators.emaPeriod} onChange={(e) => setIndicators(p => ({ ...p, emaPeriod: parseInt(e.target.value) || 20 }))} className="w-10 h-6 bg-slate-900 border border-slate-600 rounded px-1 text-right text-xs focus:ring-1 focus:ring-blue-500 outline-none" />}<div onClick={() => setIndicators(p => ({ ...p, ema: !p.ema }))} className={`w-3 h-3 rounded border flex items-center justify-center cursor-pointer ${indicators.ema ? 'bg-blue-600 border-blue-600' : 'border-slate-500'}`}>{indicators.ema && <div className="w-1.5 h-1.5 bg-white rounded-full" />}</div></div></div>
                                    <div className="flex items-center justify-between px-3 h-8 text-xs text-slate-300 hover:bg-slate-700 rounded transition-colors cursor-pointer" onClick={() => setIndicators(p => ({ ...p, volume: !p.volume }))}><div className="flex items-center gap-2"><Activity size={14} /> Volume</div><div className={`w-3 h-3 rounded border flex items-center justify-center ${indicators.volume ? 'bg-blue-600 border-blue-600' : 'border-slate-500'}`}>{indicators.volume && <div className="w-1.5 h-1.5 bg-white rounded-full" />}</div></div>
                                </div>
                            </div>
                        )}
                    </div>
                    <div className="relative" ref={styleRef}>
                        <button onClick={() => { setIsStyleMenuOpen(!isStyleMenuOpen); setIsIndicatorsMenuOpen(false); }} className={`p-1.5 rounded transition-colors ${isStyleMenuOpen ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-700'}`} title="Chart Settings"><Settings size={16} /></button>
                        {isStyleMenuOpen && (
                            <div className="absolute right-0 top-full mt-2 w-56 bg-slate-800 border border-slate-700 rounded-xl shadow-xl z-50 overflow-hidden">
                                <div className="p-3 space-y-3">
                                    <div className="flex items-center justify-between"><span className="text-sm text-slate-300">Hollow Candles</span><button onClick={() => setChartStyle(prev => ({ ...prev, isHollow: !prev.isHollow }))} className={`w-9 h-5 rounded-full relative transition-colors ${chartStyle.isHollow ? 'bg-blue-600' : 'bg-slate-600'}`}><span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${chartStyle.isHollow ? 'translate-x-4' : 'translate-x-0'}`} /></button></div>
                                    <div><label className="text-xs text-slate-500 font-bold uppercase mb-1 block">Up Color</label><div className="flex items-center gap-2"><input type="color" value={chartStyle.upColor} onChange={(e) => setChartStyle(prev => ({ ...prev, upColor: e.target.value }))} className="w-8 h-8 rounded cursor-pointer bg-transparent border-none" /><span className="text-xs font-mono text-slate-400">{chartStyle.upColor}</span></div></div>
                                    <div><label className="text-xs text-slate-500 font-bold uppercase mb-1 block">Down Color</label><div className="flex items-center gap-2"><input type="color" value={chartStyle.downColor} onChange={(e) => setChartStyle(prev => ({ ...prev, downColor: e.target.value }))} className="w-8 h-8 rounded cursor-pointer bg-transparent border-none" /><span className="text-xs font-mono text-slate-400">{chartStyle.downColor}</span></div></div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="flex-1 relative z-0">
                {error && <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none"><div className="bg-slate-900/80 p-4 rounded-xl border border-slate-700 text-rose-400 flex items-center gap-2"><AlertCircle size={20} />{error}</div></div>}
                {loading && !chartData.length && <div className="absolute inset-0 flex items-center justify-center bg-slate-900 z-10"><div className="flex flex-col items-center gap-2"><RefreshCw size={24} className="text-blue-500 animate-spin" /><span className="text-xs text-slate-500">Fetching OANDA data...</span></div></div>}

                {menuState && (
                    <div
                        id="chart-order-menu"
                        className="absolute z-30 bg-slate-800 border border-slate-700 rounded-lg shadow-xl overflow-hidden flex flex-col w-40 animate-fade-in"
                        style={{ top: menuState.y, left: menuState.x }}
                    >
                        {isAbove ? (
                            <>
                                <button onClick={() => handleMenuOrder(TradeType.LONG)} className="px-4 py-3 text-left text-xs font-bold text-emerald-400 hover:bg-slate-700 transition-colors border-b border-slate-700 flex justify-between">
                                    <span>Buy Stop</span>
                                    <span className="font-mono opacity-70">@{menuState.price.toFixed(3)}</span>
                                </button>
                                <button onClick={() => handleMenuOrder(TradeType.SHORT)} className="px-4 py-3 text-left text-xs font-bold text-rose-400 hover:bg-slate-700 transition-colors flex justify-between">
                                    <span>Sell Limit</span>
                                    <span className="font-mono opacity-70">@{menuState.price.toFixed(3)}</span>
                                </button>
                            </>
                        ) : (
                            <>
                                <button onClick={() => handleMenuOrder(TradeType.LONG)} className="px-4 py-3 text-left text-xs font-bold text-emerald-400 hover:bg-slate-700 transition-colors border-b border-slate-700 flex justify-between">
                                    <span>Buy Limit</span>
                                    <span className="font-mono opacity-70">@{menuState.price.toFixed(3)}</span>
                                </button>
                                <button onClick={() => handleMenuOrder(TradeType.SHORT)} className="px-4 py-3 text-left text-xs font-bold text-rose-400 hover:bg-slate-700 transition-colors flex justify-between">
                                    <span>Sell Stop</span>
                                    <span className="font-mono opacity-70">@{menuState.price.toFixed(3)}</span>
                                </button>
                            </>
                        )}
                    </div>
                )}

                <div ref={chartContainerRef} onMouseDown={handleMouseDown} className="w-full h-full" />

                <LabelComponent
                    type="entry"
                    text={getEntryText()}
                    quantity={orderState.quantity}
                    colorClass={entryLabelColor}
                    onClear={handleClearEntry}
                    elRef={entryLabelRef}
                    onAddTP={handleAddTP}
                    onAddSL={handleAddSL}
                    showAddTP={orderState.takeProfit === 0}
                    showAddSL={orderState.stopLoss === 0}
                />
                <LabelComponent type="sl" text="Stop Loss" colorClass="text-rose-400" onClear={handleClearSL} elRef={slLabelRef} />
                <LabelComponent type="tp" text="Take Profit" colorClass="text-emerald-400" onClear={handleClearTP} elRef={tpLabelRef} />
            </div>
        </div>
    );
};
