// REQ-IRNG-001
export interface IRng {
  next(): number; // returns value in [0, 1)
}
