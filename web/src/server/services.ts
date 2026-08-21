/**
 * Domain services — the transaction rail.
 *
 * enquiry -> offer -> negotiation -> acceptance -> lease lifecycle.
 * Every mutation: (1) checks the actor is a party with the right role,
 * (2) validates the state transition against an explicit machine,
 * (3) appends to the audit log, (4) notifies the counterparty.
 * Nothing here trusts an ID from the client without an ownership check.
 */
import { db, now, uuid, audit, notify } from "./db";
import { AuthError, type SessionUser } from "./core";
import type { ParcelView } from "@/lib/types";

/* ---------- parcels -------------------------------------------------------- */

export function getParcelRow(parcelId: string) {
  return db().prepare("SELECT * FROM parcels WHERE id = ? OR ref = ?").get(parcelId, parcelId) as
    | { id: string; ref: string; owner_user_id: string | null; seed_owner_id: string | null; data: string }
    | undefined;
}

export function parcelView(parcelId: string): ParcelView | null {
  const row = getParcelRow(parcelId);
  return row ? (JSON.parse(row.data) as ParcelView) : null;
}

const isOwnerOfParcel = (
  user: SessionUser,
  row: { owner_user_id: string | null; seed_owner_id: string | null },
) => row.owner_user_id === user.id || (user.seedOwnerId != null && row.seed_owner_id === user.seedOwnerId);

/* ---------- enquiries ------------------------------------------------------ */

export function createEnquiry(user: SessionUser, parcelId: string, message: string) {
  const parcel = getParcelRow(parcelId);
  if (!parcel) throw new AuthError(404, "Parcel not found.");
  if (isOwnerOfParcel(user, parcel)) throw new AuthError(400, "You cannot enquire on your own parcel.");

  const id = uuid();
  const t = now();
  db()
    .prepare(
      `INSERT INTO enquiries (id, parcel_id, lessee_id, status, message, created_at, updated_at)
       VALUES (?, ?, ?, 'new', ?, ?, ?)`,
    )
    .run(id, parcel.id, user.id, message, t, t);

  const convo = ensureConversation(parcel.id, user.id, parcel.owner_user_id);
  addMessage(convo, user.id, message, null);
  addMessage(convo, null, null, "enquiry_created");

  if (parcel.owner_user_id) {
    notify(parcel.owner_user_id, {
      eventType: "enquiry_received",
      title: "New enquiry on your parcel",
      body: message.slice(0, 140),
      link: `/parcel/${parcel.id}`,
    });
  }
  audit({
    actorId: user.id,
    action: "enquiry_created",
    targetType: "enquiry",
    targetId: id,
    detail: { parcelId: parcel.id },
  });
  return { id, conversationId: convo };
}

interface EnquiryRow {
  id: string;
  parcel_id: string;
  lessee_id: string;
  status: string;
  message: string | null;
  created_at: string;
  parcel_ref: string;
  parcel_data: string;
  conversation_id: string | null;
}

function publicEnquiry(e: EnquiryRow) {
  const p = JSON.parse(e.parcel_data) as ParcelView;
  return {
    id: e.id,
    parcelId: e.parcel_id,
    parcelRef: e.parcel_ref,
    status: e.status,
    message: e.message,
    createdAt: e.created_at,
    // Every enquiry opens a thread. Without this the client has no way to
    // reach it, which left both sides able to send an enquiry and then unable
    // to say anything else.
    conversationId: e.conversation_id,
    parcel: { village: p.village, areaAcres: p.areaAcres, rentAnnual: p.listing.rentAnnual },
  };
}

export function myEnquiries(user: SessionUser) {
  const asLessee = db()
    .prepare(
      `SELECT e.*, p.ref AS parcel_ref, p.data AS parcel_data, c.id AS conversation_id
       FROM enquiries e
       JOIN parcels p ON p.id = e.parcel_id
       LEFT JOIN conversations c ON c.parcel_id = e.parcel_id AND c.lessee_id = e.lessee_id
       WHERE e.lessee_id = ? ORDER BY e.created_at DESC`,
    )
    .all(user.id) as EnquiryRow[];
  const asOwner = db()
    .prepare(
      `SELECT e.*, p.ref AS parcel_ref, p.data AS parcel_data, c.id AS conversation_id
       FROM enquiries e
       JOIN parcels p ON p.id = e.parcel_id
       LEFT JOIN conversations c ON c.parcel_id = e.parcel_id AND c.lessee_id = e.lessee_id
       WHERE p.owner_user_id = ? OR (p.seed_owner_id IS NOT NULL AND p.seed_owner_id = ?)
       ORDER BY e.created_at DESC`,
    )
    .all(user.id, user.seedOwnerId ?? " none") as EnquiryRow[];
  return { asLessee: asLessee.map(publicEnquiry), asOwner: asOwner.map(publicEnquiry) };
}

/* ---------- offers --------------------------------------------------------- */

const OFFER_TRANSITIONS: Record<string, string[]> = {
  open: ["accepted", "rejected", "withdrawn", "countered"],
  countered: [], // terminal for that row; the counter is a new row
  accepted: [],
  rejected: [],
  withdrawn: [],
};

export function createOffer(
  user: SessionUser,
  input: {
    parcelId: string;
    rentAnnual: number;
    deposit?: number;
    leaseYears: number;
    startDate?: string;
    note?: string;
  },
) {
  const parcel = getParcelRow(input.parcelId);
  if (!parcel) throw new AuthError(404, "Parcel not found.");
  if (isOwnerOfParcel(user, parcel)) throw new AuthError(400, "You cannot offer on your own parcel.");
  if (input.rentAnnual < 1000 || input.rentAnnual > 100_000_000) throw new AuthError(400, "Rent out of range.");
  if (input.leaseYears < 0.5 || input.leaseYears > 30) throw new AuthError(400, "Lease term out of range.");

  const id = uuid();
  const t = now();
  db()
    .prepare(
      `INSERT INTO offers (id, parcel_id, lessee_id, status, rent_annual, deposit, lease_years, start_date, note, actor_role, created_at, updated_at)
       VALUES (?, ?, ?, 'open', ?, ?, ?, ?, ?, 'lessee', ?, ?)`,
    )
    .run(
      id,
      parcel.id,
      user.id,
      input.rentAnnual,
      input.deposit ?? null,
      input.leaseYears,
      input.startDate ?? null,
      input.note ?? null,
      t,
      t,
    );

  const convo = ensureConversation(parcel.id, user.id, parcel.owner_user_id);
  addMessage(
    convo,
    null,
    `Offer: Rs ${input.rentAnnual.toLocaleString("en-IN")}/yr for ${input.leaseYears} years`,
    "offer_made",
  );

  if (parcel.owner_user_id) {
    notify(parcel.owner_user_id, {
      eventType: "offer_received",
      title: `Offer received: Rs ${input.rentAnnual.toLocaleString("en-IN")}/yr`,
      link: `/parcel/${parcel.id}`,
    });
  }
  audit({
    actorId: user.id,
    action: "offer_created",
    targetType: "offer",
    targetId: id,
    detail: { parcelId: parcel.id, rentAnnual: input.rentAnnual },
  });
  return { id };
}

export function respondToOffer(
  user: SessionUser,
  offerId: string,
  action: "accept" | "reject" | "counter" | "withdraw",
  counter?: { rentAnnual: number; leaseYears: number; note?: string },
) {
  const offer = db().prepare("SELECT * FROM offers WHERE id = ?").get(offerId) as
    | {
        id: string;
        parcel_id: string;
        lessee_id: string;
        status: string;
        rent_annual: number;
        deposit: number | null;
        lease_years: number;
        start_date: string | null;
        actor_role: string;
      }
    | undefined;
  if (!offer) throw new AuthError(404, "Offer not found.");

  const parcel = getParcelRow(offer.parcel_id)!;
  const owner = isOwnerOfParcel(user, parcel);
  const lessee = offer.lessee_id === user.id;

  // The counterparty of whoever authored the offer row may accept, reject or
  // counter it; only the author may withdraw it.
  const authorIsLessee = offer.actor_role === "lessee";
  const isCounterparty = authorIsLessee ? owner : lessee;
  const isAuthor = authorIsLessee ? lessee : owner;
  if (action === "withdraw" ? !isAuthor : !isCounterparty)
    throw new AuthError(403, "You are not a party who can take that action on this offer.");

  const next =
    action === "accept" ? "accepted" : action === "reject" ? "rejected" : action === "counter" ? "countered" : "withdrawn";
  if (!OFFER_TRANSITIONS[offer.status]?.includes(next))
    throw new AuthError(409, `Offer is ${offer.status}; cannot ${action}.`);

  if (action === "counter") {
    if (!counter) throw new AuthError(400, "Counter terms required.");
    if (counter.rentAnnual < 1000 || counter.rentAnnual > 100_000_000)
      throw new AuthError(400, "Rent out of range.");
    if (counter.leaseYears < 0.5 || counter.leaseYears > 30)
      throw new AuthError(400, "Lease term out of range.");
  }

  // One live lease per parcel: refuse to accept an offer when the parcel
  // already has a non-terminal lease. Prevents two accepted offers producing
  // two overlapping leases on the same land.
  if (action === "accept") {
    const live = db()
      .prepare(
        `SELECT id FROM leases WHERE parcel_id = ? AND status NOT IN ('completed','terminated') LIMIT 1`,
      )
      .get(offer.parcel_id);
    if (live) throw new AuthError(409, "This parcel already has a live lease.");
  }

  const convo = ensureConversation(parcel.id, offer.lessee_id, parcel.owner_user_id);

  let counterOfferId: string | null = null;
  let leaseId: string | null = null;

  // All state changes for this response commit together or not at all.
  const tx = db().transaction(() => {
    db().prepare("UPDATE offers SET status = ?, updated_at = ? WHERE id = ?").run(next, now(), offer.id);
    audit({ actorId: user.id, action: `offer_${next}`, targetType: "offer", targetId: offer.id });

    if (action === "counter") {
      counterOfferId = uuid();
      const t = now();
      db()
        .prepare(
          `INSERT INTO offers (id, parcel_id, lessee_id, parent_offer_id, status, rent_annual, deposit, lease_years, start_date, note, actor_role, created_at, updated_at)
           VALUES (?, ?, ?, ?, 'open', ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          counterOfferId,
          offer.parcel_id,
          offer.lessee_id,
          offer.id,
          counter!.rentAnnual,
          offer.deposit,
          counter!.leaseYears,
          offer.start_date,
          counter!.note ?? null,
          owner ? "owner" : "lessee",
          t,
          t,
        );
      addMessage(
        convo,
        null,
        `Counter-offer: Rs ${counter!.rentAnnual.toLocaleString("en-IN")}/yr for ${counter!.leaseYears} years`,
        "offer_countered",
      );
    }

    if (action === "accept") {
      leaseId = createLeaseFromOffer(user, offer, parcel);
      addMessage(convo, null, "Offer accepted; draft lease created", "offer_accepted");
    }
    if (action === "reject") addMessage(convo, null, null, "offer_rejected");

    const counterpartyId = authorIsLessee ? offer.lessee_id : parcel.owner_user_id;
    if (counterpartyId && counterpartyId !== user.id) {
      notify(counterpartyId, {
        eventType: `offer_${next}`,
        title:
          action === "accept"
            ? "Your offer was accepted"
            : action === "counter"
              ? "You received a counter-offer"
              : `Offer ${next}`,
        link: `/parcel/${parcel.id}`,
      });
    }
  });
  tx();

  return { status: next, counterOfferId, leaseId };
}

/* ---------- leases --------------------------------------------------------- */

const LEASE_TRANSITIONS: Record<string, string[]> = {
  draft: ["terms_agreed"],
  terms_agreed: ["agreement_generated"],
  agreement_generated: ["signed"],
  signed: ["active"],
  active: ["completed", "terminated"],
  completed: [],
  terminated: [],
};

const REGISTRATION_ORDER = ["unregistered", "stamped", "submitted_for_registration", "registered"];

function createLeaseFromOffer(
  actor: SessionUser,
  offer: {
    id: string;
    parcel_id: string;
    lessee_id: string;
    rent_annual: number;
    deposit: number | null;
    lease_years: number;
    start_date: string | null;
  },
  parcel: { id: string; ref: string; owner_user_id: string | null },
): string {
  const id = uuid();
  const t = now();
  const ref = `FK-L-${new Date().getFullYear()}${String(
    (db().prepare("SELECT COUNT(*) AS n FROM leases").get() as { n: number }).n + 200,
  )}`;
  const start = offer.start_date ?? t.slice(0, 10);
  const end = new Date(new Date(start).getTime() + offer.lease_years * 365.25 * 86400000)
    .toISOString()
    .slice(0, 10);

  db()
    .prepare(
      `INSERT INTO leases (id, ref, parcel_id, offer_id, lessor_id, lessee_id, status, rent_annual, deposit, start_date, end_date, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      ref,
      offer.parcel_id,
      offer.id,
      parcel.owner_user_id,
      offer.lessee_id,
      offer.rent_annual,
      offer.deposit,
      start,
      end,
      t,
      t,
    );

  leaseEvent(id, "lease_created", actor.id, { fromOffer: offer.id });
  notify(offer.lessee_id, { eventType: "lease_created", title: `Draft lease ${ref} created`, link: `/dashboard/farmer` });
  audit({ actorId: actor.id, action: "lease_created", targetType: "lease", targetId: id });
  return id;
}

export function leaseEvent(
  leaseId: string,
  type: string,
  actorId: string | null,
  payload: Record<string, unknown> = {},
) {
  db()
    .prepare(
      `INSERT INTO lease_events (id, lease_id, event_type, actor_id, payload, occurred_at) VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(uuid(), leaseId, type, actorId, JSON.stringify(payload), now());
}

export function advanceLease(user: SessionUser, leaseId: string, to: string) {
  const lease = db().prepare("SELECT * FROM leases WHERE id = ?").get(leaseId) as
    | {
        id: string;
        ref: string;
        status: string;
        lessor_id: string | null;
        lessee_id: string;
        parcel_id: string;
        rent_annual: number;
        deposit: number | null;
      }
    | undefined;
  if (!lease) throw new AuthError(404, "Lease not found.");

  const parcel = getParcelRow(lease.parcel_id)!;
  const party = lease.lessee_id === user.id || lease.lessor_id === user.id || isOwnerOfParcel(user, parcel);
  if (!party) throw new AuthError(403, "You are not a party to this lease.");

  if (!LEASE_TRANSITIONS[lease.status]?.includes(to))
    throw new AuthError(409, `Cannot move a ${lease.status} lease to ${to}.`);

  db().prepare("UPDATE leases SET status = ?, updated_at = ? WHERE id = ?").run(to, now(), lease.id);
  leaseEvent(lease.id, `status_${to}`, user.id);
  audit({ actorId: user.id, action: `lease_${to}`, targetType: "lease", targetId: lease.id });

  // Activation schedules the first rent instalment as a payment record.
  if (to === "active") {
    db()
      .prepare(
        `INSERT INTO payments (id, lease_id, payer_id, purpose, amount, due_date, status, created_at)
         VALUES (?, ?, ?, 'rent', ?, ?, 'pending', ?)`,
      )
      .run(uuid(), lease.id, lease.lessee_id, Math.round(lease.rent_annual / 2), now().slice(0, 10), now());
    leaseEvent(lease.id, "payment_scheduled", null, { amount: Math.round(lease.rent_annual / 2) });
  }

  const other = user.id === lease.lessee_id ? lease.lessor_id : lease.lessee_id;
  if (other)
    notify(other, {
      eventType: `lease_${to}`,
      title: `Lease ${lease.ref}: ${to.replace(/_/g, " ")}`,
      link: `/dashboard/farmer`,
    });
  return { status: to };
}

export function setRegistrationStatus(user: SessionUser, leaseId: string, to: string) {
  if (!REGISTRATION_ORDER.includes(to)) throw new AuthError(400, "Unknown registration status.");
  const lease = db().prepare("SELECT * FROM leases WHERE id = ?").get(leaseId) as
    | {
        id: string;
        ref: string;
        registration_status: string;
        lessor_id: string | null;
        lessee_id: string;
        parcel_id: string;
      }
    | undefined;
  if (!lease) throw new AuthError(404, "Lease not found.");
  const parcel = getParcelRow(lease.parcel_id)!;
  // Registration is a landowner-side record, not a shared one. The lessee is a
  // party to the lease but must not be able to assert that it is registered:
  // the whole point of showing this field is that "stamped" is not
  // "registered", and a self-attested flag either side can set would make that
  // claim meaningless.
  const isLessorSide = lease.lessor_id === user.id || isOwnerOfParcel(user, parcel);
  if (!isLessorSide) {
    throw new AuthError(
      403,
      lease.lessee_id === user.id
        ? "Only the landowner's side records registration."
        : "You are not a party to this lease.",
    );
  }
  // Registration only moves forward: a registered lease never silently
  // becomes unregistered.
  if (REGISTRATION_ORDER.indexOf(to) < REGISTRATION_ORDER.indexOf(lease.registration_status))
    throw new AuthError(409, "Registration status cannot move backwards.");
  db().prepare("UPDATE leases SET registration_status = ?, updated_at = ? WHERE id = ?").run(to, now(), lease.id);
  leaseEvent(lease.id, `registration_${to}`, user.id);
  audit({ actorId: user.id, action: `lease_registration_${to}`, targetType: "lease", targetId: lease.id });
  return { registrationStatus: to };
}

export function myLeases(user: SessionUser) {
  const rows = db()
    .prepare(
      `SELECT l.*, p.ref AS parcel_ref, p.data AS parcel_data FROM leases l
       JOIN parcels p ON p.id = l.parcel_id
       WHERE l.lessee_id = ? OR l.lessor_id = ?
          OR p.owner_user_id = ? OR (p.seed_owner_id IS NOT NULL AND p.seed_owner_id = ?)
       ORDER BY l.created_at DESC`,
    )
    .all(user.id, user.id, user.id, user.seedOwnerId ?? " none") as Array<{
    id: string;
    ref: string;
    parcel_id: string;
    parcel_ref: string;
    parcel_data: string;
    status: string;
    registration_status: string;
    rent_annual: number;
    deposit: number | null;
    start_date: string | null;
    end_date: string | null;
    lessee_id: string;
    lessor_id: string | null;
  }>;
  return rows.map((l) => {
    const p = JSON.parse(l.parcel_data) as ParcelView;
    const events = db()
      .prepare("SELECT event_type, occurred_at FROM lease_events WHERE lease_id = ? ORDER BY occurred_at")
      .all(l.id) as { event_type: string; occurred_at: string }[];
    return {
      id: l.id,
      ref: l.ref,
      parcelId: l.parcel_id,
      parcelRef: l.parcel_ref,
      village: p.village,
      areaAcres: p.areaAcres,
      status: l.status,
      registrationStatus: l.registration_status,
      rentAnnual: l.rent_annual,
      deposit: l.deposit,
      startDate: l.start_date,
      endDate: l.end_date,
      role: l.lessee_id === user.id ? "lessee" : "lessor",
      createsTenancyRights: false,
      nextTransitions: LEASE_TRANSITIONS[l.status] ?? [],
      events,
    };
  });
}

export function myOffers(user: SessionUser) {
  const rows = db()
    .prepare(
      `SELECT o.*, p.ref AS parcel_ref, p.data AS parcel_data,
              (p.owner_user_id = ? OR (p.seed_owner_id IS NOT NULL AND p.seed_owner_id = ?)) AS is_owner
       FROM offers o JOIN parcels p ON p.id = o.parcel_id
       WHERE o.lessee_id = ? OR p.owner_user_id = ? OR (p.seed_owner_id IS NOT NULL AND p.seed_owner_id = ?)
       ORDER BY o.created_at DESC`,
    )
    .all(user.id, user.seedOwnerId ?? " none", user.id, user.id, user.seedOwnerId ?? " none") as Array<{
    id: string;
    parcel_id: string;
    parcel_ref: string;
    parcel_data: string;
    lessee_id: string;
    status: string;
    rent_annual: number;
    lease_years: number;
    note: string | null;
    actor_role: string;
    created_at: string;
    is_owner: number;
  }>;
  return rows.map((o) => {
    const p = JSON.parse(o.parcel_data) as ParcelView;
    return {
      id: o.id,
      parcelId: o.parcel_id,
      parcelRef: o.parcel_ref,
      village: p.village,
      areaAcres: p.areaAcres,
      status: o.status,
      rentAnnual: o.rent_annual,
      leaseYears: o.lease_years,
      note: o.note,
      createdAt: o.created_at,
      viewerIsOwner: o.is_owner === 1,
      actorRole: o.actor_role,
      // The viewer can act on an open offer authored by the other side.
      canAct:
        o.status === "open" &&
        ((o.actor_role === "lessee" && o.is_owner === 1) ||
          (o.actor_role === "owner" && o.lessee_id === user.id)),
    };
  });
}

/* ---------- conversations -------------------------------------------------- */

function ensureConversation(parcelId: string, lesseeId: string, ownerId: string | null): string {
  const existing = db()
    .prepare("SELECT id, owner_id FROM conversations WHERE parcel_id = ? AND lessee_id = ?")
    .get(parcelId, lesseeId) as { id: string; owner_id: string | null } | undefined;
  if (existing) {
    if (!existing.owner_id && ownerId)
      db().prepare("UPDATE conversations SET owner_id = ? WHERE id = ?").run(ownerId, existing.id);
    return existing.id;
  }
  const id = uuid();
  db()
    .prepare("INSERT INTO conversations (id, parcel_id, owner_id, lessee_id, created_at) VALUES (?, ?, ?, ?, ?)")
    .run(id, parcelId, ownerId, lesseeId, now());
  return id;
}

function addMessage(
  conversationId: string,
  senderId: string | null,
  body: string | null,
  systemEvent: string | null,
) {
  db()
    .prepare(
      "INSERT INTO messages (id, conversation_id, sender_id, body, system_event, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    )
    .run(uuid(), conversationId, senderId, body, systemEvent, now());
}

function conversationForUser(user: SessionUser, conversationId: string) {
  const convo = db().prepare("SELECT * FROM conversations WHERE id = ?").get(conversationId) as
    | { id: string; parcel_id: string; owner_id: string | null; lessee_id: string }
    | undefined;
  if (!convo) throw new AuthError(404, "Conversation not found.");
  const parcel = getParcelRow(convo.parcel_id)!;
  const party = convo.lessee_id === user.id || convo.owner_id === user.id || isOwnerOfParcel(user, parcel);
  if (!party) throw new AuthError(403, "You are not part of this conversation.");
  return convo;
}

export function conversationMessages(user: SessionUser, conversationId: string) {
  conversationForUser(user, conversationId);
  return db()
    .prepare(
      "SELECT id, sender_id, body, system_event, created_at FROM messages WHERE conversation_id = ? ORDER BY created_at",
    )
    .all(conversationId);
}

export function sendMessage(user: SessionUser, conversationId: string, body: string) {
  const convo = conversationForUser(user, conversationId);
  addMessage(conversationId, user.id, body, null);
  const other = user.id === convo.lessee_id ? (convo.owner_id ?? null) : convo.lessee_id;
  if (other)
    notify(other, {
      eventType: "new_message",
      title: "New message",
      body: body.slice(0, 120),
      link: `/parcel/${convo.parcel_id}`,
    });
  audit({ actorId: user.id, action: "message_sent", targetType: "conversation", targetId: conversationId });
}

export function myNotifications(user: SessionUser) {
  return db()
    .prepare(
      "SELECT id, event_type, title, body, link, read_at, created_at FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50",
    )
    .all(user.id);
}

export function markNotificationsRead(user: SessionUser, ids: string[]) {
  const stmt = db().prepare("UPDATE notifications SET read_at = ? WHERE id = ? AND user_id = ?");
  const t = now();
  for (const id of ids) stmt.run(t, id, user.id);
}
