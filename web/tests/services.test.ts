/**
 * Transaction-rail integration tests against a throwaway SQLite database.
 * Covers the state machines, the IDOR guarantees, and the append-only audit
 * trigger — the same properties probed manually over HTTP, kept green by CI.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

process.env.FARMKARO_DB_PATH = path.join(mkdtempSync(path.join(tmpdir(), "fk-test-")), "test.db");

import { db, now, uuid, audit } from "@/server/db";
import type { SessionUser } from "@/server/core";
import {
  advanceLease,
  createEnquiry,
  createOffer,
  conversationMessages,
  myLeases,
  myOffers,
  respondToOffer,
  setRegistrationStatus,
} from "@/server/services";

function makeUser(phone: string, seedOwnerId: string | null = null): SessionUser {
  const id = uuid();
  const t = now();
  db()
    .prepare(
      `INSERT INTO users (id, phone, full_name, roles, seed_owner_id, created_at, updated_at)
       VALUES (?, ?, NULL, '["lessee","owner"]', ?, ?, ?)`,
    )
    .run(id, phone, seedOwnerId, t, t);
  return { id, phone, fullName: null, roles: ["lessee", "owner"], seedOwnerId };
}

let farmer: SessionUser;
let owner: SessionUser;
let stranger: SessionUser;
let parcelId: string;
let parcelSeedOwner: string;

beforeAll(() => {
  const row = db().prepare("SELECT id, seed_owner_id FROM parcels LIMIT 1").get() as {
    id: string;
    seed_owner_id: string;
  };
  parcelId = row.id;
  parcelSeedOwner = row.seed_owner_id;
  farmer = makeUser("9811111111");
  owner = makeUser("9822222222", parcelSeedOwner);
  stranger = makeUser("9833333333");
});

describe("enquiries", () => {
  it("creates an enquiry with a conversation, and blocks self-enquiry", () => {
    const res = createEnquiry(farmer, parcelId, "Is this land available?");
    expect(res.id).toBeTruthy();
    expect(res.conversationId).toBeTruthy();
    expect(() => createEnquiry(owner, parcelId, "my own land")).toThrowError(/own parcel/);
  });

  it("conversation is readable by parties only", () => {
    const { conversationId } = createEnquiry(farmer, parcelId, "second question");
    expect(conversationMessages(farmer, conversationId).length).toBeGreaterThan(0);
    expect(conversationMessages(owner, conversationId).length).toBeGreaterThan(0);
    expect(() => conversationMessages(stranger, conversationId)).toThrowError(/not part/);
  });
});

describe("offer state machine", () => {
  it("full accept path creates a draft lease", () => {
    const { id: offerId } = createOffer(farmer, { parcelId, rentAnnual: 50000, leaseYears: 3 });
    // stranger cannot act
    expect(() => respondToOffer(stranger, offerId, "accept")).toThrowError(/not a party/);
    // the author cannot accept their own offer
    expect(() => respondToOffer(farmer, offerId, "accept")).toThrowError(/not a party/);
    // owner accepts
    const res = respondToOffer(owner, offerId, "accept");
    expect(res.status).toBe("accepted");
    expect(res.leaseId).toBeTruthy();
    // terminal: double-accept rejected
    expect(() => respondToOffer(owner, offerId, "accept")).toThrowError(/cannot accept/);
  });

  it("counter creates a new open offer authored by the owner, actionable by the lessee", () => {
    const { id: offerId } = createOffer(farmer, { parcelId, rentAnnual: 40000, leaseYears: 2 });
    const res = respondToOffer(owner, offerId, "counter", { rentAnnual: 45000, leaseYears: 2 });
    expect(res.status).toBe("countered");
    expect(res.counterOfferId).toBeTruthy();
    // the lessee can accept the counter; the owner cannot accept their own counter
    expect(() => respondToOffer(owner, res.counterOfferId!, "accept")).toThrowError(/not a party/);
    const accepted = respondToOffer(farmer, res.counterOfferId!, "accept");
    expect(accepted.leaseId).toBeTruthy();
  });

  it("only the author may withdraw", () => {
    const { id: offerId } = createOffer(farmer, { parcelId, rentAnnual: 42000, leaseYears: 1 });
    expect(() => respondToOffer(owner, offerId, "withdraw")).toThrowError(/not a party/);
    expect(respondToOffer(farmer, offerId, "withdraw").status).toBe("withdrawn");
  });

  it("rejects out-of-range terms", () => {
    expect(() => createOffer(farmer, { parcelId, rentAnnual: 10, leaseYears: 3 })).toThrowError(/Rent/);
    expect(() => createOffer(farmer, { parcelId, rentAnnual: 50000, leaseYears: 99 })).toThrowError(/term/);
  });
});

describe("lease lifecycle", () => {
  function freshLease(): string {
    const { id } = createOffer(farmer, { parcelId, rentAnnual: 60000, leaseYears: 3 });
    return respondToOffer(owner, id, "accept").leaseId!;
  }

  it("advances strictly in order and rejects skips", () => {
    const leaseId = freshLease();
    expect(() => advanceLease(farmer, leaseId, "active")).toThrowError(/Cannot move/);
    advanceLease(farmer, leaseId, "terms_agreed");
    advanceLease(owner, leaseId, "agreement_generated");
    advanceLease(farmer, leaseId, "signed");
    const res = advanceLease(owner, leaseId, "active");
    expect(res.status).toBe("active");
    // active cannot go back to signed
    expect(() => advanceLease(owner, leaseId, "signed")).toThrowError(/Cannot move/);
    // stranger cannot touch it at any point
    expect(() => advanceLease(stranger, leaseId, "completed")).toThrowError(/not a party/);
  });

  it("activation schedules a rent payment record", () => {
    const leaseId = freshLease();
    for (const s of ["terms_agreed", "agreement_generated", "signed", "active"]) advanceLease(owner, leaseId, s);
    const payments = db().prepare("SELECT * FROM payments WHERE lease_id = ?").all(leaseId);
    expect(payments.length).toBe(1);
  });

  it("registration only moves forward", () => {
    const leaseId = freshLease();
    setRegistrationStatus(owner, leaseId, "stamped");
    setRegistrationStatus(owner, leaseId, "registered");
    expect(() => setRegistrationStatus(owner, leaseId, "stamped")).toThrowError(/backwards/);
    expect(() => setRegistrationStatus(stranger, leaseId, "registered")).toThrowError(/not a party/);
  });

  it("myLeases scopes by party and never leaks to strangers", () => {
    expect(myLeases(stranger).length).toBe(0);
    expect(myLeases(farmer).length).toBeGreaterThan(0);
    expect(myLeases(owner).length).toBeGreaterThan(0);
  });

  it("no lease row can claim tenancy rights (schema CHECK)", () => {
    const lease = db().prepare("SELECT id FROM leases LIMIT 1").get() as { id: string };
    expect(() =>
      db().prepare("UPDATE leases SET creates_tenancy_rights = 1 WHERE id = ?").run(lease.id),
    ).toThrowError();
  });
});

describe("offers listing visibility", () => {
  it("stranger sees no offers", () => {
    expect(myOffers(stranger).length).toBe(0);
  });
  it("owner and farmer both see the negotiation", () => {
    expect(myOffers(owner).length).toBeGreaterThan(0);
    expect(myOffers(farmer).length).toBeGreaterThan(0);
  });
});

describe("audit log", () => {
  it("mutations were audited", () => {
    const n = (db().prepare("SELECT COUNT(*) AS n FROM audit_logs").get() as { n: number }).n;
    expect(n).toBeGreaterThan(5);
  });
  it("is append-only at the engine level", () => {
    audit({ action: "test_entry", targetType: "test" });
    const row = db().prepare("SELECT id FROM audit_logs ORDER BY id DESC LIMIT 1").get() as { id: number };
    expect(() => db().prepare("DELETE FROM audit_logs WHERE id = ?").run(row.id)).toThrowError(/append-only/);
    expect(() =>
      db().prepare("UPDATE audit_logs SET action = 'tampered' WHERE id = ?").run(row.id),
    ).toThrowError(/append-only/);
  });
});
