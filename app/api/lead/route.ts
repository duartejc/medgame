import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

export const runtime = "nodejs";

// Grava leads em:
// - Cloudflare KV (produção no CF Pages)
// - data/leads.json (desenvolvimento local)
// Em produção, adicione webhook para o CRM

interface Lead {
  email?: string;
  role?: string;
  specialty?: string;
  lastScore?: number;
  lastOutcome?: string;
  createdAt: string;
}

export async function POST(req: NextRequest) {
  try {
    const leadData = await req.json();
    const lead: Lead = { ...leadData, createdAt: new Date().toISOString() };

    // Tenta usar Cloudflare KV (se disponível via env)
    const kv = (globalThis as any).LEADS_KV;
    if (kv) {
      // Cloudflare Pages/Workers com KV binding
      const key = `lead-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      await kv.put(key, JSON.stringify(lead), {
        expirationTtl: 90 * 24 * 60 * 60, // 90 dias
      });
      return NextResponse.json({ ok: true, storage: "kv" });
    }

    // Fallback: grava localmente (desenvolvimento)
    const dir = path.join(process.cwd(), "data");
    const file = path.join(dir, "leads.json");
    await fs.mkdir(dir, { recursive: true });

    let leads: Lead[] = [];
    try {
      leads = JSON.parse(await fs.readFile(file, "utf8"));
    } catch {
      leads = [];
    }
    leads.push(lead);
    await fs.writeFile(file, JSON.stringify(leads, null, 2));

    return NextResponse.json({ ok: true, storage: "local" });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao salvar lead";
    console.error("Lead save error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
