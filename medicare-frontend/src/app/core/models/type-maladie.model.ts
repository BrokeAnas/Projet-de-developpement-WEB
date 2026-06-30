export interface TypeMaladie {
  id_maladie: number;
  libelle: string;
  code_cim?: string;
}

export interface CreateTypeMaladieDto {
  libelle: string;
  code_cim?: string;
}
