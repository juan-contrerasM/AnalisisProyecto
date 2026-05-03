export const environment = {
  production: false,
  /** Vacío: mismo origen en `ng serve` + proxy hacia Spring (ver proxy.conf.json). */
  apiUrl: '',
  /** Consulta ligera GET /etl/status (detectar EJECUTANDO rápido). */
  statusPollIntervalMs: 3_600_000,
  /** Mínimo entre recargas pesadas dataset + análisis cuando LISTO. */
  autoRefreshIntervalMs: 3_900_000,
};
