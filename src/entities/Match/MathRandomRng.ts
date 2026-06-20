import { IRng } from "./IRng.ts";

// REQ-IRNG-002
export class MathRandomRng implements IRng {
  next(): number {
    return Math.random();
  }
}
