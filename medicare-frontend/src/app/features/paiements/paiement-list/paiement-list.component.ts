import { Component, OnInit, inject } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { PaiementService } from '../../../core/services/paiement.service';
import { AuthService } from '../../../core/services/auth.service';
import { Paiement } from '../../../core/models/paiement.model';
import { PaiementFormComponent } from '../paiement-form/paiement-form.component';

@Component({
  selector: 'app-paiement-list',
  imports: [
    DatePipe, DecimalPipe, ReactiveFormsModule,
    MatCardModule, MatButtonModule, MatIconModule, MatFormFieldModule, MatInputModule,
    MatProgressSpinnerModule, MatTooltipModule, MatDialogModule
  ],
  templateUrl: './paiement-list.component.html',
  styleUrl: './paiement-list.component.scss'
})
export class PaiementListComponent implements OnInit {
  readonly paiementService = inject(PaiementService);
  readonly authService = inject(AuthService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  readonly patientControl = new FormControl('');
  readonly dateDebutControl = new FormControl('');
  readonly dateFinControl = new FormControl('');

  ngOnInit(): void {
    this.reload();
  }

  reload(): void {
    this.paiementService.loadPaiements({
      patientId: this.patientControl.value || undefined,
      dateDebut: this.dateDebutControl.value || undefined,
      dateFin: this.dateFinControl.value || undefined
    });
  }

  reinitialiser(): void {
    this.patientControl.setValue('');
    this.dateDebutControl.setValue('');
    this.dateFinControl.setValue('');
    this.reload();
  }

  nouveau(): void {
    const ref = this.dialog.open(PaiementFormComponent, { width: '520px', maxWidth: '95vw' });
    ref.afterClosed().subscribe(ok => { if (ok) this.reload(); });
  }

  modifier(p: Paiement): void {
    const ref = this.dialog.open(PaiementFormComponent, { width: '520px', maxWidth: '95vw', data: p });
    ref.afterClosed().subscribe(ok => { if (ok) this.reload(); });
  }

  supprimer(p: Paiement): void {
    if (!confirm(`Supprimer le paiement n°${p.id_paiement} ?`)) return;
    this.paiementService.delete(p.id_paiement).subscribe({
      next: () => this.snackBar.open('Paiement supprimé (journalisé).', 'OK', { duration: 3000 }),
      error: (err) => this.snackBar.open(err.error?.error ?? 'Suppression impossible.', 'OK', { duration: 4000 })
    });
  }
}
