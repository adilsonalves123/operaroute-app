export function dashboardGreeting(nome?: string | null): string {
  const hourPart = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Sao_Paulo",
    hour: "numeric",
    hourCycle: "h23",
  })
    .formatToParts(new Date())
    .find((p) => p.type === "hour")?.value;
  const hour = Number(hourPart ?? new Date().getHours());
  const period = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
  const first = nome?.trim().split(/\s+/)[0];
  return first ? `${period}, ${first}` : period;
}

export function monthPeriodLabel(date = new Date()): string {
  const label = date.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}
