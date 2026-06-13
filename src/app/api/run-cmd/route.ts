import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const cmd = req.nextUrl.searchParams.get('cmd');
  if (!cmd) {
    return NextResponse.json({ error: 'cmd is required' });
  }

  return new Promise((resolve) => {
    // Run command in the project directory
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
