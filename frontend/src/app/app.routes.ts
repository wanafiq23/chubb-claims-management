import { inject } from '@angular/core';
import { Routes } from '@angular/router';
import { AuthService } from './core/auth/auth.service';
import { authGuard, roleGuard } from './core/guards/auth.guard';
import { LayoutComponent } from './shared/components/layout.component';
export const routes: Routes = [
  { path: 'login', title: 'CHUBB | Sign in', loadComponent: () => import('./core/auth/login.component').then(m => m.LoginComponent) },
  { path: '', component: LayoutComponent, canActivate: [authGuard], children: [
    { path: '', pathMatch: 'full', redirectTo: () => inject(AuthService).home() },
    { path: 'customer', title: 'CHUBB | Customer Dashboard', canActivate: [roleGuard], data: { roles: ['Customer'] }, loadComponent: () => import('./features/customer/dashboard.component').then(m => m.CustomerDashboardComponent) },
    { path: 'customer/claims', title: 'CHUBB | My Claims', canActivate: [roleGuard], data: { roles: ['Customer'] }, loadComponent: () => import('./features/customer/my-claims.component').then(m => m.MyClaimsComponent) },
    { path: 'customer/submit', title: 'CHUBB | Submit Claim', canActivate: [roleGuard], data: { roles: ['Customer'] }, loadComponent: () => import('./features/customer/submit-claim.component').then(m => m.SubmitClaimComponent) },
    { path: 'staff', title: 'CHUBB | Staff Dashboard', canActivate: [roleGuard], data: { roles: ['Staff'] }, loadComponent: () => import('./features/staff/dashboard.component').then(m => m.StaffDashboardComponent) },
    { path: 'staff/queue', title: 'CHUBB | Claims Queue', canActivate: [roleGuard], data: { roles: ['Staff'] }, loadComponent: () => import('./features/staff/queue.component').then(m => m.QueueComponent) },
    { path: 'staff/reports', title: 'CHUBB | Team Workload', canActivate: [roleGuard], data: { roles: ['Staff'], reportsOnly: true }, loadComponent: () => import('./features/staff/dashboard.component').then(m => m.StaffDashboardComponent) },
    { path: 'manager', title: 'CHUBB | Manager Dashboard', canActivate: [roleGuard], data: { roles: ['Manager'] }, loadComponent: () => import('./features/manager/dashboard.component').then(m => m.ManagerDashboardComponent) },
    { path: 'claims/:id', title: 'CHUBB | Claim Details', canActivate: [roleGuard], data: { roles: ['Customer', 'Staff', 'Manager'] }, loadComponent: () => import('./features/claims/detail.component').then(m => m.ClaimDetailComponent) },
    { path: 'forbidden', title: 'CHUBB | Access restricted', loadComponent: () => import('./shared/components/error-page.component').then(m => m.ErrorPageComponent), data: { title: 'Access restricted', message: 'Your demo role does not have access to this workspace.' } },
    { path: '**', title: 'CHUBB | Page not found', loadComponent: () => import('./shared/components/error-page.component').then(m => m.ErrorPageComponent) }
  ] }
];
