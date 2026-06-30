export interface Patient {
  id_nat: string;
  nom: string;
  prenom: string;
  date_naissance: string;
  adresse?: string;
  telephone?: string;
  email?: string;
}

export interface CreatePatientDto {
  id_nat: string;
  nom: string;
  prenom: string;
  date_naissance: string;
  adresse?: string;
  telephone?: string;
  email?: string;
}

export interface UpdatePatientDto {
  nom?: string;
  prenom?: string;
  date_naissance?: string;
  adresse?: string;
  telephone?: string;
  email?: string;
}

export interface PatientMaladie {
  id_nat_patient: string;
  id_maladie: number;
  libelle?: string;
  code_cim?: string;
  id_nat_medecin?: string;
  medecin_nom?: string;
  date_diagnostic: string;
  observations?: string;
}

export interface PatientAssurance {
  id_nat_patient: string;
  id_assurance: number;
  nom?: string;
  type?: string;
  numero_affiliation?: string;
  date_debut?: string;
  date_fin?: string;
}

export interface AddMaladieDto {
  id_maladie: number;
  date_diagnostic: string;
  observations?: string;
}

export interface AddAssuranceDto {
  id_assurance: number;
  numero_affiliation?: string;
  date_debut?: string;
  date_fin?: string;
}
