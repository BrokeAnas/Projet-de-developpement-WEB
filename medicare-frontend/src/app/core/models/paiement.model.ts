export interface Paiement {
  id_paiement: number;
  id_nat_patient: string;
  patient_nom?: string;
  id_rdv?: number;
  montant: number;
  date_paiement: string;
  mode_paiement?: string;
}

export interface CreatePaiementDto {
  id_nat_patient: string;
  id_rdv?: number;
  montant: number;
  date_paiement: string;
  mode_paiement?: string;
}

export interface UpdatePaiementDto {
  montant?: number;
  date_paiement?: string;
  mode_paiement?: string;
}

export interface AuditLog {
  id_historique: number;
  id_paiement: number;
  id_nat_patient: string;
  patient_nom?: string;
  montant: number;
  date_paiement: string;
  operation: 'UPDATE' | 'DELETE';
  date_operation: string;
}
