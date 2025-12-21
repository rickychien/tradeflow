
import React, { useEffect, useRef, useState } from 'react';
import {
    createChart, ColorType, CrosshairMode, IChartApi, Time, ISeriesApi,
    CandlestickData, MouseEventParams, LineData,
    CandlestickSeries, LineSeries, HistogramSeries
} from 'lightweight-charts';
import { Trade, ChartCandle } from '../../types';
import { fetchOandaCandles } from '../../services/oandaService';
import { RefreshCw, AlertCircle, Settings, X, Activity, TrendingUp, MousePointer2, Minus, Square, Triangle } from 'lucide-react';
import { useSettings } from '../../contexts/SettingsContext';

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

// ... Drawing Renderer Classes ...
interface Point {
    time: Time;
    price: number;
}

interface Drawing {
    id: string;
    type: string;
    points: Point[];
}

class TradeMarkersRenderer {
    _data: { trade: Trade, candles: ChartCandle[] } | null = null;
    _chart: IChartApi | null = null;
    _series: ISeriesApi<"Candlestick"> | null = null;
    _mousePos: { x: number, y: number } | null = null;
    _fetchingInitialSL: boolean = false;

    constructor(
        data: { trade: Trade, candles: ChartCandle[] } | null,
        chart: IChartApi | null,
        series: ISeriesApi<"Candlestick"> | null,
        mousePos: { x: number, y: number } | null,
        fetchingInitialSL: boolean
    ) {
        this._data = data;
        this._chart = chart;
        this._series = series;
        this._mousePos = mousePos;
        this._fetchingInitialSL = fetchingInitialSL;
    }

    _distToSegment(p: { x: number, y: number }, v: { x: number, y: number }, w: { x: number, y: number }) {
        function sqr(x: number) { return x * x }
        function dist2(v: { x: number, y: number }, w: { x: number, y: number }) { return sqr(v.x - w.x) + sqr(v.y - w.y) }
        function distToSegmentSquared(p: { x: number, y: number }, v: { x: number, y: number }, w: { x: number, y: number }) {
            var l2 = dist2(v, w);
            if (l2 === 0) return dist2(p, v);
            var t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
            t = Math.max(0, Math.min(1, t));
            return dist2(p, {
                x: v.x + t * (w.x - v.x),
                y: v.y + t * (w.y - v.y)
            });
        }
        return Math.sqrt(distToSegmentSquared(p, v, w));
    }

    draw(target: any) {
        if (!this._data || !this._chart || !this._series || this._data.candles.length === 0) return;

        target.useMediaCoordinateSpace((scope: any) => {
            const ctx = scope.context;
            const trade = this._data!.trade;
            const candles = this._data!.candles;
            const timeScale = this._chart!.timeScale();
            const series = this._series!;

            const GAP_CANDLE = 8;
            const LINE_LENGTH = 32;
            const GAP_ICON = 4;
            const ICON_SIZE = 14;
            const ICON_HALF = ICON_SIZE / 2;
            const LABEL_HEIGHT = 18;

            const labels: { y: number, renderY: number, color: string, text: string }[] = [];

            const isLong = trade.type === 'LONG';
            const directionColor = isLong ? '#25988c' : '#ef5350';
            const entryLabelColor = '#3b82f6';
            const takeProfitColor = '#10b981';

            const getCoords = (ts: number | undefined) => {
                if (!ts) return null;

                let index = -1;
                for (let i = 0; i < candles.length; i++) {
                    if ((candles[i].time as number) === ts) {
                        index = i;
                        break;
                    }
                }

                if (index === -1) {
                    let minDiff = Infinity;
                    for (let i = 0; i < candles.length; i++) {
                        const diff = Math.abs((candles[i].time as number) - ts);
                        if (diff < minDiff) {
                            minDiff = diff;
                            index = i;
                        }
                    }
                }

                if (index === -1) return null;
                const closest = candles[index];

                const x = timeScale.timeToCoordinate(closest.time as Time);
                if (x === null) return null;

                const highY = series.priceToCoordinate(closest.high);
                const lowY = series.priceToCoordinate(closest.low);

                if (highY === null || lowY === null) return null;

                return { x, highY, lowY, index, closest };
            };

            const queueHorizontalLineLabel = (price: number, color: string, label: string) => {
                const y = series.priceToCoordinate(price);
                if (y === null) return;

                const rightEdge = scope.mediaSize.width;
                const leftEdge = 0;

                ctx.beginPath();
                ctx.strokeStyle = color;
                ctx.lineWidth = 1;
                ctx.setLineDash([4, 4]);
                ctx.moveTo(leftEdge, y);
                ctx.lineTo(rightEdge, y);
                ctx.stroke();
                ctx.setLineDash([]);

                labels.push({ y, renderY: y, color, text: label });
            };

            const queuePriceMarkLabel = (x: number, price: number, color: string, index: number, customLabel?: string) => {
                const y = series.priceToCoordinate(price);
                if (y === null) return;

                const rightEdge = scope.mediaSize.width;

                ctx.beginPath();
                ctx.strokeStyle = color;
                ctx.lineWidth = 1;
                ctx.setLineDash([4, 4]);
                ctx.moveTo(x, y);
                ctx.lineTo(rightEdge, y);
                ctx.stroke();
                ctx.setLineDash([]);

                labels.push({ y, renderY: y, color, text: customLabel || price.toFixed(3) });
            };

            const drawEntry = () => {
                if (!trade.entryTimestamp) return;
                const coords = getCoords(trade.entryTimestamp);
                if (!coords) return;

                const yCandle = isLong ? coords.lowY : coords.highY;
                const isPositionAbove = !isLong;

                drawMarker(ctx, coords.x, yCandle, isPositionAbove, directionColor, 'arrow');
                queuePriceMarkLabel(coords.x, trade.entryPrice, entryLabelColor, coords.index, `ENTRY ${trade.entryPrice.toFixed(3)}`);

                return { x: coords.x, y: series.priceToCoordinate(trade.entryPrice) };
            };

            const drawExit = () => {
                if (!trade.exitTimestamp) return;
                const coords = getCoords(trade.exitTimestamp);
                if (!coords) return;

                const yCandle = isLong ? coords.highY : coords.lowY;
                const isPositionAbove = isLong;
                const color = '#be8b5b';

                drawMarker(ctx, coords.x, yCandle, isPositionAbove, color, 'x');

                if (trade.exitPrice) {
                    queuePriceMarkLabel(coords.x, trade.exitPrice, color, coords.index, `EXIT ${trade.exitPrice.toFixed(3)}`);
                }

                return { x: coords.x, y: series.priceToCoordinate(trade.exitPrice!) };
            };

            const displayStopLoss = trade.initialStopLoss !== undefined ? trade.initialStopLoss : trade.stopLoss;

            if (displayStopLoss && !this._fetchingInitialSL) {
                let slLabel = `Initial SL ${displayStopLoss.toFixed(3)}`;
                queueHorizontalLineLabel(displayStopLoss, '#ef4444', slLabel);
            }

            if (trade.takeProfit) {
                let tpLabel = `TP ${trade.takeProfit.toFixed(3)}`;
                queueHorizontalLineLabel(trade.takeProfit, takeProfitColor, tpLabel);
            }

            const drawMarker = (ctx: CanvasRenderingContext2D, x: number, yCandle: number, isAbove: boolean, color: string, type: 'arrow' | 'x') => {
                const lineStart = isAbove ? yCandle - GAP_CANDLE : yCandle + GAP_CANDLE;
                const lineEnd = isAbove ? lineStart - LINE_LENGTH : lineStart + LINE_LENGTH;
                const iconCenterY = isAbove ? lineEnd - GAP_ICON - ICON_HALF : lineEnd + GAP_ICON + ICON_HALF;

                ctx.beginPath();
                ctx.setLineDash([2, 2]);
                ctx.strokeStyle = color;
                ctx.lineWidth = 1;
                ctx.moveTo(x, lineStart);
                ctx.lineTo(x, lineEnd);
                ctx.stroke();
                ctx.setLineDash([]);

                ctx.beginPath();
                ctx.fillStyle = color;
                ctx.arc(x, iconCenterY, ICON_HALF, 0, 2 * Math.PI);
                ctx.fill();

                ctx.fillStyle = '#ffffff';
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 1;

                if (type === 'arrow') {
                    ctx.beginPath();
                    if (isAbove) {
                        ctx.moveTo(x, iconCenterY + 4);
                        ctx.lineTo(x - 3.5, iconCenterY);
                        ctx.lineTo(x - 1.2, iconCenterY);
                        ctx.lineTo(x - 1.2, iconCenterY - 4);
                        ctx.lineTo(x + 1.2, iconCenterY - 4);
                        ctx.lineTo(x + 1.2, iconCenterY);
                        ctx.lineTo(x + 3.5, iconCenterY);
                    } else {
                        ctx.moveTo(x, iconCenterY - 4);
                        ctx.lineTo(x - 3.5, iconCenterY);
                        ctx.lineTo(x - 1.2, iconCenterY);
                        ctx.lineTo(x - 1.2, iconCenterY + 4);
                        ctx.lineTo(x + 1.2, iconCenterY + 4);
                        ctx.lineTo(x + 1.2, iconCenterY);
                        ctx.lineTo(x + 3.5, iconCenterY);
                    }
                    ctx.closePath();
                    ctx.fill();
                } else {
                    const s = 3;
                    ctx.beginPath();
                    ctx.lineWidth = 2;
                    ctx.moveTo(x - s, iconCenterY - s);
                    ctx.lineTo(x + s, iconCenterY + s);
                    ctx.moveTo(x + s, iconCenterY - s);
                    ctx.lineTo(x - s, iconCenterY + s);
                    ctx.stroke();
                }
            };

            const entryPoint = drawEntry();
            const exitPoint = drawExit();

            labels.sort((a, b) => a.renderY - b.renderY);

            for (let pass = 0; pass < 5; pass++) {
                labels.sort((a, b) => a.renderY - b.renderY);
                for (let i = 0; i < labels.length - 1; i++) {
                    const curr = labels[i];
                    const next = labels[i + 1];
                    const dist = next.renderY - curr.renderY;
                    if (dist < LABEL_HEIGHT) {
                        const overlap = LABEL_HEIGHT - dist;
                        curr.renderY -= overlap / 2;
                        next.renderY += overlap / 2;
                    }
                }
            }

            labels.forEach(l => {
                const rightEdge = scope.mediaSize.width;
                const textWidth = ctx.measureText(l.text).width + 8;
                const textHeight = 14;
                const labelX = rightEdge - textWidth;
                const labelY = l.renderY - textHeight / 2;

                ctx.fillStyle = l.color;
                ctx.beginPath();
                ctx.roundRect(labelX, labelY, textWidth, textHeight, 4);
                ctx.fill();

                ctx.fillStyle = '#ffffff';
                ctx.font = 'bold 10px Inter, sans-serif';
                ctx.textBaseline = 'middle';
                ctx.textAlign = 'center';
                ctx.fillText(l.text, labelX + textWidth / 2, l.renderY);
            });

            if (entryPoint && entryPoint.y !== null && exitPoint && exitPoint.y !== null) {
                ctx.beginPath();
                ctx.strokeStyle = '#a855f7';
                ctx.lineWidth = 2;
                ctx.setLineDash([]);
                ctx.globalAlpha = 0.5;
                ctx.moveTo(entryPoint.x, entryPoint.y);
                ctx.lineTo(exitPoint.x, exitPoint.y);
                ctx.stroke();
                ctx.setLineDash([]);
                ctx.globalAlpha = 1.0;

                if (this._mousePos) {
                    const dist = this._distToSegment(
                        this._mousePos,
                        entryPoint as { x: number, y: number },
                        exitPoint as { x: number, y: number }
                    );

                    if (dist < 10) {
                        const stopLossToUse = trade.initialStopLoss !== undefined ? trade.initialStopLoss : trade.stopLoss;
                        const risk = Math.abs(trade.entryPrice - stopLossToUse);
                        let tooltipText = '';
                        let color = '#94a3b8';

                        if (risk > 0 && trade.exitPrice) {
                            const isLong = trade.type === 'LONG';
                            const realized = isLong ? (trade.exitPrice - trade.entryPrice) : (trade.entryPrice - trade.exitPrice);
                            const rMult = realized / risk;
                            tooltipText = `${rMult > 0 ? '+' : ''}${rMult.toFixed(2)}R`;
                            color = rMult >= 0 ? '#10b981' : '#f43f5e';
                        } else {
                            tooltipText = 'Trade Path';
                        }

                        const mx = this._mousePos!.x;
                        const my = this._mousePos!.y - 20;
                        const textWidth = ctx.measureText(tooltipText).width + 12;
                        const textHeight = 20;
                        const boxX = mx - textWidth / 2;
                        const boxY = my - textHeight / 2;

                        ctx.shadowColor = 'rgba(0,0,0,0.5)';
                        ctx.shadowBlur = 4;
                        ctx.shadowOffsetY = 2;

                        ctx.fillStyle = '#1e293b';
                        ctx.beginPath();
                        ctx.roundRect(boxX, boxY, textWidth, textHeight, 4);
                        ctx.fill();

                        ctx.shadowColor = 'transparent';
                        ctx.shadowBlur = 0;
                        ctx.shadowOffsetY = 0;

                        ctx.strokeStyle = color;
                        ctx.lineWidth = 1;
                        ctx.stroke();

                        ctx.fillStyle = color;
                        ctx.font = 'bold 11px Inter, sans-serif';
                        ctx.textBaseline = 'middle';
                        ctx.textAlign = 'center';
                        ctx.fillText(tooltipText, mx, my);
                    }
                }
            }
        });
    }
}

class TradeMarkersPrimitive {
    _attachedParams: any | null = null;
    _data: { trade: Trade, candles: ChartCandle[] } | null = null;
    _view: TradeMarkersPaneView;
    _mousePos: { x: number, y: number } | null = null;
    _fetchingInitialSL: boolean = false;

    constructor() {
        this._view = new TradeMarkersPaneView(this);
    }

    setData(trade: Trade, candles: ChartCandle[], fetchingInitialSL: boolean) {
        this._data = { trade, candles };
        this._fetchingInitialSL = fetchingInitialSL;
        this.updateAllViews();
    }

    setMousePos(p: { x: number, y: number } | null) {
        this._mousePos = p;
        this.updateAllViews();
    }

    attached(params: any) {
        this._attachedParams = params;
    }

    detached() {
        this._attachedParams = null;
    }

    paneViews() {
        return [this._view];
    }

    updateAllViews() {
        if (this._attachedParams) {
            this._attachedParams.requestUpdate();
        }
    }
}

class TradeMarkersPaneView {
    _source: TradeMarkersPrimitive;
    constructor(source: TradeMarkersPrimitive) { this._source = source; }
    renderer() {
        return new TradeMarkersRenderer(
            this._source._data,
            this._source._attachedParams?.chart || null,
            this._source._attachedParams?.series || null,
            this._source._mousePos,
            this._source._fetchingInitialSL
        );
    }
}

interface ChartComponentProps {
    trade: Trade;
    forcedTimeframe?: string;
    hideToolbar?: boolean;
    onSettingsClick?: () => void;
    fetchingInitialSL?: boolean;
}

const TIMEFRAMES: Record<string, number> = {
    '1m': 60, '5m': 300, '15m': 900, '1h': 3600, '4h': 14400, 'D': 86400,
};

const OANDA_TF_MAP: Record<string, string> = {
    '1m': 'M1', '5m': 'M5', '15m': 'M15', '1h': 'H1', '4h': 'H4', 'D': 'D',
};

export const ChartComponent: React.FC<ChartComponentProps> = ({ trade, forcedTimeframe, hideToolbar, onSettingsClick, fetchingInitialSL = false }) => {
    const { oandaApiKey, oandaEnv, timezone, availableInstruments, theme } = useSettings();
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);
    const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
    const markersPrimitiveRef = useRef<TradeMarkersPrimitive | null>(null);

    const smaSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
    const emaSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
    const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);

    const indicatorsRef = useRef<HTMLDivElement>(null);
    const styleRef = useRef<HTMLDivElement>(null);

    const [activeTimeframe, setActiveTimeframe] = useState<string>(forcedTimeframe || '5m');
    const [loading, setLoading] = useState(false);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [retryCount, setRetryCount] = useState(0);

    const [chartData, setChartData] = useState<ChartCandle[]>([]);
    const chartDataRef = useRef<ChartCandle[]>([]);

    const [isStyleMenuOpen, setIsStyleMenuOpen] = useState(false);
    const [isIndicatorsMenuOpen, setIsIndicatorsMenuOpen] = useState(false);

    const [indicators, setIndicators] = useState({ sma: false, smaPeriod: 20, ema: false, emaPeriod: 20, volume: false });

    const [chartStyle, setChartStyle] = useState(() => {
        const savedHollow = localStorage.getItem('chart_hollow');
        return {
            isHollow: savedHollow === null ? true : savedHollow === 'true',
            upColor: localStorage.getItem('chart_upColor') || '#26a69a',
            downColor: localStorage.getItem('chart_downColor') || '#ef5350'
        };
    });

    const toggleIndicator = (key: 'sma' | 'ema' | 'volume') => {
        setIndicators(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const handlePeriodChange = (key: 'smaPeriod' | 'emaPeriod', value: string) => {
        const val = parseInt(value);
        if (!isNaN(val) && val > 0) {
            setIndicators(prev => ({ ...prev, [key]: val }));
        }
    };

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (indicatorsRef.current && !indicatorsRef.current.contains(event.target as Node)) {
                setIsIndicatorsMenuOpen(false);
            }
            if (styleRef.current && !styleRef.current.contains(event.target as Node)) {
                setIsStyleMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        chartDataRef.current = chartData;
        if (markersPrimitiveRef.current) markersPrimitiveRef.current.setData(trade, chartData, fetchingInitialSL);

        if (chartRef.current && chartData.length > 0) {
            if (indicators.sma) {
                if (!smaSeriesRef.current) smaSeriesRef.current = chartRef.current.addSeries(LineSeries, {
                    color: '#2962FF',
                    lineWidth: 2,
                    title: `SMA ${indicators.smaPeriod}`,
                    priceLineVisible: false,
                    lastValueVisible: false,
                    crosshairMarkerVisible: false
                });
                else smaSeriesRef.current.applyOptions({ title: `SMA ${indicators.smaPeriod}` });
                smaSeriesRef.current.setData(calculateSMA(chartData, indicators.smaPeriod));
            } else if (smaSeriesRef.current) {
                chartRef.current.removeSeries(smaSeriesRef.current); smaSeriesRef.current = null;
            }

            if (indicators.ema) {
                if (!emaSeriesRef.current) emaSeriesRef.current = chartRef.current.addSeries(LineSeries, {
                    color: '#FF6D00',
                    lineWidth: 2,
                    title: `EMA ${indicators.emaPeriod}`,
                    priceLineVisible: false,
                    lastValueVisible: false,
                    crosshairMarkerVisible: false
                });
                else emaSeriesRef.current.applyOptions({ title: `EMA ${indicators.emaPeriod}` });
                emaSeriesRef.current.setData(calculateEMA(chartData, indicators.emaPeriod));
            } else if (emaSeriesRef.current) {
                chartRef.current.removeSeries(emaSeriesRef.current); emaSeriesRef.current = null;
            }

            if (indicators.volume) {
                if (!volumeSeriesRef.current) {
                    volumeSeriesRef.current = chartRef.current.addSeries(HistogramSeries, { priceFormat: { type: 'volume' }, priceScaleId: '' });
                    volumeSeriesRef.current.priceScale().applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });
                }
                const volumeData = chartData.map(d => ({
                    time: d.time as Time,
                    value: d.volume || 0,
                    color: d.close >= d.open ? 'rgba(38, 166, 154, 0.5)' : 'rgba(239, 83, 80, 0.5)'
                }));
                volumeSeriesRef.current.setData(volumeData);
            } else if (volumeSeriesRef.current) {
                chartRef.current.removeSeries(volumeSeriesRef.current); volumeSeriesRef.current = null;
            }
        }
    }, [chartData, trade, indicators, fetchingInitialSL]);

    useEffect(() => {
        if (chartRef.current) {
            chartRef.current.applyOptions({
                layout: {
                    background: { type: ColorType.Solid, color: theme === 'light' ? '#ffffff' : '#0f172a' },
                    textColor: theme === 'light' ? '#334155' : '#94a3b8',
                },
                grid: {
                    vertLines: { color: theme === 'light' ? '#e2e8f0' : '#1e293b' },
                    horzLines: { color: theme === 'light' ? '#e2e8f0' : '#1e293b' }
                },
                timeScale: {
                    borderColor: theme === 'light' ? '#cbd5e1' : '#334155',
                },
                rightPriceScale: {
                    borderColor: theme === 'light' ? '#cbd5e1' : '#334155',
                }
            });
        }
    }, [theme]);

    useEffect(() => {
        localStorage.setItem('chart_hollow', String(chartStyle.isHollow));
        localStorage.setItem('chart_upColor', chartStyle.upColor);
        localStorage.setItem('chart_downColor', chartStyle.downColor);

        if (candleSeriesRef.current) {
            candleSeriesRef.current.applyOptions({
                upColor: chartStyle.isHollow ? (theme === 'light' ? '#ffffff' : '#0f172a') : chartStyle.upColor,
                downColor: chartStyle.isHollow ? (theme === 'light' ? '#ffffff' : '#0f172a') : chartStyle.downColor,
                borderVisible: true,
                borderUpColor: chartStyle.upColor,
                borderDownColor: chartStyle.downColor,
                wickUpColor: chartStyle.upColor,
                wickDownColor: chartStyle.downColor,
            });
        }
    }, [chartStyle, theme]);

    const earliestTimestampRef = useRef<number | null>(null);
    const isFetchingHistoryRef = useRef(false);

    useEffect(() => {
        if (forcedTimeframe) setActiveTimeframe(forcedTimeframe);
    }, [forcedTimeframe]);

    const handleRetry = () => setRetryCount(prev => prev + 1);

    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            setError(null);
            setChartData([]);
            earliestTimestampRef.current = null;

            if (!oandaApiKey) {
                setError("OANDA API Key is missing. Please configure it in Settings.");
                setLoading(false);
                return;
            }

            const entryTime = trade.entryTimestamp || Math.floor(new Date(trade.entryDate).getTime() / 1000);
            const exitTime = trade.exitTimestamp || Math.floor(Date.now() / 1000);
            const duration = exitTime - entryTime;
            const paddingSeconds = Math.max(duration * 0.5, TIMEFRAMES[activeTimeframe] * 200);
            const fromTime = entryTime - paddingSeconds;
            const now = Math.floor(Date.now() / 1000);
            const toTime = Math.min(exitTime + paddingSeconds, now);
            const candleSeconds = TIMEFRAMES[activeTimeframe] || 3600;
            const requestedCandles = (toTime - fromTime) / candleSeconds;
            let finalFromTime = fromTime;
            if (requestedCandles > 4500) finalFromTime = toTime - (4500 * candleSeconds);

            try {
                const granularity = OANDA_TF_MAP[activeTimeframe] || 'H1';
                const realData = await fetchOandaCandles(
                    trade.symbol, granularity, undefined, oandaApiKey, finalFromTime, toTime, oandaEnv, availableInstruments
                );
                if (realData.length === 0) throw new Error(`No data returned for this range.`);
                if (realData.length > 0) earliestTimestampRef.current = realData[0].time as number;
                setChartData(realData);
            } catch (err: any) {
                console.error(err);
                setError(err.message || 'Failed to load OANDA data');
                setChartData([]);
            }
            setLoading(false);
        };
        loadData();
    }, [trade.symbol, trade.entryTimestamp, trade.entryDate, trade.exitTimestamp, activeTimeframe, oandaApiKey, oandaEnv, retryCount, availableInstruments]);

    const loadMoreHistory = async () => {
        if (isFetchingHistoryRef.current || !earliestTimestampRef.current || !oandaApiKey) return;
        isFetchingHistoryRef.current = true;
        setIsLoadingHistory(true);
        try {
            const granularity = OANDA_TF_MAP[activeTimeframe] || 'H1';
            const toTime = earliestTimestampRef.current;
            const newCandles = await fetchOandaCandles(trade.symbol, granularity, 500, oandaApiKey, undefined, toTime, oandaEnv, availableInstruments);
            if (newCandles.length > 0) {
                const filteredNew = newCandles.filter(c => (c.time as number) < toTime);
                if (filteredNew.length > 0) {
                    earliestTimestampRef.current = filteredNew[0].time as number;
                    setChartData(prev => [...filteredNew, ...prev]);
                }
            }
        } catch (e) {
            console.warn("Failed to load history", e);
        } finally {
            isFetchingHistoryRef.current = false;
            setIsLoadingHistory(false);
        }
    };

    useEffect(() => {
        if (!chartContainerRef.current || chartData.length === 0) return;
        const formattedData: CandlestickData<Time>[] = chartData.map(d => ({
            time: d.time as Time, open: d.open, high: d.high, low: d.low, close: d.close
        }));

        if (chartRef.current) {
            if (candleSeriesRef.current) {
                candleSeriesRef.current.setData(formattedData);
                return;
            }
        }

        const chart = createChart(chartContainerRef.current, {
            layout: {
                background: { type: ColorType.Solid, color: theme === 'light' ? '#ffffff' : '#0f172a' },
                textColor: theme === 'light' ? '#334155' : '#94a3b8',
                fontSize: 10
            },
            grid: {
                vertLines: { color: theme === 'light' ? '#e2e8f0' : '#1e293b' },
                horzLines: { color: theme === 'light' ? '#e2e8f0' : '#1e293b' }
            },
            width: chartContainerRef.current.clientWidth,
            height: chartContainerRef.current.clientHeight,
            crosshair: { mode: CrosshairMode.Normal },
            rightPriceScale: { borderColor: theme === 'light' ? '#cbd5e1' : '#334155', minimumWidth: 48 },
            timeScale: {
                borderColor: theme === 'light' ? '#cbd5e1' : '#334155', timeVisible: true, secondsVisible: false,
                tickMarkFormatter: (time: number) => {
                    try {
                        const date = new Date(time * 1000);
                        return new Intl.DateTimeFormat(undefined, {
                            timeZone: timezone, hour: '2-digit', minute: '2-digit', hour12: false, month: 'short', day: 'numeric'
                        }).format(date);
                    } catch (e) { return String(time); }
                }
            },
            localization: {
                timeFormatter: (time: number) => {
                    try {
                        const date = new Date(time * 1000);
                        return new Intl.DateTimeFormat(undefined, {
                            timeZone: timezone, hour: '2-digit', minute: '2-digit', hour12: false, month: 'short', day: 'numeric'
                        }).format(date);
                    } catch (e) { return String(time); }
                },
            },
        });

        chartRef.current = chart;
        const candleSeries = chart.addSeries(CandlestickSeries, {
            upColor: chartStyle.isHollow ? (theme === 'light' ? '#ffffff' : '#0f172a') : chartStyle.upColor,
            downColor: chartStyle.isHollow ? (theme === 'light' ? '#ffffff' : '#0f172a') : chartStyle.downColor,
            borderVisible: true, wickUpColor: chartStyle.upColor, wickDownColor: chartStyle.downColor,
            borderUpColor: chartStyle.upColor, borderDownColor: chartStyle.downColor,
            priceFormat: { type: 'price', precision: 3, minMove: 0.001 }
        });

        candleSeriesRef.current = candleSeries;
        candleSeries.setData(formattedData);

        markersPrimitiveRef.current = new TradeMarkersPrimitive();
        markersPrimitiveRef.current.setData(trade, chartData, fetchingInitialSL);
        (candleSeries as any).attachPrimitive(markersPrimitiveRef.current);

        if (formattedData.length > 0) {
            const exitTime = trade.exitTimestamp || trade.entryTimestamp || 0;
            let targetIndex = formattedData.findIndex(d => (d.time as number) >= exitTime);
            if (targetIndex === -1) {
                if (trade.entryTimestamp) targetIndex = formattedData.findIndex(d => (d.time as number) >= trade.entryTimestamp!);
                if (targetIndex === -1) targetIndex = formattedData.length - 1;
            }
            const visibleCount = 200;
            const rightBuffer = 25;
            const to = targetIndex + rightBuffer;
            const from = to - visibleCount;
            chart.timeScale().setVisibleLogicalRange({ from, to });
        }

        chart.timeScale().subscribeVisibleLogicalRangeChange((newVisibleLogicalRange) => {
            if (!newVisibleLogicalRange) return;
            if (newVisibleLogicalRange.from < 10) loadMoreHistory();
        });

        chart.subscribeCrosshairMove((param: MouseEventParams) => {
            if (markersPrimitiveRef.current && param.point) markersPrimitiveRef.current.setMousePos(param.point);
            else if (markersPrimitiveRef.current) markersPrimitiveRef.current.setMousePos(null);
        });

        const handleResize = () => {
            if (chartContainerRef.current && chartRef.current) chartRef.current.applyOptions({ width: chartContainerRef.current.clientWidth });
        };
        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            if (chartRef.current) {
                chartRef.current.remove(); chartRef.current = null;
                candleSeriesRef.current = null; markersPrimitiveRef.current = null;
                smaSeriesRef.current = null; emaSeriesRef.current = null; volumeSeriesRef.current = null;
            }
        };
    }, [chartData.length, hideToolbar, timezone, chartStyle]);

    return (
        <div className="flex flex-col bg-slate-900 rounded-lg overflow-hidden border border-slate-700 h-[750px]">
            {!hideToolbar && (
                <div className="flex items-center justify-between px-4 py-2 border-b border-slate-700 bg-slate-800 relative z-30">
                    <div className="flex items-center gap-4">
                        <div className="flex items-baseline gap-2 border-r border-slate-700 pr-4">
                            <div className="font-bold text-white text-lg tracking-tight">{trade.symbol}</div>
                            <span className="text-[9px] text-[#557C68] font-bold tracking-wide">by OANDA</span>
                            {isLoadingHistory && <span className="ml-2 text-[10px] text-blue-400 flex items-center gap-1"><RefreshCw size={10} className="animate-spin" /> Loading History...</span>}
                            {error && <span className="ml-2 text-[10px] text-rose-400 flex items-center gap-1" title={error}><AlertCircle size={12} /> Error</span>}
                        </div>
                        <div className="flex items-center gap-0.5">
                            {!forcedTimeframe && Object.keys(TIMEFRAMES).map((tf) => (
                                <button key={tf} onClick={() => setActiveTimeframe(tf)} className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${activeTimeframe === tf ? 'text-blue-400 bg-slate-700' : 'text-slate-400 hover:text-white hover:bg-slate-700/50'}`}>{tf}</button>
                            ))}
                            {forcedTimeframe && <span className="text-xs font-bold text-blue-400 bg-blue-500/10 px-2 py-1 rounded border border-blue-500/20">{forcedTimeframe} (Fixed)</span>}
                        </div>
                    </div>
                    <div className="flex items-center gap-2">

                        {/* Indicators Menu */}
                        <div className="relative" ref={indicatorsRef}>
                            <button onClick={() => { setIsIndicatorsMenuOpen(!isIndicatorsMenuOpen); setIsStyleMenuOpen(false); }} className={`flex items-center gap-1.5 px-3 py-1.5 rounded transition-colors text-xs font-medium border ${isIndicatorsMenuOpen ? 'bg-slate-700 text-white border-slate-600' : 'text-slate-400 border-transparent hover:text-white hover:bg-slate-700'}`} title="Indicators"><Activity size={14} /><span>Indicators</span></button>
                            {isIndicatorsMenuOpen && (
                                <div className="absolute right-0 top-full mt-2 w-52 bg-slate-800 border border-slate-700 rounded-xl shadow-xl z-50 overflow-hidden">
                                    <div className="p-1">
                                        <div className="flex items-center justify-between px-3 h-8 text-xs text-slate-300 hover:bg-slate-700 rounded transition-colors group">
                                            <div className="flex items-center gap-2 flex-1 cursor-pointer" onClick={() => toggleIndicator('sma')}><TrendingUp size={14} /> SMA</div>
                                            <div className="flex items-center gap-2">
                                                {indicators.sma && <input type="number" value={indicators.smaPeriod} onChange={(e) => handlePeriodChange('smaPeriod', e.target.value)} onClick={(e) => e.stopPropagation()} className="w-10 h-6 bg-slate-900 border border-slate-600 rounded px-1 text-right text-xs focus:ring-1 focus:ring-blue-500 outline-none" />}
                                                <div onClick={() => toggleIndicator('sma')} className={`w-3 h-3 rounded border flex items-center justify-center cursor-pointer ${indicators.sma ? 'bg-blue-600 border-blue-600' : 'border-slate-500'}`}>{indicators.sma && <div className="w-1.5 h-1.5 bg-white rounded-full" />}</div>
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between px-3 h-8 text-xs text-slate-300 hover:bg-slate-700 rounded transition-colors group">
                                            <div className="flex items-center gap-2 flex-1 cursor-pointer" onClick={() => toggleIndicator('ema')}><TrendingUp size={14} /> EMA</div>
                                            <div className="flex items-center gap-2">
                                                {indicators.ema && <input type="number" value={indicators.emaPeriod} onChange={(e) => handlePeriodChange('emaPeriod', e.target.value)} onClick={(e) => e.stopPropagation()} className="w-10 h-6 bg-slate-900 border border-slate-600 rounded px-1 text-right text-xs focus:ring-1 focus:ring-blue-500 outline-none" />}
                                                <div onClick={() => toggleIndicator('ema')} className={`w-3 h-3 rounded border flex items-center justify-center cursor-pointer ${indicators.ema ? 'bg-blue-600 border-blue-600' : 'border-slate-500'}`}>{indicators.ema && <div className="w-1.5 h-1.5 bg-white rounded-full" />}</div>
                                            </div>
                                        </div>
                                        <button onClick={() => toggleIndicator('volume')} className="w-full flex items-center justify-between px-3 h-8 text-xs text-slate-300 hover:bg-slate-700 rounded transition-colors">
                                            <div className="flex items-center gap-2"><Activity size={14} /> Volume</div>
                                            <div className={`w-3 h-3 rounded border flex items-center justify-center ${indicators.volume ? 'bg-blue-600 border-blue-600' : 'border-slate-500'}`}>{indicators.volume && <div className="w-1.5 h-1.5 bg-white rounded-full" />}</div>
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="relative" ref={styleRef}>
                            <button onClick={() => { setIsStyleMenuOpen(!isStyleMenuOpen); setIsIndicatorsMenuOpen(false); }} className={`p-1.5 rounded transition-colors ${isStyleMenuOpen ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-700'}`} title="Chart Settings"><Settings size={16} /></button>
                            {isStyleMenuOpen && (
                                <div className="absolute right-0 top-full mt-2 w-56 bg-slate-800 border border-slate-700 rounded-xl shadow-xl z-50 overflow-hidden">
                                    <div className="p-3 space-y-3">
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm text-slate-300">Hollow Candles</span>
                                            <button onClick={() => setChartStyle(prev => ({ ...prev, isHollow: !prev.isHollow }))} className={`w-9 h-5 rounded-full relative transition-colors ${chartStyle.isHollow ? 'bg-blue-600' : 'bg-slate-600'}`}><span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${chartStyle.isHollow ? 'translate-x-4' : 'translate-x-0'}`} /></button>
                                        </div>
                                        <div>
                                            <label className="text-xs text-slate-500 font-bold uppercase mb-1 block">Up Color</label>
                                            <div className="flex items-center gap-2">
                                                <input type="color" value={chartStyle.upColor} onChange={(e) => setChartStyle(prev => ({ ...prev, upColor: e.target.value }))} className="w-8 h-8 rounded cursor-pointer bg-transparent border-none" /><span className="text-xs font-mono text-slate-400">{chartStyle.upColor}</span>
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-xs text-slate-500 font-bold uppercase mb-1 block">Down Color</label>
                                            <div className="flex items-center gap-2">
                                                <input type="color" value={chartStyle.downColor} onChange={(e) => setChartStyle(prev => ({ ...prev, downColor: e.target.value }))} className="w-8 h-8 rounded cursor-pointer bg-transparent border-none" /><span className="text-xs font-mono text-slate-400">{chartStyle.downColor}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {hideToolbar && (
                <div className="px-3 py-1 bg-slate-800 border-b border-slate-700 flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-300">{activeTimeframe} Chart</span>
                    {loading && <RefreshCw size={10} className="text-blue-500 animate-spin" />}
                </div>
            )}

            <div className="relative flex-1 group w-full bg-slate-900 overflow-hidden">
                {(error || !chartData.length) && !loading && (
                    <div className="absolute inset-0 flex items-center justify-center text-rose-400 text-sm bg-slate-900 z-10 flex-col gap-3 p-4 text-center">
                        <AlertCircle size={32} className="mb-1 opacity-80" />
                        <div className="font-semibold text-rose-300">Data Fetch Failed</div>
                        <div className="text-xs text-slate-500 max-w-sm px-4">
                            {error || "No data found for this range. Try a higher timeframe (e.g. 4H or Daily)."}
                        </div>
                        <div className="flex items-center gap-3 mt-2">
                            <button onClick={handleRetry} className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white px-3 py-1.5 rounded-lg border border-slate-600 transition-colors text-xs font-medium"><RefreshCw size={12} /> Retry</button>
                            {onSettingsClick && <button onClick={onSettingsClick} className="flex items-center gap-2 bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 px-3 py-1.5 rounded-lg border border-blue-500/30 transition-colors text-xs font-medium"><Settings size={12} /> Settings</button>}
                        </div>
                    </div>
                )}
                {loading && !chartData.length && <div className="absolute inset-0 flex items-center justify-center bg-slate-900 z-10"><div className="flex flex-col items-center gap-2"><RefreshCw size={24} className="text-blue-500 animate-spin" /><span className="text-xs text-slate-500">Fetching OANDA data...</span></div></div>}
                <div ref={chartContainerRef} className="w-full h-full relative z-0" />
            </div>
        </div>
    );
};
