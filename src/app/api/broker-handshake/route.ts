import { NextRequest, NextResponse } from "next/server";
import type { BrokerBrief } from "@/lib/types";

export const runtime = "nodejs";

// ─────────────────────────────────────────────────────────────
// Broker handshake. When a buyer with an UNVERIFIED budget chooses to get
// pre-approved, we package a brief and hand it to a partner mortgage broker.
//
// Guardrails (deliberate):
//  - Requires EXPLICIT consent. No consent → refuse.
//  - PII (name/email/phone) is never sent to any LLM and never logged here.
//  - Mock by default; only forwards if BROKER_WEBHOOK_URL is configured.
//  - This is a referral, not credit assistance: the platform does not advise
//    on a loan or amount. Disclose any referral fee in the UI.
// ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let body: BrokerBrief;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid request" }, { status: 400 });
  }

  if (!body.consent) {
    return NextResponse.json(
      { success: false, error: "Consent is required before contacting a broker." },
      { status: 400 },
    );
  }
  if (!body.clientName || !body.email) {
    return NextResponse.json({ success: false, error: "Name and email are required." }, { status: 400 });
  }

  const brief = {
    leadSource: "PropTech-X AI Buyer Agent",
    clientName: body.clientName,
    contact: { email: body.email, phone: body.phone },
    estimatedBudget: body.inputBudget,
    preferredStrategy: body.intent === "invest" ? "Investor — land-led" : "Owner-occupier — lifestyle/school",
    suburbs: body.suburbs,
    syncedAt: new Date().toISOString(),
  };

  const webhook = process.env.BROKER_WEBHOOK_URL;
  const brokerRef = `BR-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

  if (!webhook) {
    // Mock mode: do NOT log PII. Just acknowledge.
    return NextResponse.json({
      success: true,
      brokerRef,
      isMock: true,
      message:
        "Demo: your brief would be sent securely to a partner mortgage broker, who typically returns a pre-approval within 24 hours.",
    });
  }

  try {
    const res = await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ brief, status: "New Pre-Approval Referral" }),
    });
    if (!res.ok) throw new Error("Broker CRM rejected the brief");
    return NextResponse.json({
      success: true,
      brokerRef,
      isMock: false,
      message: "Your brief has been sent to a partner mortgage broker — expect a pre-approval within ~24 hours.",
    });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "Failed to reach broker" },
      { status: 502 },
    );
  }
}
