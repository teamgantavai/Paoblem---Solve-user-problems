import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  const cmd = req.nextUrl.searchParams.get('cmd');
  if (!cmd) {
    return NextResponse.json({ error: 'cmd is required' });
  }

  return new Promise<Response>((resolve) => {
    const projectDir = 'd:\\Paoblem\\Paoblem';
    exec(cmd, { cwd: projectDir }, (error, stdout, stderr) => {
      resolve(
        NextResponse.json({
          cmd,
          stdout: stdout.toString(),
          stderr: stderr.toString(),
          error: error ? error.message : null,
        })
      );
    });
  });
}