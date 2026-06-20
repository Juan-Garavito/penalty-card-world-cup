export type MatchState =
  | {
      readonly phase: "WaitingForDecisions";
      readonly shooterId: string;
      readonly goalkeeperId: string;
    }
  | {
      readonly phase: "ResolvingShot";
      readonly shooterId: string;
      readonly goalkeeperId: string;
    }
  | {
      readonly phase: "SuddenDeath";
      readonly shooterId: string;
      readonly goalkeeperId: string;
      readonly sdRound: number;
    }
  | {
      readonly phase: "GameOver";
      readonly winner: string | null;
    };
