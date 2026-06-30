import { Component, OnInit, inject } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { SecretaireService } from '../../../core/services/secretaire.service';
import { Secretaire } from '../../../core/models/secretaire.model';
import { SecretaireFormComponent } from '../secretaire-form/secretaire-form.component';

@Component({
  selector: 'app-secretaire-list',
  imports: [
    MatCardModule, MatButtonModule, MatIconModule, MatProgressSpinnerModule,
    MatTooltipModule, MatDialogModule
  ],
  templateUrl: './secretaire-list.component.html',
  styleUrl: './secretaire-list.component.scss'
})
export class SecretaireListComponent implements OnInit {
  readonly secretaireService = inject(SecretaireService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  ngOnInit(): void {
    this.secretaireService.loadSecretaires();
  }

  nouveau(): void {
    const ref = this.dialog.open(SecretaireFormComponent, { width: '560px', maxWidth: '95vw' });
    ref.afterClosed().subscribe(ok => { if (ok) this.secretaireService.loadSecretaires(); });
  }

  modifier(s: Secretaire): void {
    const ref = this.dialog.open(SecretaireFormComponent, { width: '560px', maxWidth: '95vw', data: s });
    ref.afterClosed().subscribe(ok => { if (ok) this.secretaireService.loadSecretaires(); });
  }

  supprimer(s: Secretaire): void {
    if (!confirm(`Supprimer la secrétaire ${s.prenom} ${s.nom} ?`)) return;
    this.secretaireService.delete(s.id_nat).subscribe({
      next: () => this.snackBar.open('Secrétaire supprimée.', 'OK', { duration: 3000 }),
      error: (err) => this.snackBar.open(err.error?.error ?? 'Suppression impossible.', 'OK', { duration: 4000 })
    });
  }
}
