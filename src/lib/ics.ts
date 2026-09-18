import { createEvent, type EventAttributes } from "ics";

export function buildIcsInvite(params: {
  uid: string;
  title: string;
  description: string;
  start: Date;
  end: Date;
  organizerName: string;
  organizerEmail: string;
  attendeeName: string;
  attendeeEmail: string;
  location: string;
}): string {
  const toArray = (d: Date): [number, number, number, number, number] => [
    d.getUTCFullYear(),
    d.getUTCMonth() + 1,
    d.getUTCDate(),
    d.getUTCHours(),
    d.getUTCMinutes(),
  ];

  const event: EventAttributes = {
    uid: params.uid,
    title: params.title,
    description: params.description,
    start: toArray(params.start),
    startInputType: "utc",
    end: toArray(params.end),
    endInputType: "utc",
    location: params.location,
    organizer: { name: params.organizerName, email: params.organizerEmail },
    attendees: [
      { name: params.organizerName, email: params.organizerEmail, rsvp: true, partstat: "ACCEPTED" },
      { name: params.attendeeName, email: params.attendeeEmail, rsvp: true, partstat: "NEEDS-ACTION" },
    ],
    status: "CONFIRMED",
    busyStatus: "BUSY",
  };

  const { error, value } = createEvent(event);
  if (error || !value) {
    throw error ?? new Error("Falha ao gerar convite ICS");
  }
  return value;
}
