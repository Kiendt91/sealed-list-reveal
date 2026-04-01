export interface PlayerMetadata {
  name: string;
  submitted: boolean;
  submittedAt?: any;
}

export interface GameData {
  turn: number;
  mission?: {
    deployment: string;
    primary: string;
    rule: string;
  };
  p1Vp: number;
  p1Cp: number;
  p2Vp: number;
  p2Cp: number;
  rollOff?: {
    p1: number;
    p2: number;
  };
}

export interface Match {
  id: string;
  p1: PlayerMetadata;
  p2: PlayerMetadata;
  revealed: boolean;
  revealedAt?: any;
  finished?: boolean;
  p1Score?: number;
  p2Score?: number;
  gameData?: GameData;
  createdAt: any;
  expiresAt: any;
}

export interface ListContent {
  items: string[];
  selectedIndex?: number;
}
