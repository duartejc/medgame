import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

export const runtime = "nodejs";

// Protótipo: grava leads em data/leads.json.
// Em produção, troque por Supabase + webhook para o CRM.
export async function POST(req: NextRequest) {
  try {
    const lead = await req.json();
    const dir = path.join(process.cwd(), "data");
    const file = path.join(dir, "leads.json");
    await fs.mkdir(dir, { recursive: true });

    let leads: unknown[] = [];
    try {
      leads = JSON.parse(await fs.readFile(file, "utf8"));
    } catch {
      leads = [];
    }
    leads.push({ ...lead, createdAt: new Date().toISOString() });
    await fs.writeFile(file, JSON.stringify(leads, null, 2));

    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
