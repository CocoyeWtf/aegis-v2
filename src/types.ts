export interface Note {
  relative_path: string; // ID unique
  content: string; // Contenu brut
  last_modified: number; // Timestamp
  title?: string;
}

export interface Resource {
  relative_path: string; // ID unique
  name: string;
  extension: string;
  size: number;
  last_modified: number;
}
