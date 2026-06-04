// Leegality v3 e-sign client.
//
// Flow:
//   1. POST /api/v3/invitation with PDF base64 + signers list.
//   2. Response gives `invitationId` and per-signer `signerLink` URL.
//   3. Persist on contracts (digio_document_id reused for invitationId,
//      influencer_signing_url, signing_expires_at).
//   4. Webhook (/api/webhooks/leegality) updates status when each signer signs.
//
// Auth: header `x-api-key: <LEEGALITY_API_KEY>`.
// Preprod host: https://preprod-gateway.leegality.com
// Prod host:    https://gateway.leegality.com
// Override via LEEGALITY_BASE_URL.

const DEFAULT_BASE = "https://preprod-gateway.leegality.com";

export type LeegalitySigner = {
  email: string;
  name: string;
  phone?: string;
  signatureType?: "AADHAAR" | "ELECTRONIC" | "VIRTUAL";
};

export type LeegalityInvitationRequest = {
  fileName: string;
  fileBase64: string; // raw base64, no data: prefix
  signers: LeegalitySigner[];
  expireInDays?: number;
  comment?: string;
  invitationName?: string;
};

export type LeegalitySignerLink = {
  email: string;
  name?: string;
  signerLink?: string;
  status?: string;
};

export type LeegalityInvitationResponse = {
  invitationId: string;
  status?: string;
  expiresOn?: string;
  signers: LeegalitySignerLink[];
};

function apiKey(): string {
  const k = process.env.LEEGALITY_API_KEY;
  if (!k) throw new Error("LEEGALITY_API_KEY not configured");
  return k;
}

function baseUrl(): string {
  return process.env.LEEGALITY_BASE_URL?.replace(/\/$/, "") || DEFAULT_BASE;
}

export async function createInvitation(
  req: LeegalityInvitationRequest,
): Promise<LeegalityInvitationResponse> {
  const body = {
    invitationName: req.invitationName ?? req.fileName,
    file: {
      fileName: req.fileName,
      fileData: req.fileBase64,
    },
    signers: req.signers.map((s, idx) => ({
      sequence: idx + 1,
      name: s.name,
      email: s.email,
      phone: s.phone,
      signatureType: s.signatureType ?? "AADHAAR",
      sendInvite: true,
    })),
    settings: {
      expireInDays: req.expireInDays ?? 14,
      comment: req.comment ?? "Please sign the influencer marketing contract.",
      sendEmailToSigners: true,
    },
  };

  const res = await fetch(`${baseUrl()}/api/v3/invitation`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey(),
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Leegality createInvitation failed (${res.status}): ${text}`);
  }
  const json = (await res.json()) as {
    invitationId?: string;
    id?: string;
    status?: string;
    expiresOn?: string;
    signers?: Array<{
      email?: string;
      name?: string;
      signerLink?: string;
      status?: string;
    }>;
  };

  const invitationId = json.invitationId ?? json.id;
  if (!invitationId) {
    throw new Error(`Leegality response missing invitationId: ${JSON.stringify(json)}`);
  }

  return {
    invitationId,
    status: json.status,
    expiresOn: json.expiresOn,
    signers: (json.signers ?? []).map((s) => ({
      email: s.email ?? "",
      name: s.name,
      signerLink: s.signerLink,
      status: s.status,
    })),
  };
}

// Fetch signed PDF download URL after completion.
export async function fetchSignedPdfUrl(invitationId: string): Promise<string | null> {
  const res = await fetch(
    `${baseUrl()}/api/v3/invitation/${encodeURIComponent(invitationId)}/document`,
    { headers: { "x-api-key": apiKey() } },
  );
  if (!res.ok) return null;
  const data = (await res.json()) as { signedFileUrl?: string; downloadUrl?: string };
  return data.signedFileUrl ?? data.downloadUrl ?? null;
}

// Webhook event payload (Leegality posts JSON with invitationId + event).
export type LeegalityWebhookEvent = {
  event: string; // INVITATION_SENT | INVITATION_SIGNED | INVITATION_COMPLETED | INVITATION_REJECTED | INVITATION_EXPIRED
  invitationId?: string;
  invitation?: {
    invitationId?: string;
    status?: string;
    signers?: Array<{ email?: string; status?: string }>;
  };
  signedFileUrl?: string;
};
