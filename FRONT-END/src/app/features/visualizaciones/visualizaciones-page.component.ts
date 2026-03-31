import {
  BarController,
  BarElement,
  Chart,
  Legend,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  TimeSeriesScale,
  Tooltip,
  type TooltipItem,
} from 'chart.js';
import { CandlestickController, CandlestickElement } from 'chartjs-chart-financial';
import { parseISO } from 'date-fns';
import 'chartjs-adapter-date-fns';

import { DecimalPipe, NgStyle } from '@angular/common';
import {
  Component,
  DestroyRef,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
  ElementRef,
} from '@angular/core';
import { AppStatusService } from '../../core/services/app-status.service';
import { EtlApiService } from '../../core/services/etl-api.service';
import { TechnicalReportPdfService } from '../../core/services/technical-report-pdf.service';
import { CandlestickPoint } from '../../shared/models/etl.models';
import { PageSkeletonComponent } from '../../shared/ui/page-skeleton.component';

let financialChartRegistered = false;

function registerFinancialChart(): void {
  if (financialChartRegistered) {
    return;
  }
  Chart.register(
    TimeSeriesScale,
    LinearScale,
    BarController,
    BarElement,
    Tooltip,
    Legend,
    CandlestickController,
    CandlestickElement,
    LineController,
    LineElement,
    PointElement,
  );
  financialChartRegistered = true;
}

function toChartTime(dateStr: string): number | null {
  const d = parseISO(dateStr);
  const ms = d.getTime();
  return Number.isFinite(ms) ? ms : null;
}

/** Unidades del eje temporal (Chart.js time scale / timeseries). */
type ChartTimeUnit =
  | 'millisecond'
  | 'second'
  | 'minute'
  | 'hour'
  | 'day'
  | 'week'
  | 'month'
  | 'year';

function timeScaleOptions(unit: ChartTimeUnit) {
  return {
    unit,
    displayFormats: {
      millisecond: 'HH:mm:ss.SSS',
      second: 'HH:mm:ss',
      minute: 'd MMM, HH:mm',
      hour: 'd MMM, HH:mm',
      day: 'd MMM yy',
      week: 'd MMM yy',
      month: 'MMM yyyy',
      year: 'yyyy',
    },
  };
}

@Component({
  selector: 'app-visualizaciones-page',
  imports: [PageSkeletonComponent, DecimalPipe, NgStyle],
  templateUrl: './visualizaciones-page.component.html',
  styleUrl: './visualizaciones-page.component.css',
})
export class VisualizacionesPageComponent {
  private readonly api = inject(EtlApiService);
  private readonly pdf = inject(TechnicalReportPdfService);
  protected readonly status = inject(AppStatusService);

  private readonly candleCanvas = viewChild<ElementRef<HTMLCanvasElement>>('candleCanvas');
  private readonly smaCanvas = viewChild<ElementRef<HTMLCanvasElement>>('smaCanvas');

  protected readonly candleSymbol = signal('');
  protected readonly smaWindow = signal(20);
  protected readonly candlePoints = signal<CandlestickPoint[]>([]);
  protected readonly candleLoading = signal(false);
  protected readonly candleError = signal<string | null>(null);
  /** Unidad de las marcas del eje X (datos EOD: hora/min/seg/ms suelen coincidir en medianoche). */
  protected readonly timeScaleUnit = signal<ChartTimeUnit>('day');

  protected readonly timeUnitChoices: { value: ChartTimeUnit; label: string }[] = [
    { value: 'day', label: 'Días' },
    { value: 'week', label: 'Semanas' },
    { value: 'month', label: 'Meses' },
    { value: 'year', label: 'Años' },
    { value: 'hour', label: 'Horas' },
    { value: 'minute', label: 'Minutos' },
    { value: 'second', label: 'Segundos' },
    { value: 'millisecond', label: 'Milisegundos' },
  ];

  private lastFetchKey = '';
  private candleChart: Chart | null = null;
  private smaLineChart: Chart | null = null;

  constructor() {
    registerFinancialChart();

    const destroyCharts = () => {
      this.candleChart?.destroy();
      this.candleChart = null;
      this.smaLineChart?.destroy();
      this.smaLineChart = null;
    };

    inject(DestroyRef).onDestroy(() => {
      destroyCharts();
    });

    effect(() => {
      const syms = this.status.symbols();
      if (syms.length === 0) {
        return;
      }
      const cur = this.candleSymbol();
      if (!cur || !syms.includes(cur)) {
        untracked(() => this.candleSymbol.set(syms.includes('AAPL') ? 'AAPL' : syms[0]));
      }
    });

    effect(() => {
      const ready = this.status.dataReady();
      const st = this.status.etlStatus();
      const syms = this.status.symbols();
      const sym = this.candleSymbol();
      const win = this.smaWindow();
      if (!ready || !st?.etlEjecutado || syms.length === 0 || !sym || !syms.includes(sym)) {
        return;
      }
      const ver = st.dataVersion ?? 0;
      const key = `${ver}|${sym}|${win}`;
      if (key === this.lastFetchKey) {
        return;
      }
      untracked(() => {
        this.lastFetchKey = key;
        this.loadCandles(sym, win);
      });
    });

    /**
     * Gráficos separados: chartjs-chart-financial + línea en el mismo canvas suele fallar (datasets mixtos).
     * Tras CD y layout, instanciamos velas y SMA en dos canvas.
     */
    effect((onCleanup) => {
      const pts = this.candlePoints();
      const loading = this.candleLoading();
      const unitForChart = this.timeScaleUnit();

      destroyCharts();

      if (loading || pts.length === 0) {
        return;
      }

      const scheduled = window.setTimeout(() => {
        const cEl = this.candleCanvas()?.nativeElement;
        const sEl = this.smaCanvas()?.nativeElement;
        const p = this.candlePoints();
        const w = this.smaWindow();
        if (!cEl || !sEl || p.length === 0 || this.candleLoading()) {
          return;
        }
        untracked(() => {
          destroyCharts();
          this.buildCandlestickChart(cEl, p, unitForChart);
          this.buildSmaLineChart(sEl, p, w, unitForChart);
          requestAnimationFrame(() => {
            this.candleChart?.resize();
            this.smaLineChart?.resize();
          });
        });
      }, 0);

      onCleanup(() => {
        window.clearTimeout(scheduled);
        destroyCharts();
      });
    });
  }

  protected corrCellStyle(v: number): Record<string, string> {
    const c = Math.max(-1, Math.min(1, v));
    const t = (c + 1) / 2;
    const r = Math.round(50 + 205 * (1 - t));
    const g = Math.round(40 + 180 * t);
    const b = Math.round(70 + 100 * (1 - Math.abs(c)));
    const light = t > 0.35 && t < 0.65;
    return {
      background: `rgb(${r},${g},${b})`,
      color: light ? '#0f172a' : '#f8fafc',
    };
  }

  protected downloadPdf(): void {
    if (!this.status.dataReady()) {
      return;
    }
    this.pdf.downloadTechnicalReport();
  }

  protected onCandleSymbolChange(value: string): void {
    this.candleSymbol.set(value);
    this.lastFetchKey = '';
  }

  protected onSmaWindowChange(raw: string): void {
    const n = Number.parseInt(raw, 10);
    this.smaWindow.set(Number.isFinite(n) && n >= 5 && n <= 120 ? n : 20);
    this.lastFetchKey = '';
  }

  protected onTimeUnitChange(value: string): void {
    if (
      value === 'millisecond' ||
      value === 'second' ||
      value === 'minute' ||
      value === 'hour' ||
      value === 'day' ||
      value === 'week' ||
      value === 'month' ||
      value === 'year'
    ) {
      this.timeScaleUnit.set(value);
    }
  }

  protected reloadCandles(): void {
    this.lastFetchKey = '';
    const sym = this.candleSymbol();
    const win = this.smaWindow();
    if (sym) {
      this.loadCandles(sym, win);
    }
  }

  private loadCandles(symbol: string, window: number): void {
    this.candleLoading.set(true);
    this.candleError.set(null);
    this.api.getCandlestick(symbol, window, 320).subscribe({
      next: (res) => {
        this.candlePoints.set(res.points ?? []);
        this.candleLoading.set(false);
      },
      error: (e: { error?: { message?: string } }) => {
        this.candleError.set(e?.error?.message ?? 'No se pudieron cargar OHLC/SMA');
        this.candlePoints.set([]);
        this.candleLoading.set(false);
      },
    });
  }

  private buildCandlestickChart(
    canvas: HTMLCanvasElement,
    pts: CandlestickPoint[],
    timeUnit: ChartTimeUnit,
  ): void {
    registerFinancialChart();

    const candleData = pts
      .map((p) => {
        const x = toChartTime(String(p.date));
        if (x === null) {
          return null;
        }
        return { x, o: Number(p.open), h: Number(p.high), l: Number(p.low), c: Number(p.close) };
      })
      .filter((d): d is { x: number; o: number; h: number; l: number; c: number } => d !== null);

    if (candleData.length === 0) {
      return;
    }

    this.candleChart = new Chart(
      canvas,
      {
        type: 'candlestick',
        data: {
          datasets: [
            {
              type: 'candlestick',
              label: 'OHLC (diario)',
              data: candleData,
              borderColors: {
                up: 'rgb(248, 113, 113)',
                down: 'rgb(52, 211, 153)',
                unchanged: 'rgb(148, 163, 184)',
              },
              backgroundColors: {
                up: 'rgba(248, 113, 113, 0.45)',
                down: 'rgba(52, 211, 153, 0.45)',
                unchanged: 'rgba(148, 163, 184, 0.35)',
              },
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: { duration: 400 },
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: { labels: { color: '#9fb0c3', boxWidth: 12 } },
            tooltip: {
              backgroundColor: 'rgba(15, 23, 42, 0.92)',
              titleColor: '#e2e8f0',
              bodyColor: '#cbd5e1',
              borderColor: 'rgba(56, 189, 248, 0.35)',
              borderWidth: 1,
              callbacks: {
                title: (items: TooltipItem<'candlestick'>[]) => {
                  const raw = items[0]?.raw as { x?: number } | undefined;
                  const x = raw?.x;
                  if (x == null || typeof x !== 'number') {
                    return '';
                  }
                  const d = new Date(x);
                  if (
                    timeUnit === 'day' ||
                    timeUnit === 'week' ||
                    timeUnit === 'month' ||
                    timeUnit === 'year'
                  ) {
                    return d.toLocaleDateString(undefined, {
                      weekday: 'short',
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    });
                  }
                  return d.toLocaleString(undefined, {
                    dateStyle: 'medium',
                    timeStyle: 'medium',
                  });
                },
              },
            },
          },
          scales: {
            x: {
              type: 'timeseries',
              offset: true,
              time: timeScaleOptions(timeUnit),
              ticks: {
                color: '#7d8ea3',
                maxRotation: 45,
                autoSkip: true,
                maxTicksLimit: timeUnit === 'year' ? 24 : timeUnit === 'month' ? 36 : 48,
              },
              grid: { color: 'rgba(148,163,184,0.12)' },
            },
            y: {
              ticks: { color: '#7d8ea3' },
              grid: { color: 'rgba(148,163,184,0.12)' },
            },
          },
        },
      } as never,
    );
  }

  private buildSmaLineChart(
    canvas: HTMLCanvasElement,
    pts: CandlestickPoint[],
    win: number,
    timeUnit: ChartTimeUnit,
  ): void {
    const lineData = pts
      .map((p) => {
        if (p.sma == null) {
          return null;
        }
        const x = toChartTime(String(p.date));
        if (x === null) {
          return null;
        }
        return { x, y: Number(p.sma) };
      })
      .filter((d): d is { x: number; y: number } => d !== null);

    if (lineData.length === 0) {
      return;
    }

    this.smaLineChart = new Chart(canvas, {
      type: 'line',
      data: {
        datasets: [
          {
            label: `SMA (${win}) cierre`,
            data: lineData,
            parsing: false,
            borderColor: 'rgba(251, 191, 36, 0.95)',
            backgroundColor: 'transparent',
            pointRadius: 0,
            borderWidth: 2,
            tension: 0.2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 400 },
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { labels: { color: '#9fb0c3', boxWidth: 12 } },
          tooltip: {
            backgroundColor: 'rgba(15, 23, 42, 0.92)',
            titleColor: '#e2e8f0',
            bodyColor: '#cbd5e1',
          },
        },
        scales: {
          x: {
            type: 'timeseries',
            offset: true,
            display: false,
            time: timeScaleOptions(timeUnit),
            grid: { display: false },
          },
          y: {
            ticks: { color: '#7d8ea3' },
            grid: { color: 'rgba(148,163,184,0.12)' },
          },
        },
      },
    });
  }
}
