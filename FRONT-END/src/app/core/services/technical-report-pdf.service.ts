import { Injectable, inject } from '@angular/core';
import { jsPDF } from 'jspdf';
import { AppStatusService } from './app-status.service';

const COL = {
  ink: [15, 23, 42] as [number, number, number],
  muted: [71, 85, 105] as [number, number, number],
  accent: [14, 165, 233] as [number, number, number],
  accentDark: [12, 74, 110] as [number, number, number],
  band: [241, 245, 249] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
  rowAlt: [248, 250, 252] as [number, number, number],
  border: [226, 232, 240] as [number, number, number],
};

/**
 * PDF con maquetación clara: portada en color, secciones, tablas con cabecera y filas alternas.
 */
@Injectable({ providedIn: 'root' })
export class TechnicalReportPdfService {
  private readonly status = inject(AppStatusService);

  downloadTechnicalReport(): void {
    const analysis = this.status.analysis();
    const corr = this.status.correlationMatrix();
    const ds = this.status.dataset();
    const st = this.status.etlStatus();

    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 44;
    const contentW = pageW - margin * 2;
    let y = 0;

    const ensureSpace = (need: number) => {
      if (y + need > pageH - margin) {
        doc.addPage();
        y = margin;
      }
    };

    /* ——— Portada ——— */
    doc.setFillColor(...COL.accentDark);
    doc.rect(0, 0, pageW, 118, 'F');
    doc.setFillColor(...COL.accent);
    doc.rect(0, 118, pageW, 4, 'F');

    doc.setTextColor(...COL.white);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.text('Informe técnico', margin, 52);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text('Análisis cuantitativo — dataset ETL y métricas de riesgo', margin, 74);

    doc.setFontSize(9);
    doc.setTextColor(200, 230, 245);
    const gen = new Date();
    const genStr = gen.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
    doc.text(`Generado: ${genStr}`, margin, 96);
    if (st?.ultimaActualizacion) {
      doc.text(`Última ejecución ETL: ${st.ultimaActualizacion}`, margin + 220, 96);
    }

    y = 138;
    doc.setTextColor(...COL.ink);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Filas en dataset unificado: ${ds.length}`, margin, y);
    y += 26;

    y = this.drawSectionHeading(doc, 'Resumen metodológico', margin, y, contentW);
    const methLines = doc.splitTextToSize(
      [
        '• Correlaciones: coeficiente de Pearson entre retornos diarios simples del cierre',
        '  (variación porcentual día a día), solo donde ambos activos tienen dato (alineación por filas).',
        '• Volatilidad anualizada: desviación estándar de retornos diarios multiplicada por √252 (días de negocio típicos).',
        '• Patrones: ventana deslizante de 3 días sobre retornos (subidas/bajadas consecutivas y rango relativo en la ventana).',
        '• SMA: media aritmética simple de los últimos N cierres; en este PDF no se incluye el gráfico de velas, sí el ranking y la matriz.',
      ].join('\n'),
      contentW,
    );
    for (const line of methLines) {
      ensureSpace(14);
      doc.setTextColor(...COL.muted);
      doc.setFontSize(9);
      doc.text(line, margin, y);
      y += 12;
    }
    y += 14;

    /* ——— Ranking ——— */
    ensureSpace(48);
    y = this.drawSectionHeading(doc, 'Ranking de activos (volatilidad y riesgo)', margin, y, contentW);

    if (!analysis?.ranking?.length) {
      doc.setTextColor(...COL.muted);
      doc.setFontSize(10);
      doc.text('No hay datos de ranking. Ejecute el ETL y sincronice la aplicación.', margin, y);
      y += 28;
    } else {
      const headers = ['Activo', 'σ diaria', 'Vol. ann.', 'Riesgo', '↑×3', '↓×3', 'Alta vol.'];
      const colW = [54, 62, 58, 68, 34, 34, 54];
      const rowH = 13;
      const headH = 16;

      ensureSpace(headH + 8);
      doc.setFillColor(...COL.band);
      doc.roundedRect(margin, y - 10, contentW, headH, 3, 3, 'F');
      doc.setDrawColor(...COL.border);
      doc.setLineWidth(0.4);
      doc.roundedRect(margin, y - 10, contentW, headH, 3, 3, 'S');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(...COL.ink);
      let x = margin + 6;
      for (let i = 0; i < headers.length; i++) {
        doc.text(headers[i], x, y);
        x += colW[i];
      }
      y += headH - 2;

      doc.setFont('helvetica', 'normal');
      let rowIdx = 0;
      for (const row of analysis.ranking) {
        ensureSpace(rowH + 4);
        if (rowIdx % 2 === 0) {
          doc.setFillColor(...COL.rowAlt);
          doc.rect(margin, y - 9, contentW, rowH, 'F');
        }
        doc.setTextColor(...COL.ink);
        doc.setFontSize(8);
        x = margin + 6;
        const sig = row.desviacionDiaria ?? 0;
        const cells = [
          row.activo,
          sig.toFixed(5),
          row.volatilidad.toFixed(4),
          row.riesgo,
          String(row.patrones.subida3),
          String(row.patrones.bajada3),
          String(row.patrones.altaVolatilidad),
        ];
        for (let i = 0; i < cells.length; i++) {
          doc.text(cells[i], x, y);
          x += colW[i];
        }
        y += rowH;
        rowIdx++;
      }
      doc.setDrawColor(...COL.border);
      doc.setLineWidth(0.3);
      doc.line(margin, y - 4, margin + contentW, y - 4);
      y += 16;
    }

    /* ——— Correlación ——— */
    ensureSpace(48);
    y = this.drawSectionHeading(doc, 'Matriz de correlación (Pearson)', margin, y, contentW);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...COL.muted);
    const corrIntro = doc.splitTextToSize(
      'Valores entre −1 y 1. Diagonal = 1. Celda (i, j) compara el activo de la fila i con el de la columna j.',
      contentW,
    );
    for (const ln of corrIntro) {
      ensureSpace(12);
      doc.text(ln, margin, y);
      y += 11;
    }
    y += 8;

    if (!corr?.symbols?.length || !corr.matrix?.length) {
      ensureSpace(14);
      doc.text('Matriz no disponible en caché. Abra la vista Visualizaciones y refresque datos.', margin, y);
      y += 20;
    } else {
      const syms = corr.symbols;
      const cell = 34;
      const labelW = 42;
      const maxCols = 7;

      for (let start = 0; start < syms.length; start += maxCols) {
        const end = Math.min(start + maxCols, syms.length);
        const blockW = labelW + (end - start) * cell;
        ensureSpace(28 + (end - start + 1) * 11);

        doc.setFillColor(...COL.band);
        doc.roundedRect(margin, y - 6, Math.min(blockW + 12, contentW), 18, 2, 2, 'F');
        let hx = margin + labelW;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7);
        doc.setTextColor(...COL.ink);
        for (let j = start; j < end; j++) {
          doc.text(syms[j].slice(0, 5), hx + 2, y + 6);
          hx += cell;
        }
        y += 20;

        doc.setFont('helvetica', 'normal');
        for (let i = start; i < end; i++) {
          ensureSpace(12);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(7);
          doc.text(syms[i].slice(0, 6), margin + 4, y);
          doc.setFont('helvetica', 'normal');
          let cx = margin + labelW;
          const mrow = corr.matrix[i] ?? [];
          for (let j = start; j < end; j++) {
            const v = mrow[j];
            const t = v !== undefined && Number.isFinite(v) ? v.toFixed(2) : '—';
            const tint = v !== undefined && Number.isFinite(v) ? Math.round(248 - (v + 1) * 15) : 252;
            doc.setFillColor(tint, tint, Math.min(255, tint + 8));
            doc.rect(cx, y - 8, cell - 2, 11, 'F');
            doc.setDrawColor(...COL.border);
            doc.rect(cx, y - 8, cell - 2, 11, 'S');
            doc.setTextColor(...COL.ink);
            doc.text(t, cx + 4, y);
            cx += cell;
          }
          y += 12;
        }
        y += 10;
      }
    }

    /* ——— Pie ——— */
    ensureSpace(52);
    y = Math.max(y + 8, pageH - margin - 48);
    if (y > pageH - margin - 40) {
      doc.addPage();
      y = margin;
    }
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(margin, y, contentW, 36, 4, 4, 'F');
    doc.setDrawColor(...COL.border);
    doc.roundedRect(margin, y, contentW, 36, 4, 4, 'S');
    doc.setFontSize(8);
    doc.setTextColor(...COL.muted);
    const foot = doc.splitTextToSize(
      'Documento generado desde la aplicación web. Los números reflejan el estado de los datos en memoria del servidor tras el último ETL exitoso.',
      contentW - 16,
    );
    let fy = y + 12;
    for (const fl of foot) {
      doc.text(fl, margin + 8, fy);
      fy += 10;
    }

    doc.save(`informe-tecnico-etl-${Date.now()}.pdf`);
  }

  /**
   * Título de sección sin solapar texto y línea: la raya va claramente debajo del bloque tipográfico.
   * @returns Posición Y del siguiente contenido (pt).
   */
  private drawSectionHeading(doc: jsPDF, title: string, x: number, yTop: number, w: number): number {
    const titleSize = 12;
    const titleLeading = 15;
    const gapTitleToLine = 10;
    const gapLineToBody = 14;
    const barW = 3;

    doc.setFillColor(...COL.accent);
    doc.rect(x, yTop, barW, titleLeading + gapTitleToLine - 2, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(titleSize);
    doc.setTextColor(...COL.accentDark);
    const textX = x + barW + 8;
    doc.text(title, textX, yTop + titleLeading - 2);

    const lineY = yTop + titleLeading + gapTitleToLine;
    doc.setDrawColor(...COL.accent);
    doc.setLineWidth(0.55);
    doc.line(textX, lineY, x + w, lineY);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COL.ink);
    return lineY + gapLineToBody;
  }
}
