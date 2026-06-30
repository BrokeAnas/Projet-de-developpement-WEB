import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators
} from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar } from '@angular/material/snack-bar';
import { PatientService } from '../../../core/services/patient.service';

/** Validation du numéro de Registre National belge (modulo 97, avant et après 2000). */
export function idNatValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const val: string = (control.value ?? '').toString().replace(/\D/g, '');
    if (!val || val.length !== 11) return { idNat: 'Doit contenir 11 chiffres' };
    const n = BigInt(val.substring(0, 9));
    const cc = parseInt(val.substring(9, 11), 10);
    if (97 - Number(n % 97n) === cc) return null;
    const n2 = BigInt('2' + val.substring(0, 9));
    return 97 - Number(n2 % 97n) === cc ? null : { idNat: 'Numéro de Registre National invalide' };
  };
}

@Component({
  selector: 'app-patient-form',
  imports: [
    ReactiveFormsModule,
    MatCardModule, MatButtonModule, MatFormFieldModule, MatInputModule
  ],
  templateUrl: './patient-form.component.html',
  styleUrl: './patient-form.component.scss'
})
export class PatientFormComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly patientService = inject(PatientService);
  private readonly snackBar = inject(MatSnackBar);

  readonly isEdit = signal(false);
  readonly saving = signal(false);
  private idNat = '';

  readonly form = this.fb.nonNullable.group({
    id_nat: ['', [Validators.required, idNatValidator()]],
    nom: ['', [Validators.required, Validators.maxLength(100)]],
    prenom: ['', [Validators.required, Validators.maxLength(100)]],
    date_naissance: ['', [Validators.required]],
    adresse: [''],
    telephone: [''],
    email: ['', [Validators.email]]
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.isEdit.set(true);
      this.idNat = id;
      this.form.controls.id_nat.disable();
      this.patientService.getById(id).subscribe(p => {
        this.form.patchValue({
          id_nat: p.id_nat,
          nom: p.nom,
          prenom: p.prenom,
          date_naissance: p.date_naissance?.substring(0, 10),
          adresse: p.adresse ?? '',
          telephone: p.telephone ?? '',
          email: p.email ?? ''
        });
      });
    }
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    const v = this.form.getRawValue();

    if (this.isEdit()) {
      this.patientService.update(this.idNat, {
        nom: v.nom,
        prenom: v.prenom,
        date_naissance: v.date_naissance,
        adresse: v.adresse || undefined,
        telephone: v.telephone || undefined,
        email: v.email || undefined
      }).subscribe({
        next: () => this.onSuccess('Patient mis à jour.'),
        error: (err) => this.onError(err)
      });
    } else {
      this.patientService.create({
        // On supprime les caractères non numériques du numéro de Registre National avant de l'envoyer au backend.
        id_nat: v.id_nat.replace(/\D/g, ''),
        nom: v.nom,
        prenom: v.prenom,
        date_naissance: v.date_naissance,
        adresse: v.adresse || undefined,
        telephone: v.telephone || undefined,
        email: v.email || undefined
      })
      // subscribe sert à déclencher l'appel HTTP et à gérer la réponse ou l'erreur. Sans subscribe, l'appel ne serait pas effectué.
      .subscribe({
        next: () => this.onSuccess('Patient créé.'),
        error: (err) => this.onError(err)
      });
    }
  }

  annuler(): void {
    this.router.navigate(['/patients']);
  }

  private onSuccess(message: string): void {
    this.saving.set(false);
    this.snackBar.open(message, 'OK', { duration: 3000 });
    this.router.navigate(['/patients']);
  }

  private onError(err: { error?: { error?: string } }): void {
    this.saving.set(false);
    this.snackBar.open(err.error?.error ?? 'Enregistrement impossible.', 'OK', { duration: 4000 });
  }
}
