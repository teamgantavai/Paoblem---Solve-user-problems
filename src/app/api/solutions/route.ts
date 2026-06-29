import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ error: 'Solutions have been removed. Use /api/startups instead.' }, { status: 410 });
}
export async function POST() {
  return NextResponse.json({ error: 'Solutions have been removed. Use /api/startups instead.' }, { status: 410 });
}
export async function PUT() {
  return NextResponse.json({ error: 'Solutions have been removed. Use /api/startups instead.' }, { status: 410 });
}
export async function DELETE() {
  return NextResponse.json({ error: 'Solutions have been removed. Use /api/startups instead.' }, { status: 410 });
}
