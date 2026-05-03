import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, of, throwError } from 'rxjs';
import { apiBaseUrl } from '../config/app-config';
import {
  AnalysisResponse,
  AssetVolumeDay,
  CandlestickResponse,
  CorrelationMatrixResponse,
  DatasetRow,
  EtlStatusResponse,
  ReturnSeriesResponse,
  SimilarityResult,
  SortingResultData,
} from '../../shared/models/etl.models';

@Injectable({ providedIn: 'root' })
export class EtlApiService {
  private readonly http = inject(HttpClient);
  private readonly base = apiBaseUrl() ? `${apiBaseUrl()}/etl` : '/etl';

  getStatus(): Observable<EtlStatusResponse> {
    return this.http.get<EtlStatusResponse>(`${this.base}/status`);
  }

  runEtl(): Observable<string> {
    return this.http.get(`${this.base}/run`, { responseType: 'text' });
  }

  getSymbols(): Observable<string[]> {
    return this.http.get<string[]>(`${this.base}/symbols`);
  }

  getDataset(): Observable<DatasetRow[]> {
    return this.http.get<DatasetRow[]>(`${this.base}/dataset`).pipe(
      catchError((e: HttpErrorResponse) => {
        if (e.status === 503) {
          return of([]);
        }
        return throwError(() => e);
      }),
    );
  }

  getAnalysis(): Observable<AnalysisResponse | null> {
    return this.http.get<AnalysisResponse>(`${this.base}/analysis`).pipe(
      catchError((e: HttpErrorResponse) => {
        if (e.status === 503) {
          return of(null);
        }
        return throwError(() => e);
      }),
    );
  }

  getCorrelationMatrix(): Observable<CorrelationMatrixResponse | null> {
    return this.http.get<CorrelationMatrixResponse>(`${this.base}/correlation-matrix`).pipe(
      catchError((e: HttpErrorResponse) => {
        if (e.status === 503) {
          return of(null);
        }
        return throwError(() => e);
      }),
    );
  }

  getCandlestick(symbol: string, window = 20, limit = 120): Observable<CandlestickResponse> {
    return this.http.get<CandlestickResponse>(`${this.base}/candlestick`, {
      params: { symbol, window: String(window), limit: String(limit) },
    });
  }

  getSimilarity(asset1: string, asset2: string): Observable<SimilarityResult> {
    return this.http.get<SimilarityResult>(`${this.base}/similarity`, {
      params: { asset1, asset2 },
    });
  }

  getSeries(asset1: string, asset2: string): Observable<ReturnSeriesResponse> {
    return this.http.get<ReturnSeriesResponse>(`${this.base}/series`, {
      params: { asset1, asset2 },
    });
  }

  getTableSort(size = 8192): Observable<SortingResultData[]> {
    return this.http.get<SortingResultData[]>(`${this.base}/getTableSort`, {
      params: { size: String(size) },
    });
  }

  /** Top 15 días con mayor volumen (backend ya limita a 15 y retorna en orden descendente). */
  getVolumenAsc(): Observable<AssetVolumeDay[]> {
    return this.http.get<AssetVolumeDay[]>(`${this.base}/getVolumenAsc`);
  }
}
