export interface CharacterFrame {
  imageUrl: string;
  startSeconds: number;
  endSeconds: number;
}
export interface CharacterFrames {
  durationSeconds: number;
  frames: CharacterFrame[];
}
export interface EjectorProps extends Record<string, unknown> {
  ejectedText: string;
  impostorText: string;
  characterFrames: CharacterFrames;
  showWatermark: boolean;
}
export type PaidTier = "hd" | "full-hd";
export interface PaidStatus {
  paid: boolean;
  dollarValue?: number;
  paidAt?: string;
}
export interface PaymentSuccessPayload {
  amount: number;
  finalAmount: number;
  currency: string;
  email: string;
  receiptURL?: string;
  method: "stripe" | "paypal" | "coupon";
}
