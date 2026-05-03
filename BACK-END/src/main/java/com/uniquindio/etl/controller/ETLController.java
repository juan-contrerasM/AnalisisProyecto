package com.uniquindio.etl.controller;

import com.uniquindio.etl.model.SortingResultData;
import com.uniquindio.etl.model.ReturnSeriesResponse;
import com.uniquindio.etl.service.ETLService;
import com.uniquindio.etl.sorting.SortingBenchmarkService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/etl")
@RequiredArgsConstructor
public class ETLController {

    private final SortingBenchmarkService sortingBenchmarkService;
    private final ETLService etlService;


    private static Map<String, Object> notReadyBody() {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("error", "ETL_NO_LISTO");
        body.put("message", "Ejecute el ETL antes de consultar estos datos.");
        return body;
    }

    @GetMapping("/status")
    public Map<String, Object> status() {
        return etlService.getEtlStatus();
    }

    @GetMapping("/run")
    public String runETL() {
        etlService.runETL();
        return "ETL ejecutado correctamente";
    }

    @GetMapping("/symbols")
    public List<String> symbols() {
        return etlService.getSymbols();
    }

    @GetMapping("/dataset")
    public ResponseEntity<?> dataset() {
        if (!etlService.isEtlReady()) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(notReadyBody());
        }
        return ResponseEntity.ok(etlService.getDatasetRows());
    }

    @GetMapping("/getTableSort")
    public ResponseEntity<?> getTableSort(@RequestParam(defaultValue = "8192") int size) {
        List<SortingResultData> result = sortingBenchmarkService.ejecutarBenchmark(size);
        return ResponseEntity.ok(result);
    }

    @GetMapping("/getVolumenAsc")
    public ResponseEntity<?> getVolumenAsc() {
        return ResponseEntity.ok(etlService.retrieveVolumeAsc());
    }

    @GetMapping("/similarity")
    public ResponseEntity<?> similitud(
            @RequestParam String asset1,
            @RequestParam String asset2) {
        if (!etlService.isEtlReady()) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(notReadyBody());
        }
        try {
            return ResponseEntity.ok(etlService.calcularSimilitud(asset1, asset2));
        } catch (IllegalStateException ex) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(notReadyBody());
        }
    }

    @GetMapping("/series")
    public ResponseEntity<?> getSeries(
            @RequestParam String asset1,
            @RequestParam String asset2) {
        if (!etlService.isEtlReady()) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(notReadyBody());
        }
        try {
            ReturnSeriesResponse resp = etlService.obtenerSeries(asset1, asset2);
            return ResponseEntity.ok(resp);
        } catch (IllegalStateException ex) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(notReadyBody());
        }
    }

    @GetMapping("/analysis")
    public ResponseEntity<?> analizar() {
        if (!etlService.isEtlReady()) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(notReadyBody());
        }
        return ResponseEntity.ok(etlService.obtenerAnalisis());
    }

    @GetMapping("/correlation-matrix")
    public ResponseEntity<?> correlationMatrix() {
        if (!etlService.isEtlReady()) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(notReadyBody());
        }
        return ResponseEntity.ok(etlService.obtenerMatrizCorrelacion());
    }

    @GetMapping("/candlestick")
    public ResponseEntity<?> candlestick(
            @RequestParam String symbol,
            @RequestParam(defaultValue = "20") int window,
            @RequestParam(defaultValue = "120") int limit) {
        if (!etlService.isEtlReady()) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(notReadyBody());
        }
        try {
            return ResponseEntity.ok(etlService.obtenerOhlcConSma(symbol, window, limit));
        } catch (IllegalArgumentException ex) {
            Map<String, Object> body = new LinkedHashMap<>();
            body.put("error", "PARAMETRO_INVALIDO");
            body.put("message", ex.getMessage());
            return ResponseEntity.badRequest().body(body);
        }
    }
}
