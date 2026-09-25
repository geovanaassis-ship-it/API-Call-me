import { randomBytes } from "crypto";

/**
 * Gera uma sala de videochamada Jitsi Meet sem precisar de OAuth/credenciais
 * externas. Serve como padrão gratuito; o analista pode sobrescrever com um
 * link manual (Zoom/Teams/Google Meet) por tipo de evento.
 */
export function generateJitsiRoomUrl(seed: string): string {
  const random = randomBytes(4).toString("hex");
  const room = `MoreInvest-RI-${seed}-${random}`.replace(/[^a-zA-Z0-9-]/g, "");
  return `https://meet.jit.si/${room}`;
}

export function resolveVideoLink(params: {
  locationType: string;
  locationValue: string | null;
  bookingUid: string;
}): { videoLink: string | null; locationLabel: string } {
  const { locationType, locationValue, bookingUid } = params;

  switch (locationType) {
    case "JITSI":
      return { videoLink: generateJitsiRoomUrl(bookingUid), locationLabel: "Videochamada (Jitsi Meet)" };
    case "GOOGLE_MEET":
      return { videoLink: locationValue ?? null, locationLabel: "Google Meet" };
    case "ZOOM":
      return { videoLink: locationValue ?? null, locationLabel: "Zoom" };
    case "TEAMS":
      return { videoLink: locationValue ?? null, locationLabel: "Microsoft Teams" };
    case "TEAMS_AUTO":
      // O link real (único por agendamento) é preenchido depois, via Microsoft Graph API.
      return { videoLink: null, locationLabel: "Microsoft Teams (gerado automaticamente)" };
    case "PHONE":
      return { videoLink: null, locationLabel: locationValue ? `Ligação: ${locationValue}` : "Ligação telefônica" };
    case "IN_PERSON":
      return { videoLink: null, locationLabel: locationValue ?? "Presencial" };
    default:
      return { videoLink: locationValue ?? null, locationLabel: locationValue ?? "Local a definir" };
  }
}
