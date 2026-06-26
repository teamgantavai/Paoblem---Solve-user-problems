import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin, logAdminAction } from '@/lib/adminAuth';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

const SETTINGS_FILE_PATH = path.join(process.cwd(), 'scratch', 'platform_settings.json');

const DEFAULT_SETTINGS = {
  platformName: 'Paoblem',
  logoUrl: '/logo.svg',
  faviconUrl: '/favicon.ico',
  maintenanceMode: false,
  defaultQualityScoreSettings: {
    upvoteWeight: 3.0,
    commentWeight: 5.0,
    saveWeight: 8.0,
    shareWeight: 10.0,
    reportWeight: -15.0,
  },
  aiModerationSettings: {
    autoModerate: false,
    flagThreshold: 0.75,
    openaiModel: 'openai/gpt-oss-120b',
  },
  emailConfiguration: {
    sender: 'Paoblem <noreply@paoblem.com>',
    provider: 'resend',
  },
  featureFlags: {
    allowNewSignups: true,
    chatEnabled: true,
    qualityBadgesVisible: true,
  },
};

function readSettings() {
  try {
    if (!fs.existsSync(SETTINGS_FILE_PATH)) {
      const dir = path.dirname(SETTINGS_FILE_PATH);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(SETTINGS_FILE_PATH, JSON.stringify(DEFAULT_SETTINGS, null, 2));
      return DEFAULT_SETTINGS;
    }
    const data = fs.readFileSync(SETTINGS_FILE_PATH, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error('[Admin Settings] Error reading settings file, returning defaults:', err);
    return DEFAULT_SETTINGS;
  }
}

function writeSettings(settings: any) {
  const dir = path.dirname(SETTINGS_FILE_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(SETTINGS_FILE_PATH, JSON.stringify(settings, null, 2));
}

// GET settings
export async function GET(req: NextRequest) {
  try {
    await verifyAdmin(req);
    const settings = readSettings();
    return NextResponse.json({ settings });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Access Denied' }, { status: 403 });
  }
}

// PUT settings updates
export async function PUT(req: NextRequest) {
  try {
    const admin = await verifyAdmin(req);
    const body = await req.json();
    const { settings: newSettings } = body;

    if (!newSettings) {
      return NextResponse.json({ error: 'Missing settings payload' }, { status: 400 });
    }

    const currentSettings = readSettings();
    const updatedSettings = {
      ...currentSettings,
      ...newSettings,
      defaultQualityScoreSettings: {
        ...currentSettings.defaultQualityScoreSettings,
        ...(newSettings.defaultQualityScoreSettings || {}),
      },
      aiModerationSettings: {
        ...currentSettings.aiModerationSettings,
        ...(newSettings.aiModerationSettings || {}),
      },
      emailConfiguration: {
        ...currentSettings.emailConfiguration,
        ...(newSettings.emailConfiguration || {}),
      },
      featureFlags: {
        ...currentSettings.featureFlags,
        ...(newSettings.featureFlags || {}),
      },
    };

    writeSettings(updatedSettings);

    await logAdminAction(admin.id, 'update_platform_settings', 'settings', 'global', {
      changes: newSettings,
    });

    return NextResponse.json({ success: true, settings: updatedSettings });
  } catch (err: any) {
    console.error('[Admin Settings API] PUT Error:', err);
    return NextResponse.json({ error: err.message || 'Update failed' }, { status: 500 });
  }
}
