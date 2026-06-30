import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { DatePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { PatientService } from '../../../core/services/patient.service';
import { AuthService } from '../../../core/services/auth.service';
import { TypeMaladieService } from '../../../core/services/type-maladie.service';
import { AssuranceService } from '../../../core/services/assurance.service';
import { Patient, PatientAssurance, PatientMaladie } from '../../../core/models/patient.model';
import { TypeMaladie } from '../../../core/models/type-maladie.model';
import { Assurance } from '../../../core/models/assurance.model';

@Component({
  selector: 'app-patient-detail',
  imports: [
    DatePipe, ReactiveFormsModule,
    MatCardModule, MatButtonModule, MatIconModule, MatFormFieldModule,
    MatInputModule, MatSelectModule, MatProgressSpinnerModule
  ],
  templateUrl: './patient-detail.component.html',
  styleUrl: './patient-detail.component.scss'
})
export class PatientDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly patientService = inject(PatientService);
  readonly authService = inject(AuthService);
  private readonly typeMaladieService = inject(TypeMaladieService);
  private readonly assuranceService = inject(AssuranceService);
  private readonly fb = inject(FormBuilder);
  private readonly snackBar = inject(MatSnackBar);

  readonly patient = signal<Patient | null>(null);
  readonly maladies = signal<PatientMaladie[]>([]);
  readonly assurances = signal<PatientAssurance[]>([]);
  readonly typesMaladie = signal<TypeMaladie[]>([]);
  readonly assurancesRef = signal<Assurance[]>([]);
  readonly loading = signal(true);

  readonly showDiagnosticForm = signal(false);
  readonly showAssuranceForm = signal(false);

  private idNat = '';

  readonly diagnosticForm = this.fb.nonNullable.group({
    id_maladie: [0, [Validators.required]],
    date_diagnostic: [new Date().toISOString().substring(0, 10), [Validators.required]],
    observations: ['']
  });

  readonly assuranceForm = this.fb.nonNullable.group({
    id_assurance: [0, [Validators.required]],
    numero_affiliation: [''],
    date_debut: [''],
    date_fin: ['']
  });

  ngOnInit(): void {
    this.idNat = this.route.snapshot.paramMap.get('id') ?? '';
    this.patientService.getById(this.idNat).subscribe({
      next: (p) => { this.patient.set(p); this.loading.set(false); },
      error: () => { this.loading.set(false); this.snackBar.open('Patient introuvable.', 'OK', { duration: 4000 }); }
    });

    // Assurances : lecture autorisée à tous les rôles.
    this.loadAssurances();
    if (this.authService.hasRole('secretaire', 'admin')) {
      this.assuranceService.getAll().subscribe(list => this.assurancesRef.set(list));
    }

    // Dossier médical : médecin / admin uniquement (RG-05).
    if (this.authService.hasRole('medecin', 'admin')) {
      this.patientService.getMaladies(this.idNat).subscribe(list => this.maladies.set(list));
      this.typeMaladieService.getAll().subscribe(list => this.typesMaladie.set(list));
    }
  }

  private loadAssurances(): void {
    this.patientService.getAssurances(this.idNat).subscribe(list => this.assurances.set(list));
  }

  retour(): void {
    this.router.navigate(['/patients']);
  }

  editer(): void {
    this.router.navigate(['/patients', this.idNat, 'edit']);
  }

  ajouterDiagnostic(): void {
    this.showDiagnosticForm.update(v => !v);
  }

  submitDiagnostic(): void {
    if (this.diagnosticForm.invalid) return;
    this.patientService.addMaladie(this.idNat, this.diagnosticForm.getRawValue()).subscribe({
      next: (list) => {
        this.maladies.set(list);
        this.showDiagnosticForm.set(false);
        this.diagnosticForm.reset({ id_maladie: 0, date_diagnostic: new Date().toISOString().substring(0, 10), observations: '' });
        this.snackBar.open('Diagnostic ajouté.', 'OK', { duration: 3000 });
      },
      error: (err) => this.snackBar.open(err.error?.error ?? 'Erreur.', 'OK', { duration: 4000 })
    });
  }

  toggleAssuranceForm(): void {
    this.showAssuranceForm.update(v => !v);
  }

  submitAssurance(): void {
    if (this.assuranceForm.invalid) return;
    const v = this.assuranceForm.getRawValue();
    this.patientService.addAssurance(this.idNat, {
      id_assurance: v.id_assurance,
      numero_affiliation: v.numero_affiliation || undefined,
      date_debut: v.date_debut || undefined,
      date_fin: v.date_fin || undefined
    }).subscribe({
      next: (list) => {
        this.assurances.set(list);
        this.showAssuranceForm.set(false);
        this.assuranceForm.reset({ id_assurance: 0, numero_affiliation: '', date_debut: '', date_fin: '' });
        this.snackBar.open('Assurance ajoutée.', 'OK', { duration: 3000 });
      },
      error: (err) => this.snackBar.open(err.error?.error ?? 'Erreur.', 'OK', { duration: 4000 })
    });
  }

  retirerAssurance(a: PatientAssurance): void {
    if (!confirm(`Retirer l'assurance « ${a.nom} » ?`)) return;
    this.patientService.removeAssurance(this.idNat, a.id_assurance).subscribe({
      next: () => {
        this.assurances.update(list => list.filter(x => x.id_assurance !== a.id_assurance));
        this.snackBar.open('Assurance retirée.', 'OK', { duration: 3000 });
      },
      error: (err) => this.snackBar.open(err.error?.error ?? 'Erreur.', 'OK', { duration: 4000 })
    });
  }
}
