export type EtlEstado = 'IDLE' | 'EJECUTANDO' | 'LISTO' | 'ERROR';

export interface EtlStatusResponse {
  etlEjecutado: boolean;
  ultimaActualizacion: string | null;
  estado: EtlEstado;
  dataVersion: number;
  mensajeError?: string;
}

export type DatasetRow = Record<string, string | number>;

export interface PatronesActivo {
  subida3: number;
  bajada3: number;
  altaVolatilidad: number;
}

export interface RankingActivo {
  activo: string;
  /** Desviación estándar de retornos diarios (dispersión). */
  desviacionDiaria?: number;
  volatilidad: number;
  riesgo: string;
  patrones: PatronesActivo;
}

export interface AnalysisResponse {
  ranking: RankingActivo[];
}

/** Respuesta de `GET /etl/correlation-matrix` (Pearson sobre retornos alineados). */
export interface CorrelationMatrixResponse {
  symbols: string[];
  matrix: number[][];
}

export interface CandlestickPoint {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  sma: number | null;
}

export interface CandlestickResponse {
  symbol: string;
  window: number;
  limit: number;
  points: CandlestickPoint[];
}

export interface SimilarityResult {
  euclidiana: number;
  pearson: number;
  coseno: number;
  dtw: number;
  interpretacion: string;
  /** Observaciones alineadas usadas en el cálculo (si el backend lo envía). */
  puntosAlineados?: number;
}

export interface ReturnSeriesResponse {
  dates: string[];
  series: Record<string, number[]>;
}

export interface EtlNotReadyBody {
  error: string;
  message: string;
}

export type SyncState = 'idle' | 'polling' | 'refreshing' | 'error';

/** Resultado de benchmark de ordenamiento (`GET /etl/getTableSort`). */
export interface SortingResultData {
  algorithm: string;
  size: number;
  time: number;
}

/** Día con datos OHLCV para ranking de volumen negociado. */
export interface AssetVolumeDay {
  id: number | null;
  symbol: string;
  date: string;
  open: number;
  close: number;
  high: number;
  low: number;
  volume: number;
}
