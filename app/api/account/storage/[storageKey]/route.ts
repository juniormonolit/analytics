import { NextResponse, type NextRequest } from "next/server";

import {
  readAccountPayload,
  writeAccountPayload,
} from "@/lib/accountStorage/server";
import { getSessionUser } from "@/lib/auth/session";

type RouteContext = {
  params: Promise<{ storageKey: string }>;
};

export async function GET(_request: NextRequest, context: RouteContext) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { storageKey } = await context.params;
  try {
    const payload = await readAccountPayload(user.userKey, storageKey);
    return NextResponse.json({ payload });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to read storage";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, context: RouteContext) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { storageKey } = await context.params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body || typeof body !== "object" || !("payload" in body)) {
    return NextResponse.json({ error: "Missing payload" }, { status: 400 });
  }

  try {
    await writeAccountPayload(
      user.userKey,
      storageKey,
      (body as { payload: unknown }).payload as never,
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to write storage";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
