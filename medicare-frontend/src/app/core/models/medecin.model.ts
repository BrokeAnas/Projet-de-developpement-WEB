export interface Medecin {
  id_nat: string;
  nom: string;
  prenom: string;
  email: string;
  specialisation?: string;
  sucursale?: string;
  id_specialisation: number;
  id_sucursale?: number;
}

export interface CreateMedecinDto {
  id_nat: string;
  nom: string;
  prenom: string;
  email: string;
  mot_de_passe: string;
  id_specialisation: number;
  id_sucursale?: number;
}

export interface UpdateMedecinDto {
  nom?: string;
  prenom?: string;
  email?: string;
  id_specialisation?: number;
  id_sucursale?: number;
}
