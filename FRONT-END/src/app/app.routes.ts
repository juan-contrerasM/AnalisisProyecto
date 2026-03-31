import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./shared/layout/main-layout.component').then((m) => m.MainLayoutComponent),
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'dashboard',
        loadChildren: () =>
          import('./features/dashboard/dashboard.routes').then((m) => m.DASHBOARD_ROUTES),
      },
      {
        path: 'activos',
        loadChildren: () =>
          import('./features/activos/activos.routes').then((m) => m.ACTIVOS_ROUTES),
      },
      {
        path: 'similitud',
        loadChildren: () =>
          import('./features/similitud/similitud.routes').then((m) => m.SIMILITUD_ROUTES),
      },
      {
        path: 'analisis',
        loadChildren: () =>
          import('./features/analisis/analisis.routes').then((m) => m.ANALISIS_ROUTES),
      },
      {
        path: 'ordenamiento',
        loadChildren: () =>
          import('./features/ordenamiento/ordenamiento.routes').then((m) => m.ORDENAMIENTO_ROUTES),
      },
      {
        path: 'visualizaciones',
        loadChildren: () =>
          import('./features/visualizaciones/visualizaciones.routes').then((m) => m.VISUALIZACIONES_ROUTES),
      },
    ],
  },
];
