import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin, of, timer } from 'rxjs';
import { catchError, finalize, switchMap, tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import {
  AnalysisResponse,
  CorrelationMatrixResponse,
  DatasetRow,
  EtlStatusResponse,
  SyncState,
} from '../../shared/models/etl.models';
import { EtlApiService } from './etl-api.service';
import { GlobalErrorService } from './global-error.service';

@Injectable({ providedIn: 'root' })
export class AppStatusService {
  private readonly api = inject(EtlApiService);
  private readonly globalError = inject(GlobalErrorService);

  readonly etlStatus = signal<EtlStatusResponse | null>(null);
  readonly syncState = signal<SyncState>('idle');
  readonly lastPollError = signal<string | null>(null);

  readonly symbols = signal<string[]>([]);
  readonly dataset = signal<DatasetRow[]>([]);
  readonly analysis = signal<AnalysisResponse | null>(null);
  readonly correlationMatrix = signal<CorrelationMatrixResponse | null>(null);

  private refreshLock = false;
  /** Marca de tiempo de la última recarga pesada exitosa (throttle). */
  private lastHeavySuccessAt = 0;

  /** Copia de `ultimaActualizacion` para no perder la hora si el API devuelve null en algún borde. */
  private readonly cachedUltimaActualizacion = signal<string | null>(null);

  private formatInterval(ms: number): string {
    const totalSeconds = Math.round(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const parts: string[] = [];
    if (hours > 0) parts.push(`${hours} h`);
    if (minutes > 0) parts.push(`${minutes} min`);
    if (hours === 0 && minutes === 0) parts.push(`${seconds} s`);
    return parts.join(' ');
  }

  readonly statusPollHint = computed(() => {
    const ms = environment.statusPollIntervalMs ?? 3_600_000;
    return `Estado cada ${this.formatInterval(ms)}`;
  });

  readonly autoRefreshHint = computed(() => {
    const ms = environment.autoRefreshIntervalMs;
    return `Datos cada ${this.formatInterval(ms)}`;
  });

  /**
   * Mientras el ETL corre en el servidor, seguimos mostrando el último dataset/análisis cargado
   * (no ocultar dashboard ni tablas).
   */
  readonly dataReady = computed(() => {
    const st = this.etlStatus();
    if (!st?.etlEjecutado || this.dataset().length === 0) {
      return false;
    }
    return st.estado === 'LISTO' || st.estado === 'EJECUTANDO';
  });

  readonly showingPreviousDataWhileEtl = computed(() => {
    const st = this.etlStatus();
    return st?.estado === 'EJECUTANDO' && this.dataset().length > 0;
  });

  readonly uiStatusLabel = computed(() => {
    const st = this.etlStatus();
    const sync = this.syncState();
    if (st?.estado === 'EJECUTANDO') {
      return 'ETL en ejecución en servidor…';
    }
    if (sync === 'refreshing') {
      return 'Sincronizando datos…';
    }
    if (st?.estado === 'ERROR') {
      return 'Error en ETL';
    }
    if (this.lastPollError()) {
      return 'Error de conexión';
    }
    if (this.dataReady()) {
      return 'Actualizado';
    }
    if (st?.etlEjecutado) {
      return 'Listo (sin datos en caché)';
    }
    return 'ETL no ejecutado';
  });

  readonly lastUpdateDisplay = computed(() => {
    const iso = this.etlStatus()?.ultimaActualizacion ?? this.cachedUltimaActualizacion();
    if (!iso) {
      return '—';
    }
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) {
      return iso;
    }
    return d.toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  });

  loadSymbolsOnly(): void {
    this.api.getSymbols().subscribe({
      next: (s) => this.symbols.set(s),
      error: () => {},
    });
  }

  /**
   * `destroyRef`: del shell (MainLayout).
   * Poll rápido de estado; recarga pesada acotada por `autoRefreshIntervalMs`.
   */
  startPolling(destroyRef: DestroyRef): void {
    const pollMs = environment.statusPollIntervalMs ?? 3_600_000;
    timer(0, pollMs)
      .pipe(
        takeUntilDestroyed(destroyRef),
        tap(() => {
          if (this.syncState() !== 'refreshing' && !this.refreshLock) {
            this.syncState.set('polling');
          }
        }),
        switchMap(() =>
          this.api.getStatus().pipe(
            catchError((err: Error) => {
              this.lastPollError.set(err?.message ?? 'Error al consultar estado');
              this.syncState.set('error');
              return of(null);
            }),
          ),
        ),
      )
      .subscribe((status) => {
        if (!status) {
          return;
        }
        this.lastPollError.set(null);
        this.globalError.clear();
        if (status.ultimaActualizacion) {
          this.cachedUltimaActualizacion.set(status.ultimaActualizacion);
        }
        this.etlStatus.set(status);
        if (this.syncState() === 'error') {
          this.syncState.set('idle');
        }
        this.maybeRefreshHeavyData(status);
        if (status.estado !== 'EJECUTANDO' && this.syncState() === 'polling') {
          this.syncState.set('idle');
        }
      });
  }

  /**
   * Solo con servidor LISTO; respeta intervalo entre cargas pesadas exitosas.
   */
  private maybeRefreshHeavyData(status: EtlStatusResponse): void {
    if (this.refreshLock) {
      return;
    }
    if (status.estado === 'EJECUTANDO') {
      return;
    }
    if (!status.etlEjecutado || status.estado !== 'LISTO') {
      return;
    }
    const now = Date.now();
    const minEvery = environment.autoRefreshIntervalMs ?? 3_900_000;
    if (this.lastHeavySuccessAt > 0 && now - this.lastHeavySuccessAt < minEvery) {
      return;
    }
    this.loadHeavyData().subscribe();
  }

  forceRefreshFromServer(): void {
    this.api
      .getStatus()
      .pipe(
        tap((s) => {
          if (s.ultimaActualizacion) {
            this.cachedUltimaActualizacion.set(s.ultimaActualizacion);
          }
          this.etlStatus.set(s);
        }),
        switchMap((s) => {
          if (s.etlEjecutado && s.estado === 'LISTO') {
            return this.loadHeavyData();
          }
          return of(void 0);
        }),
      )
      .subscribe();
  }

  runEtlFromUi() {
    this.syncState.set('refreshing');
    this.globalError.clear();
    return this.api.runEtl().pipe(
      switchMap(() => this.api.getStatus()),
      tap((s) => {
        if (s.ultimaActualizacion) {
          this.cachedUltimaActualizacion.set(s.ultimaActualizacion);
        }
        this.etlStatus.set(s);
      }),
      switchMap((s) => {
        if (s.etlEjecutado && s.estado === 'LISTO') {
          return this.loadHeavyData();
        }
        return of(void 0);
      }),
      finalize(() => {
        if (this.etlStatus()?.estado !== 'EJECUTANDO') {
          this.syncState.set('idle');
        }
      }),
    );
  }

  private loadHeavyData() {
    if (this.refreshLock) {
      return of(void 0);
    }
    this.refreshLock = true;
    this.syncState.set('refreshing');
    return forkJoin({
      symbols: this.api.getSymbols(),
      dataset: this.api.getDataset(),
      analysis: this.api.getAnalysis(),
      correlation: this.api.getCorrelationMatrix(),
    }).pipe(
      tap(({ symbols, dataset, analysis, correlation }) => {
        this.symbols.set(symbols);
        this.dataset.set(dataset);
        this.analysis.set(analysis);
        this.correlationMatrix.set(correlation);
        this.lastHeavySuccessAt = Date.now();
      }),
      catchError((err: Error) => {
        this.lastPollError.set(err?.message ?? 'Error al cargar datos');
        return of(void 0);
      }),
      finalize(() => {
        this.refreshLock = false;
        const st = this.etlStatus();
        if (st?.estado !== 'EJECUTANDO') {
          this.syncState.set('idle');
        }
      }),
    );
  }
}
