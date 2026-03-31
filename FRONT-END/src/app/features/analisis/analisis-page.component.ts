import { Component, computed, inject } from '@angular/core';
import { AppStatusService } from '../../core/services/app-status.service';
import { DataColumn, DataTableComponent } from '../../shared/ui/data-table.component';
import { PageSkeletonComponent } from '../../shared/ui/page-skeleton.component';

@Component({
  selector: 'app-analisis-page',
  imports: [DataTableComponent, PageSkeletonComponent],
  templateUrl: './analisis-page.component.html',
  styleUrl: './analisis-page.component.css',
})
export class AnalisisPageComponent {
  protected readonly status = inject(AppStatusService);

  protected readonly columns: DataColumn[] = [
    { key: 'activo', label: 'Activo' },
    { key: 'desviacionDiaria', label: 'σ diaria' },
    { key: 'volatilidad', label: 'Volatilidad' },
    { key: 'riesgo', label: 'Riesgo' },
    { key: 'subida3', label: 'Patrón ↑×3' },
    { key: 'bajada3', label: 'Patrón ↓×3' },
    { key: 'altaVolatilidad', label: 'Alta vol. (ventana)' },
  ];

  protected readonly rows = computed(() => {
    const r = this.status.analysis()?.ranking ?? [];
    return r.map((x) => ({
      activo: x.activo,
      desviacionDiaria:
        x.desviacionDiaria !== undefined && x.desviacionDiaria !== null
          ? Number(x.desviacionDiaria).toFixed(6)
          : '—',
      volatilidad: x.volatilidad,
      riesgo: x.riesgo,
      subida3: x.patrones.subida3,
      bajada3: x.patrones.bajada3,
      altaVolatilidad: x.patrones.altaVolatilidad,
    })) as Record<string, unknown>[];
  });
}
