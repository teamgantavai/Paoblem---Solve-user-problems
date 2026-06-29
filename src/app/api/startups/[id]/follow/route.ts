import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json({ error: 'Follow feature has been removed. Use Star feature instead.' }, { status: 410 });
}

export async function DELETE() {
  return NextResponse.json({ error: 'Follow feature has been removed. Use Star feature instead.' }, { status: 410 });
}
