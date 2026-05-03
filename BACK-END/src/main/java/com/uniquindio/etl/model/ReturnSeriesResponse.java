package com.uniquindio.etl.model;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public class ReturnSeriesResponse {
    private final List<String> dates;
    private final Map<String, List<Double>> series;

    public ReturnSeriesResponse(List<String> dates, Map<String, List<Double>> series) {
        this.dates = dates;
        this.series = series;
    }

    public List<String> getDates() {
        return dates;
    }

    public Map<String, List<Double>> getSeries() {
        return series;
    }

    public static ReturnSeriesResponse of(String asset1, List<Double> s1, String asset2, List<Double> s2, List<String> dates) {
        Map<String, List<Double>> m = new LinkedHashMap<>();
        m.put(asset1, s1);
        m.put(asset2, s2);
        return new ReturnSeriesResponse(dates, m);
    }
}

