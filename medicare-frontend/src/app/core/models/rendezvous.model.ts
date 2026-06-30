export type StatutRdv = 'Planifié' | 'En cours' | 'Terminé' | 'Annulé';

export interface RendezVous {
  id_rdv: number;
  id_nat_patient: string;
  patient_nom?: string;
  id_nat_medecin: string;
  medecin_nom?: string;
  id_nat_secretaire?: string;
  id_sucursale: number;
  sucursale_nom?: string;
  date_rdv: string;
  heure_debut: string;
  heure_fin: string;
  motif?: string;
  statut: StatutRdv;
}

export interface CreateRendezVousDto {
  id_nat_patient: string;
  id_nat_medecin: string;
  id_nat_secretaire?: string;
  id_sucursale: number;
  date_rdv: string;
  heure_debut: string;
  heure_fin: string;
  motif?: string;
}

export interface UpdateRendezVousDto {
  date_rdv?: string;
  heure_debut?: string;
  heure_fin?: string;
  motif?: string;
  statut?: StatutRdv;
}
