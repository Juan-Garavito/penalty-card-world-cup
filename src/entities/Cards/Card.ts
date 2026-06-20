export abstract class Card {
  constructor(
    public readonly id: number,
    public readonly name: string,
    public readonly description: string,
    public readonly imageUrl: string,
  ) {}
}
