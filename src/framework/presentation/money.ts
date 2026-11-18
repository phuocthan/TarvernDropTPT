import type { GameDefinition } from "../domain/contracts.ts";
export function formatMoney(game: GameDefinition, minor: number, symbol = true) {
  const currency = game.currency ?? { code: "USD", exponent: 2, locale: "en-US" };
  const amount = new Intl.NumberFormat(currency.locale ?? "en-US", {
    minimumFractionDigits: currency.exponent, maximumFractionDigits: currency.exponent,
  }).format(minor / 10 ** currency.exponent);
  const sign = new Intl.NumberFormat(currency.locale ?? "en-US", { style: "currency", currency: currency.code, currencyDisplay: "narrowSymbol" })
    .formatToParts(0).find((part) => part.type === "currency")!.value;
  return (symbol ? sign : "") + amount;
}
