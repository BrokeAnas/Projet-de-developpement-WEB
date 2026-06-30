export interface Sucursale {
  id_sucursale: number;
  nom: string;
  adresse: string;
  telephone?: string;
  email?: string;
}

export interface CreateSucursaleDto {
  nom: string;
  adresse: string;
  telephone?: string;
  email?: string;
}

export interface UpdateSucursaleDto {
  nom?: string;
  adresse?: string;
  telephone?: string;
  email?: string;
}
