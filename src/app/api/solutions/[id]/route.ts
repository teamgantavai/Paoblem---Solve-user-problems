import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ error: 'Solutions have been removed.' }, { status: 410 });
}
export async function PUT() {
  return NextResponse.json({ error: 'Solutions have been removed.' }, { status: 410 });
}
export async function DELETE() {
  return NextResponse.json({ error: 'Solutions have been removed.' }, { status: 410 });
}
