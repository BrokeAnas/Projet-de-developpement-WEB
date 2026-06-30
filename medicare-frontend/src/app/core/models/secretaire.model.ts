export interface Secretaire {
  id_nat: string;
  nom: string;
  prenom: string;
  email: string;
  id_sucursale: number;
  sucursale?: string;
}

export interface CreateSecretaireDto {
  id_nat: string;
  nom: string;
  prenom: string;
  email: string;
  mot_de_passe: string;
  id_sucursale: number;
}

export interface UpdateSecretaireDto {
  nom?: string;
  prenom?: string;
  email?: string;
  id_sucursale?: number;
}
