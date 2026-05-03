import { Component, computed, inject, signal } from '@angular/core';
import { AppStatusService } from '../../core/services/app-status.service';
import { DataColumn, DataTableComponent } from '../../shared/ui/data-table.component';
import { PageSkeletonComponent } from '../../shared/ui/page-skeleton.component';
import { EtlApiService } from '../../core/services/etl-api.service';
import { AssetVolumeDay } from '../../shared/models/etl.models';

@Component({
  selector: 'app-activos-page',
  imports: [DataTableComponent, PageSkeletonComponent],
  templateUrl: './activos-page.component.html',
  styleUrl: './activos-page.component.css',
})
export class ActivosPageComponent {
  protected readonly status = inject(AppStatusService);
  private readonly etl = inject(EtlApiService);

  protected readonly topVolumeDays = signal<AssetVolumeDay[]>([]);
  protected readonly loadingTopVolume = signal(false);
  protected readonly topVolumeError = signal<string | null>(null);

  protected readonly columns = computed<DataColumn[]>(() => {
    const rows = this.status.dataset();
    if (!rows.length) {
      return [{ key: 'date', label: 'Fecha' }];
    }
    const keys = Object.keys(rows[0]);
    keys.sort((a, b) => {
      if (a === 'date') return -1;
      if (b === 'date') return 1;
      return a.localeCompare(b);
    });
    return keys.map((key) => ({
      key,
      label: key === 'date' ? 'Fecha' : key,
    }));
  });

  protected readonly rows = computed(() => this.status.dataset() as Record<string, unknown>[]);

  constructor() {
    
  }

}
