import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { roleGuard } from './core/guards/role.guard';

import { LoginComponent } from './features/auth/login/login.component';
import { DashboardComponent } from './features/dashboard/dashboard.component';
import { PatientListComponent } from './features/patients/patient-list/patient-list.component';
import { PatientDetailComponent } from './features/patients/patient-detail/patient-detail.component';
import { PatientFormComponent } from './features/patients/patient-form/patient-form.component';
import { AgendaComponent } from './features/agenda/agenda/agenda.component';
import { PaiementListComponent } from './features/paiements/paiement-list/paiement-list.component';
import { AuditLogComponent } from './features/paiements/audit-log/audit-log.component';
import { MedecinListComponent } from './features/personnel/medecin-list/medecin-list.component';
import { SecretaireListComponent } from './features/personnel/secretaire-list/secretaire-list.component';
import { AdministrationComponent } from './features/administration/administration.component';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  { path: 'dashboard', component: DashboardComponent, canActivate: [authGuard] },

  // Patients
  { path: 'patients', component: PatientListComponent, canActivate: [authGuard] },
  { path: 'patients/new', component: PatientFormComponent, canActivate: [() => roleGuard('secretaire', 'admin')()] },
  { path: 'patients/:id', component: PatientDetailComponent, canActivate: [authGuard] },
  { path: 'patients/:id/edit', component: PatientFormComponent, canActivate: [() => roleGuard('secretaire', 'admin')()] },

  // Agenda
  { path: 'agenda', component: AgendaComponent, canActivate: [authGuard] },

  // Paiements
  { path: 'paiements', component: PaiementListComponent, canActivate: [() => roleGuard('secretaire', 'admin')()] },
  { path: 'paiements/audit', component: AuditLogComponent, canActivate: [() => roleGuard('admin')()] },

  // Personnel
  { path: 'personnel/medecins', component: MedecinListComponent, canActivate: [authGuard] },
  { path: 'personnel/secretaires', component: SecretaireListComponent, canActivate: [() => roleGuard('admin')()] },

  // Administration
  { path: 'administration', component: AdministrationComponent, canActivate: [() => roleGuard('admin')()] },

  { path: '**', redirectTo: 'dashboard' }
];
