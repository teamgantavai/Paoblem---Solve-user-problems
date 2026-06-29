import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json({ error: 'Solutions have been removed.' }, { status: 410 });
}
