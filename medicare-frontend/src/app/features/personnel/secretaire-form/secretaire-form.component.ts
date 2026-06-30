import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { SecretaireService } from '../../../core/services/secretaire.service';
import { SucursaleService } from '../../../core/services/sucursale.service';
import { Secretaire } from '../../../core/models/secretaire.model';
import { idNatValidator } from '../../patients/patient-form/patient-form.component';

@Component({
  selector: 'app-secretaire-form',
  imports: [
    ReactiveFormsModule, MatDialogModule, MatFormFieldModule, MatInputModule,
    MatSelectModule, MatButtonModule
  ],
  templateUrl: './secretaire-form.component.html',
  styleUrl: './secretaire-form.component.scss'
})
export class SecretaireFormComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly secretaireService = inject(SecretaireService);
  readonly sucursaleService = inject(SucursaleService);
  private readonly dialogRef = inject(MatDialogRef<SecretaireFormComponent>);
  readonly data = inject<Secretaire | null>(MAT_DIALOG_DATA);

  readonly isEdit = signal(false);
  readonly saving = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    id_nat: ['', [Validators.required, idNatValidator()]],
    nom: ['', [Validators.required]],
    prenom: ['', [Validators.required]],
    email: ['', [Validators.required, Validators.email]],
    mot_de_passe: ['', [Validators.required, Validators.minLength(8)]],
    id_sucursale: [0, [Validators.required]]
  });

  ngOnInit(): void {
    this.sucursaleService.loadSucursales();
    if (this.data) {
      this.isEdit.set(true);
      this.form.controls.id_nat.disable();
      this.form.controls.mot_de_passe.disable();
      this.form.patchValue({
        id_nat: this.data.id_nat,
        nom: this.data.nom,
        prenom: this.data.prenom,
        email: this.data.email,
        id_sucursale: this.data.id_sucursale
      });
    }
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
      this.secretaireService.update(this.data.id_nat, {
        nom: v.nom,
        prenom: v.prenom,
        email: v.email,
        id_sucursale: v.id_sucursale
      }).subscribe({
        next: () => { this.saving.set(false); this.dialogRef.close(true); },
        error: (err) => this.onError(err)
      });
    } else {
      this.secretaireService.create({
        id_nat: v.id_nat.replace(/\D/g, ''),
        nom: v.nom,
        prenom: v.prenom,
        email: v.email,
        mot_de_passe: v.mot_de_passe,
        id_sucursale: v.id_sucursale
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
