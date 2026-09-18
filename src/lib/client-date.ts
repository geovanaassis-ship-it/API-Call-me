export function formatDateInTz(date: Date, timeZone: string): string {
  // en-CA formata como YYYY-MM-DD, conveniente para usar como chave/parâmetro.
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(
    date,
  );
}

export function formatDayLabel(date: Date, timeZone: string): { weekday: string; day: string; month: string } {
  const weekday = new Intl.DateTimeFormat("pt-BR", { timeZone, weekday: "short" }).format(date);
  const day = new Intl.DateTimeFormat("pt-BR", { timeZone, day: "2-digit" }).format(date);
  const month = new Intl.DateTimeFormat("pt-BR", { timeZone, month: "short" }).format(date);
  return { weekday, day, month };
}

export function formatTimeInTz(isoOrDate: string | Date, timeZone: string): string {
  const date = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  return new Intl.DateTimeFormat("pt-BR", { timeZone, hour: "2-digit", minute: "2-digit" }).format(date);
}

export function formatFullDateInTz(isoOrDate: string | Date, timeZone: string): string {
  const date = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone,
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
