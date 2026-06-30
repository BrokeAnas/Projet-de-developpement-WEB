import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '../../core/services/auth.service';
import { StatsService } from '../../core/services/stats.service';
import { RendezVousService } from '../../core/services/rendez-vous.service';

interface StatItem {
  label: string;
  value: string | number;
  icon: string;
}

@Component({
  selector: 'app-dashboard',
  imports: [RouterLink, MatCardModule, MatIconModule, MatButtonModule, MatProgressSpinnerModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent implements OnInit {
  readonly authService = inject(AuthService);
  private readonly statsService = inject(StatsService);
  readonly rendezVousService = inject(RendezVousService);

  readonly stats = signal<StatItem[]>([]);
  readonly today = new Date().toISOString().substring(0, 10);

  ngOnInit(): void {
    const role = this.authService.role();

    if (role === 'admin') {
      this.statsService.getStats().subscribe({
        next: (s) => this.stats.set([
          { label: 'Patients', value: s.total_patients, icon: 'people' },
          { label: 'Médecins', value: s.total_medecins, icon: 'medical_services' },
          { label: 'Secrétaires', value: s.total_secretaires, icon: 'badge' },
          { label: 'Succursales', value: s.total_sucursales, icon: 'business' },
          { label: "RDV aujourd'hui", value: s.rdv_aujourd_hui, icon: 'today' },
          { label: 'RDV cette semaine', value: s.rdv_cette_semaine, icon: 'date_range' },
          { label: 'Revenu du mois', value: `${Number(s.revenu_du_mois).toFixed(2)} €`, icon: 'euro' },
          { label: 'Total paiements', value: s.total_paiements, icon: 'payments' }
        ])
      });
    } else if (role === 'secretaire') {
      // Le back-end restreint automatiquement à la succursale de la secrétaire (RG-04).
      this.rendezVousService.loadRendezVous({ date: this.today });
    } else if (role === 'medecin') {
      this.rendezVousService.loadRendezVous({ date: this.today, medecinId: this.authService.userId() ?? undefined });
    }
  }
}
