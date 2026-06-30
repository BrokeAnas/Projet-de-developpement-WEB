import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatTabsModule } from '@angular/material/tabs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar } from '@angular/material/snack-bar';
import { SucursaleService } from '../../core/services/sucursale.service';
import { SpecialisationService } from '../../core/services/specialisation.service';
import { AssuranceService } from '../../core/services/assurance.service';
import { TypeMaladieService } from '../../core/services/type-maladie.service';
import { Sucursale } from '../../core/models/sucursale.model';

@Component({
  selector: 'app-administration',
  imports: [
    ReactiveFormsModule, MatCardModule, MatTabsModule, MatButtonModule, MatIconModule,
    MatFormFieldModule, MatInputModule
  ],
  templateUrl: './administration.component.html',
  styleUrl: './administration.component.scss'
})
export class AdministrationComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  readonly sucursaleService = inject(SucursaleService);
  readonly specialisationService = inject(SpecialisationService);
  readonly assuranceService = inject(AssuranceService);
  readonly typeMaladieService = inject(TypeMaladieService);
  private readonly snackBar = inject(MatSnackBar);

  readonly editSucursaleId = signal<number | null>(null);

  readonly sucursaleForm = this.fb.nonNullable.group({
    nom: ['', [Validators.required]],
    adresse: ['', [Validators.required]],
    telephone: [''],
    email: ['', [Validators.email]]
  });

  readonly specialisationForm = this.fb.nonNullable.group({
    libelle: ['', [Validators.required]]
  });

  readonly assuranceForm = this.fb.nonNullable.group({
    nom: ['', [Validators.required]],
    type: ['']
  });

  readonly typeMaladieForm = this.fb.nonNullable.group({
    libelle: ['', [Validators.required]],
    code_cim: ['']
  });

  ngOnInit(): void {
    this.sucursaleService.loadSucursales();
    this.specialisationService.loadSpecialisations();
    this.assuranceService.loadAssurances();
    this.typeMaladieService.loadTypes();
  }

  // ---------- Succursales ----------
  submitSucursale(): void {
    if (this.sucursaleForm.invalid) return;
    const v = this.sucursaleForm.getRawValue();
    const id = this.editSucursaleId();
    const obs = id
      ? this.sucursaleService.update(id, v)
      : this.sucursaleService.create(v);
    obs.subscribe({
      next: () => { this.resetSucursale(); this.notify('Succursale enregistrée.'); },
      error: (err) => this.notify(err.error?.error ?? 'Erreur.')
    });
  }

  editerSucursale(s: Sucursale): void {
    this.editSucursaleId.set(s.id_sucursale);
    this.sucursaleForm.patchValue({
      nom: s.nom, adresse: s.adresse, telephone: s.telephone ?? '', email: s.email ?? ''
    });
  }

  resetSucursale(): void {
    this.editSucursaleId.set(null);
    this.sucursaleForm.reset({ nom: '', adresse: '', telephone: '', email: '' });
  }

  supprimerSucursale(s: Sucursale): void {
    if (!confirm(`Supprimer la succursale « ${s.nom} » ?`)) return;
    this.sucursaleService.delete(s.id_sucursale).subscribe({
      next: () => this.notify('Succursale supprimée.'),
      error: (err) => this.notify(err.error?.error ?? 'Suppression impossible.')
    });
  }

  // ---------- Spécialisations ----------
  submitSpecialisation(): void {
    if (this.specialisationForm.invalid) return;
    this.specialisationService.create(this.specialisationForm.getRawValue()).subscribe({
      next: () => { this.specialisationForm.reset({ libelle: '' }); this.notify('Spécialisation ajoutée.'); },
      error: (err) => this.notify(err.error?.error ?? 'Erreur.')
    });
  }

  supprimerSpecialisation(id: number): void {
    if (!confirm('Supprimer cette spécialisation ?')) return;
    this.specialisationService.delete(id).subscribe({
      next: () => this.notify('Spécialisation supprimée.'),
      error: (err) => this.notify(err.error?.error ?? 'Suppression impossible.')
    });
  }

  // ---------- Assurances ----------
  submitAssurance(): void {
    if (this.assuranceForm.invalid) return;
    const v = this.assuranceForm.getRawValue();
    this.assuranceService.create({ nom: v.nom, type: v.type || undefined }).subscribe({
      next: () => { this.assuranceForm.reset({ nom: '', type: '' }); this.notify('Assurance ajoutée.'); },
      error: (err) => this.notify(err.error?.error ?? 'Erreur.')
    });
  }

  supprimerAssurance(id: number): void {
    if (!confirm('Supprimer cette assurance ?')) return;
    this.assuranceService.delete(id).subscribe({
      next: () => this.notify('Assurance supprimée.'),
      error: (err) => this.notify(err.error?.error ?? 'Suppression impossible.')
    });
  }

  // ---------- Types de maladie ----------
  submitTypeMaladie(): void {
    if (this.typeMaladieForm.invalid) return;
    const v = this.typeMaladieForm.getRawValue();
    this.typeMaladieService.create({ libelle: v.libelle, code_cim: v.code_cim || undefined }).subscribe({
      next: () => { this.typeMaladieForm.reset({ libelle: '', code_cim: '' }); this.notify('Type de maladie ajouté.'); },
      error: (err) => this.notify(err.error?.error ?? 'Erreur.')
    });
  }

  supprimerTypeMaladie(id: number): void {
    if (!confirm('Supprimer ce type de maladie ?')) return;
    this.typeMaladieService.delete(id).subscribe({
      next: () => this.notify('Type de maladie supprimé.'),
      error: (err) => this.notify(err.error?.error ?? 'Suppression impossible.')
    });
  }

  private notify(message: string): void {
    this.snackBar.open(message, 'OK', { duration: 3500 });
  }
}
