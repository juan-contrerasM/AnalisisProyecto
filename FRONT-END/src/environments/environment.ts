export const environment = {
  production: true,
  apiUrl: 'http://localhost:8080',
  // UI: "Estado cada 1h" (GET /etl/status)
  statusPollIntervalMs: 3_600_000,
  // UI: "Datos cada 1h 5m" (recarga pesada cuando servidor está LISTO)
  autoRefreshIntervalMs: 3_900_000,
};
