import { Component, computed, input, signal } from '@angular/core';

export interface DataColumn {
  key: string;
  label: string;
}

@Component({
  selector: 'app-data-table',
  imports: [],
  templateUrl: './data-table.component.html',
  styleUrl: './data-table.component.css',
})
export class DataTableComponent {
  readonly columns = input.required<DataColumn[]>();
  readonly rows = input.required<Record<string, unknown>[]>();

  protected readonly filterText = signal('');
  protected readonly sortKey = signal<string | null>(null);
  protected readonly sortAsc = signal(true);
  protected readonly pageSize = signal(25);
  protected readonly page = signal(1);

  protected readonly filteredRows = computed(() => {
    const q = this.filterText().trim().toLowerCase();
    let list = this.rows();
    if (q) {
      list = list.filter((row) =>
        Object.values(row).some((v) => String(v).toLowerCase().includes(q)),
      );
    }
    const sk = this.sortKey();
    if (!sk) {
      return list;
    }
    const asc = this.sortAsc();
    return [...list].sort((a, b) => {
      const va = a[sk];
      const vb = b[sk];
      const na = typeof va === 'number' ? va : String(va);
      const nb = typeof vb === 'number' ? vb : String(vb);
      if (na < nb) return asc ? -1 : 1;
      if (na > nb) return asc ? 1 : -1;
      return 0;
    });
  });

  protected readonly totalRows = computed(() => this.filteredRows().length);

  protected readonly totalPages = computed(() => {
    const size = Math.max(1, this.pageSize());
    return Math.max(1, Math.ceil(this.totalRows() / size));
  });

  protected readonly pagedRows = computed(() => {
    const size = Math.max(1, this.pageSize());
    const totalPages = this.totalPages();
    const page = Math.min(Math.max(1, this.page()), totalPages);
    if (page !== this.page()) {
      // Mantener la página siempre dentro del rango
      this.page.set(page);
    }
    const start = (page - 1) * size;
    return this.filteredRows().slice(start, start + size);
  });

  protected setPageSize(v: number): void {
    const next = Number(v);
    this.pageSize.set(Number.isFinite(next) && next > 0 ? next : 25);
    this.page.set(1);
  }

  protected prevPage(): void {
    this.page.update((p) => Math.max(1, p - 1));
  }

  protected nextPage(): void {
    this.page.update((p) => Math.min(this.totalPages(), p + 1));
  }

  protected sortBy(key: string): void {
    if (this.sortKey() === key) {
      this.sortAsc.update((v) => !v);
    } else {
      this.sortKey.set(key);
      this.sortAsc.set(true);
    }
    this.page.set(1);
  }

  protected sortIcon(key: string): string {
    if (this.sortKey() !== key) return '↕';
    return this.sortAsc() ? '↑' : '↓';
  }

  private formatCellValue(v: unknown): string {
    if (v === null || v === undefined) return '—';

    switch (typeof v) {
      case 'number':
        return Number.isFinite(v) ? v.toFixed(6) : String(v);
      case 'string':
        return v;
      case 'boolean':
        return v ? 'true' : 'false';
      case 'bigint':
        return v.toString();
      case 'symbol':
        return v.description ? `Symbol(${v.description})` : 'Symbol';
      case 'function':
        return '[fn]';
      case 'object':
        try {
          return JSON.stringify(v);
        } catch {
          return '[obj]';
        }
      default:
        return '—';
    }
  }

  protected displayCell(row: Record<string, unknown>, key: string): string {
    return this.formatCellValue(row[key]);
  }
}
