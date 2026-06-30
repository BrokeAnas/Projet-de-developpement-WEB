export interface Assurance {
  id_assurance: number;
  nom: string;
  type?: string;
}

export interface CreateAssuranceDto {
  nom: string;
  type?: string;
}
