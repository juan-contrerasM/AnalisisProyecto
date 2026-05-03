package com.uniquindio.etl.service;

import com.uniquindio.etl.model.StockData;
import com.uniquindio.etl.model.ReturnSeriesResponse;

import java.util.List;
import java.util.Map;

public interface ETLService {

    void runETL();

    Map<String, Object> getEtlStatus();

    List<String> getSymbols();

    List<Map<String, Object>> getDatasetRows();

    Map<String, Object> obtenerAnalisis();

    Map<String, Object> calcularSimilitud(String asset1, String asset2);

    ReturnSeriesResponse obtenerSeries(String asset1, String asset2);

    boolean isEtlReady();

    List<StockData> retrieveVolumeAsc();

    /** Matriz de correlación de Pearson entre retornos diarios (pares alineados por fecha). */
    Map<String, Object> obtenerMatrizCorrelacion();

    /**
     * OHLC diario con media móvil simple del cierre ({@code window} períodos), últimos {@code limit} días con datos completos.
     */
    Map<String, Object> obtenerOhlcConSma(String symbol, int window, int limit);
}
