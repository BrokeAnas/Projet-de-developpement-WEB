import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { PatientService } from '../../../core/services/patient.service';
import { MedecinService } from '../../../core/services/medecin.service';
import { SucursaleService } from '../../../core/services/sucursale.service';
import { RendezVousService } from '../../../core/services/rendez-vous.service';
import { AuthService } from '../../../core/services/auth.service';
import { Patient } from '../../../core/models/patient.model';

@Component({
  selector: 'app-rendez-vous-form',
  imports: [
    ReactiveFormsModule, MatDialogModule, MatFormFieldModule, MatInputModule,
    MatSelectModule, MatAutocompleteModule, MatButtonModule
  ],
  templateUrl: './rendez-vous-form.component.html',
  styleUrl: './rendez-vous-form.component.scss'
})
export class RendezVousFormComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  readonly patientService = inject(PatientService);
  readonly medecinService = inject(MedecinService);
  readonly sucursaleService = inject(SucursaleService);
  private readonly rendezVousService = inject(RendezVousService);
  private readonly authService = inject(AuthService);
  private readonly dialogRef = inject(MatDialogRef<RendezVousFormComponent>);

  readonly saving = signal(false);
  readonly conflitMessage = signal<string | null>(null);

  readonly patientControl = new FormControl<Patient | string>('', { nonNullable: true });
  private readonly searchTerm = signal('');

  readonly filteredPatients = computed(() => {
    const term = this.searchTerm().toLowerCase();
    return this.patientService.patients().filter(p =>
      `${p.prenom} ${p.nom}`.toLowerCase().includes(term) || p.id_nat.includes(term));
  });

  readonly form = this.fb.nonNullable.group({
    id_nat_medecin: ['', [Validators.required]],
    id_sucursale: [0, [Validators.required]],
    date_rdv: ['', [Validators.required]],
    heure_debut: ['', [Validators.required]],
    heure_fin: ['', [Validators.required]],
    motif: ['']
  });

  ngOnInit(): void {
    this.patientService.loadPatients('');
    this.medecinService.loadMedecins();
    this.sucursaleService.loadSucursales();

    this.patientControl.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(v => this.searchTerm.set(typeof v === 'string' ? v : `${v.prenom} ${v.nom}`));
  }

  displayPatient(p: Patient | string | null): string {
    if (p && typeof p !== 'string') return `${p.prenom} ${p.nom} (${p.id_nat})`;
    return typeof p === 'string' ? p : '';
  }

  private fullTime(t: string): string {
    return t.length === 5 ? `${t}:00` : t;
  }

  submit(): void {
    const patient = this.patientControl.value;
    if (!patient || typeof patient === 'string') {
      this.conflitMessage.set('Veuillez sélectionner un patient dans la liste.');
      return;
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    this.conflitMessage.set(null);
    const v = this.form.getRawValue();

    this.rendezVousService.create({
      id_nat_patient: patient.id_nat,
      id_nat_medecin: v.id_nat_medecin,
      id_nat_secretaire: this.authService.role() === 'secretaire' ? (this.authService.userId() ?? undefined) : undefined,
      id_sucursale: v.id_sucursale,
      date_rdv: v.date_rdv,
      heure_debut: this.fullTime(v.heure_debut),
      heure_fin: this.fullTime(v.heure_fin),
      motif: v.motif || undefined
    }).subscribe({
      next: () => { this.saving.set(false); this.dialogRef.close(true); },
      error: (err) => {
        this.saving.set(false);
        if (err.status === 409) {
          this.conflitMessage.set(err.error?.error ?? 'Ce médecin a déjà un rendez-vous à cet horaire.');
        } else {
          this.conflitMessage.set(err.error?.error ?? 'Création impossible.');
        }
      }
    });
  }

  annuler(): void {
    this.dialogRef.close(false);
  }
}
