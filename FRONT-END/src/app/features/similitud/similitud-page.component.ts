import { Component, computed, effect, inject, signal } from '@angular/core';
import { ChartConfiguration, ChartDataset, ChartOptions } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';
import { AppStatusService } from '../../core/services/app-status.service';
import { EtlApiService } from '../../core/services/etl-api.service';
import { ReturnSeriesResponse, SimilarityResult } from '../../shared/models/etl.models';
import { PageSkeletonComponent } from '../../shared/ui/page-skeleton.component';

@Component({
  selector: 'app-similitud-page',
  imports: [BaseChartDirective, PageSkeletonComponent],
  templateUrl: './similitud-page.component.html',
  styleUrl: './similitud-page.component.css',
})
export class SimilitudPageComponent {
  private readonly api = inject(EtlApiService);
  protected readonly status = inject(AppStatusService);

  protected readonly asset1 = signal('');
  protected readonly asset2 = signal('');
  protected readonly dateFrom = signal<string>('');
  protected readonly dateTo = signal<string>('');
  protected readonly result = signal<SimilarityResult | null>(null);
  protected readonly seriesChart = signal<ChartConfiguration<'line'> | null>(null);
  protected readonly loading = signal(false);
  protected readonly seriesLoading = signal(false);
  protected readonly error = signal<string | null>(null);

  /**
   * `labels` + `datasets` + `options` por separado (más fiable con ng2-charts que `data` anidado).
   */
  protected readonly similarityBarChart = computed(() => {
    const r = this.result();
    if (!r) return null;

    const pear = Number(r.pearson);
    const cos = Number(r.coseno);
    const euc = Number(r.euclidiana);
    const dtw = Number(r.dtw);
    if (![pear, cos, euc, dtw].every((x) => Number.isFinite(x))) {
      return null;
    }

    const pearN = Math.max(0, Math.min(100, ((pear + 1) / 2) * 100));
    const cosN = Math.max(0, Math.min(100, cos * 100));
    const eucN = Math.max(0, Math.min(100, euc * 15));
    const dtwN = Math.max(0, Math.min(100, dtw * 7));
    const pre = [pearN, cosN, eucN, dtwN];
    const maxPre = Math.max(...pre, 1e-9);
    const barData = pre.map((v) => Number(((v / maxPre) * 100).toFixed(6)));

    const labels = ['Pearson', 'Coseno', 'Euclidiana', 'DTW'];
    const rawVals = [pear, cos, euc, dtw];

    const datasets: ChartDataset<'bar'>[] = [
      {
        label: 'Relativo al máximo (forma)',
        data: barData,
        backgroundColor: [
          'rgba(56, 189, 248, 0.55)',
          'rgba(52, 211, 153, 0.55)',
          'rgba(251, 191, 36, 0.55)',
          'rgba(192, 132, 252, 0.7)',
        ],
        borderColor: [
          'rgb(56, 189, 248)',
          'rgb(52, 211, 153)',
          'rgb(251, 191, 36)',
          'rgb(192, 132, 252)',
        ],
        borderWidth: 1,
        borderSkipped: false,
        minBarLength: 6,
      },
    ];

    const options: ChartOptions<'bar'> = {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 400 },
      plugins: {
        legend: { labels: { color: '#9fb0c3' } },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const i = ctx.dataIndex ?? 0;
              return `${labels[i]}: ${rawVals[i].toFixed(4)}`;
            },
          },
        },
      },
      scales: {
        x: { ticks: { color: '#7d8ea3' }, grid: { color: 'rgba(148,163,184,0.12)' } },
        y: {
          beginAtZero: true,
          ticks: { color: '#7d8ea3' },
          grid: { color: 'rgba(148,163,184,0.12)' },
          max: 100,
        },
      },
    };

    return { labels, datasets, options };
  });

  constructor() {
    effect(() => {
      const syms = this.status.symbols();
      if (syms.length >= 2 && !this.asset1()) {
        this.asset1.set(syms[0]);
        this.asset2.set(syms[1]);
      }
    });

    // Inicializa rango de fechas con el dataset actual (si existe)
    effect(() => {
      const rows = this.status.dataset() as Record<string, unknown>[];
      if (!rows.length) return;
      const dates = rows
        .map((r) => String(r['date'] ?? ''))
        .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
        .sort();
      if (!dates.length) return;
      if (!this.dateFrom()) this.dateFrom.set(dates[0]);
      if (!this.dateTo()) this.dateTo.set(dates[dates.length - 1]);
    });
  }

  protected fmt(n: number): string {
    return n.toFixed(4);
  }

  protected compare(): void {
    const a = this.asset1();
    const b = this.asset2();
    if (!a || !b || a === b) {
      this.error.set('Seleccione dos activos distintos.');
      return;
    }
    this.error.set(null);
    this.loading.set(true);
    this.result.set(null);
    this.seriesChart.set(null);
    this.api.getSimilarity(a, b).subscribe({
      next: (res) => {
        this.result.set(res);
        this.loading.set(false);
      },
      error: (e) => {
        this.error.set(e?.error?.message ?? 'No se pudo calcular similitud (ETL ejecutado?)');
        this.loading.set(false);
      },
    });
  }

  protected loadSeries(): void {
    const a = this.asset1();
    const b = this.asset2();
    if (!a || !b) return;
    this.seriesLoading.set(true);
    this.api.getSeries(a, b).subscribe({
      next: (resp) => {
        const { labels, s1, s2 } = this.filterSeriesByDate(resp, a, b);
        this.seriesChart.set(this.buildSeriesChart(labels, a, s1, b, s2));
        this.seriesLoading.set(false);
      },
      error: () => {
        this.error.set('No se pudieron cargar las series de retornos.');
        this.seriesLoading.set(false);
      },
    });
  }

  private filterSeriesByDate(
    resp: ReturnSeriesResponse,
    asset1: string,
    asset2: string,
  ): { labels: string[]; s1: number[]; s2: number[] } {
    const dates = resp?.dates ?? [];
    const s1All = resp?.series?.[asset1] ?? [];
    const s2All = resp?.series?.[asset2] ?? [];

    const n = Math.min(dates.length, s1All.length, s2All.length);
    const from = this.dateFrom();
    const to = this.dateTo();

    const labels: string[] = [];
    const s1: number[] = [];
    const s2: number[] = [];

    for (let i = 0; i < n; i++) {
      const d = dates[i];
      if (!d) continue;
      if (from && d < from) continue;
      if (to && d > to) continue;
      labels.push(d);
      s1.push(s1All[i]);
      s2.push(s2All[i]);
    }

    if (labels.length < 1) {
      throw new Error('No hay retornos alineados en ese rango.');
    }

    return { labels, s1, s2 };
  }

  private buildSeriesChart(
    labels: string[],
    asset1: string,
    s1: number[],
    asset2: string,
    s2: number[],
  ): ChartConfiguration<'line'> {
    return {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Retornos ' + asset1,
            data: s1,
            borderColor: 'rgba(56, 189, 248, 0.95)',
            backgroundColor: 'rgba(56, 189, 248, 0.1)',
            pointRadius: 0,
            tension: 0.2,
          },
          {
            label: 'Retornos ' + asset2,
            data: s2,
            borderColor: 'rgba(251, 191, 36, 0.95)',
            backgroundColor: 'rgba(251, 191, 36, 0.1)',
            pointRadius: 0,
            tension: 0.2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { labels: { color: '#9fb0c3' } },
          tooltip: {
            callbacks: {
              title: (items) => {
                const i = items?.[0];
                return i?.label ? `Fecha: ${i.label}` : 'Fecha';
              },
              label: (ctx) => {
                const raw = ctx.raw;
                const v = typeof raw === 'number' ? raw : Number(raw);
                const fmt = Number.isFinite(v) ? v.toFixed(6) : String(raw);
                return `${ctx.dataset.label}: ${fmt}`;
              },
            },
          },
        },
        scales: {
          x: {
            ticks: {
              color: '#7d8ea3',
              maxRotation: 0,
              autoSkip: true,
              maxTicksLimit: 10,
            },
            grid: { color: 'rgba(148,163,184,0.12)' },
            title: { display: true, text: 'Fecha', color: '#7d8ea3' },
          },
          y: {
            ticks: { color: '#7d8ea3' },
            grid: { color: 'rgba(148,163,184,0.12)' },
            title: { display: true, text: 'Retorno', color: '#7d8ea3' },
          },
        },
      },
    };
  }
}
