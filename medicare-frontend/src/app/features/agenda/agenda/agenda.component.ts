import { Component, OnInit, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { RendezVousService } from '../../../core/services/rendez-vous.service';
import { MedecinService } from '../../../core/services/medecin.service';
import { AuthService } from '../../../core/services/auth.service';
import { RendezVous, StatutRdv } from '../../../core/models/rendezvous.model';
import { RendezVousFormComponent } from '../rendez-vous-form/rendez-vous-form.component';

@Component({
  selector: 'app-agenda',
  imports: [
    DatePipe, ReactiveFormsModule,
    MatCardModule, MatButtonModule, MatIconModule, MatFormFieldModule, MatInputModule,
    MatSelectModule, MatMenuModule, MatProgressSpinnerModule, MatDialogModule
  ],
  templateUrl: './agenda.component.html',
  styleUrl: './agenda.component.scss'
})
export class AgendaComponent implements OnInit {
  readonly rendezVousService = inject(RendezVousService);
  readonly medecinService = inject(MedecinService);
  readonly authService = inject(AuthService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  readonly dateControl = new FormControl('');
  readonly medecinControl = new FormControl<string>('');

  readonly statuts: StatutRdv[] = ['Planifié', 'En cours', 'Terminé', 'Annulé'];

  ngOnInit(): void {
    if (this.authService.hasRole('admin', 'secretaire')) {
      this.medecinService.loadMedecins();
    }
    this.reload();
  }

  reload(): void {
    const filtres: { medecinId?: string; date?: string } = {};
    const date = this.dateControl.value;
    if (date) filtres.date = date;

    if (this.authService.role() === 'medecin') {
      filtres.medecinId = this.authService.userId() ?? undefined;
    } else if (this.medecinControl.value) {
      filtres.medecinId = this.medecinControl.value;
    }

    this.rendezVousService.loadRendezVous(filtres);
  }

  reinitialiser(): void {
    this.dateControl.setValue('');
    this.medecinControl.setValue('');
    this.reload();
  }

  nouveauRdv(): void {
    const ref = this.dialog.open(RendezVousFormComponent, { width: '600px', maxWidth: '95vw' });
    ref.afterClosed().subscribe((created) => {
      if (created) this.reload();
    });
  }

  changerStatut(rdv: RendezVous, statut: StatutRdv): void {
    this.rendezVousService.updateStatut(rdv.id_rdv, statut).subscribe({
      next: () => this.snackBar.open(`Statut : ${statut}.`, 'OK', { duration: 2500 }),
      error: (err) => this.snackBar.open(err.error?.error ?? 'Modification impossible.', 'OK', { duration: 4000 })
    });
  }

  supprimer(rdv: RendezVous): void {
    if (!confirm('Supprimer ce rendez-vous ?')) return;
    this.rendezVousService.delete(rdv.id_rdv).subscribe({
      next: () => this.snackBar.open('Rendez-vous supprimé.', 'OK', { duration: 2500 }),
      error: (err) => this.snackBar.open(err.error?.error ?? 'Suppression impossible.', 'OK', { duration: 4000 })
    });
  }

  peutGererStatut(rdv: RendezVous): boolean {
    if (this.authService.hasRole('admin', 'secretaire')) return true;
    // Médecin : uniquement ses propres rendez-vous.
    return this.authService.role() === 'medecin' && rdv.id_nat_medecin === this.authService.userId();
  }
}
