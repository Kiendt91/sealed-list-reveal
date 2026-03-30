export interface PlayerMetadata {
  name: string;
  submitted: boolean;
  submittedAt?: any;
}

export interface Match {
  id: string;
  p1: PlayerMetadata;
  p2: PlayerMetadata;
  revealed: boolean;
  createdAt: any;
  expiresAt: any;
}

export interface ListContent {
  content: string;
}
