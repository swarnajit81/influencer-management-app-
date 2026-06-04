const INR = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

export function paiseToRupees(paise: number | bigint): number {
  return Number(paise) / 100;
}

export function formatPaiseAsINR(paise: number | bigint): string {
  return INR.format(paiseToRupees(paise));
}

export function rupeesToPaise(rupees: number): number {
  return Math.round(rupees * 100);
}
