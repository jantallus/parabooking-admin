import { NextRequest, NextResponse } from 'next/server';

const API = process.env.NEXT_PUBLIC_API_URL || 'https://api.parabooking.app';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const res = await fetch(`${API}/api/public/fluide/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) return NextResponse.json({ error: 'Erreur serveur' }, { status: res.status });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
