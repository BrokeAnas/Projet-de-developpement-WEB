import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { PaiementService } from '../../../core/services/paiement.service';
import { PatientService } from '../../../core/services/patient.service';
import { Paiement } from '../../../core/models/paiement.model';
import { Patient } from '../../../core/models/patient.model';

@Component({
  selector: 'app-paiement-form',
  imports: [
    ReactiveFormsModule, MatDialogModule, MatFormFieldModule, MatInputModule,
    MatSelectModule, MatAutocompleteModule, MatButtonModule
  ],
  templateUrl: './paiement-form.component.html',
  styleUrl: './paiement-form.component.scss'
})
export class PaiementFormComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  readonly patientService = inject(PatientService);
  private readonly paiementService = inject(PaiementService);
  private readonly dialogRef = inject(MatDialogRef<PaiementFormComponent>);
  readonly data = inject<Paiement | null>(MAT_DIALOG_DATA);

  readonly isEdit = signal(false);
  readonly saving = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly modes = ['Carte', 'Espèces', 'Bancontact', 'Virement'];

  readonly patientControl = new FormControl<Patient | string>('', { nonNullable: true });
  private readonly searchTerm = signal('');
  readonly filteredPatients = computed(() => {
    const term = this.searchTerm().toLowerCase();
    return this.patientService.patients().filter(p =>
      `${p.prenom} ${p.nom}`.toLowerCase().includes(term) || p.id_nat.includes(term));
  });

  readonly form = this.fb.nonNullable.group({
    montant: [0, [Validators.required, Validators.min(0.01)]],
    date_paiement: [new Date().toISOString().substring(0, 10), [Validators.required]],
    mode_paiement: ['Carte'],
    id_rdv: [null as number | null]
  });

  ngOnInit(): void {
    if (this.data) {
      this.isEdit.set(true);
      this.form.patchValue({
        montant: this.data.montant,
        date_paiement: this.data.date_paiement?.substring(0, 10),
        mode_paiement: this.data.mode_paiement ?? 'Carte',
        id_rdv: this.data.id_rdv ?? null
      });
    } else {
      this.patientService.loadPatients('');
      this.patientControl.valueChanges
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(v => this.searchTerm.set(typeof v === 'string' ? v : `${v.prenom} ${v.nom}`));
    }
  }

  displayPatient(p: Patient | string | null): string {
    if (p && typeof p !== 'string') return `${p.prenom} ${p.nom} (${p.id_nat})`;
    return typeof p === 'string' ? p : '';
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    this.saving.set(true);
    this.errorMessage.set(null);

    if (this.isEdit() && this.data) {
      this.paiementService.update(this.data.id_paiement, {
        montant: v.montant,
        date_paiement: v.date_paiement,
        mode_paiement: v.mode_paiement || undefined
      }).subscribe({
        next: () => { this.saving.set(false); this.dialogRef.close(true); },
        error: (err) => this.onError(err)
      });
    } else {
      const patient = this.patientControl.value;
      if (!patient || typeof patient === 'string') {
        this.saving.set(false);
        this.errorMessage.set('Veuillez sélectionner un patient.');
        return;
      }
      this.paiementService.create({
        id_nat_patient: patient.id_nat,
        id_rdv: v.id_rdv ?? undefined,
        montant: v.montant,
        date_paiement: v.date_paiement,
        mode_paiement: v.mode_paiement || undefined
      }).subscribe({
        next: () => { this.saving.set(false); this.dialogRef.close(true); },
        error: (err) => this.onError(err)
      });
    }
  }

  annuler(): void {
    this.dialogRef.close(false);
  }

  private onError(err: { error?: { error?: string } }): void {
    this.saving.set(false);
    this.errorMessage.set(err.error?.error ?? 'Enregistrement impossible.');
  }
}
