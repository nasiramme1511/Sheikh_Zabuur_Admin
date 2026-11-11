import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const ROLES = [
  {
    id: 'SUPER_ADMIN',
    name: 'Super Administrator',
    description: 'Unrestricted administrative access to all systems, users, settings, and release pipelines.',
  },
  {
    id: 'ADMIN',
    name: 'Administrator',
    description: 'Full administrative access across content, media, branding, and operations, excluding role definition.',
  },
  {
    id: 'CONTENT_MANAGER',
    name: 'Content Manager',
    description: 'Manages modules, categories, audio recordings, PDF documents, and catalog publication reviews.',
  },
  {
    id: 'AUDIO_MANAGER',
    name: 'Audio Manager',
    description: 'Dedicated audio engineer role for uploading, editing, replacing, and organizing audio recordings.',
  },
  {
    id: 'PDF_MANAGER',
    name: 'PDF Manager',
    description: 'Manages Kitāb PDF documents, multi-volume associations, page metadata, and document replacements.',
  },
  {
    id: 'PUBLISHER',
    name: 'Publisher',
    description: 'Authorized to compile, validate, publish, and rollback production catalog releases.',
  },
  {
    id: 'NOTIFICATION_MANAGER',
    name: 'Notification Manager',
    description: 'Manages in-app announcements and broadcasts push notification campaigns.',
  },
  {
    id: 'VIEWER',
    name: 'Viewer',
    description: 'Read-only access across the catalog, audio library, PDF documents, and system metrics.',
  },
];

export const PERMISSIONS = [
  // 1. Catalog & Taxonomy
  { id: 'catalog:view', name: 'View Catalog', module: 'CATALOG', description: 'View modules, categories, and published catalog releases.' },
  { id: 'catalog:edit', name: 'Edit Catalog', module: 'CATALOG', description: 'Create and update curriculum modules and category taxonomies.' },
  { id: 'catalog:publish', name: 'Publish Catalog', module: 'CATALOG', description: 'Compile, validate, and publish production catalog releases.' },
  { id: 'catalog:rollback', name: 'Rollback Catalog', module: 'CATALOG', description: 'Rollback to a previously published catalog release.' },
  { id: 'modules:manage', name: 'Manage Modules', module: 'CATALOG', description: 'Create, update, reorder, and safely delete content modules.' },
  { id: 'categories:manage', name: 'Manage Categories', module: 'CATALOG', description: 'Create, update, reorder, and safely delete category nodes.' },

  // 2. Audio Recordings & Media
  { id: 'tracks:view', name: 'View Tracks', module: 'AUDIO', description: 'Browse, search, filter, and preview audio recordings.' },
  { id: 'tracks:upload', name: 'Upload Audio', module: 'AUDIO', description: 'Upload single or batch audio files to cloud storage.' },
  { id: 'tracks:edit', name: 'Edit Tracks', module: 'AUDIO', description: 'Modify titles, translations, track numbers, and metadata.' },
  { id: 'tracks:replace', name: 'Replace Audio File', module: 'AUDIO', description: 'Replace an existing audio file with a new mastered recording.' },
  { id: 'tracks:bulk', name: 'Bulk Edit Tracks', module: 'AUDIO', description: 'Perform bulk metadata updates across multiple recordings.' },
  { id: 'tracks:delete', name: 'Delete & Archive Tracks', module: 'AUDIO', description: 'Archive, restore, or delete draft audio recordings.' },

  // 3. PDF Kitāb & Document Management
  { id: 'pdf:view', name: 'View PDF Documents', module: 'PDF', description: 'Browse, preview, and download Kitāb PDF documents and volumes.' },
  { id: 'pdf:upload', name: 'Upload PDF Documents', module: 'PDF', description: 'Upload PDF files and associate them with modules and categories.' },
  { id: 'pdf:edit', name: 'Edit PDF Documents', module: 'PDF', description: 'Update document metadata, volume titles, and page counts.' },
  { id: 'pdf:delete', name: 'Delete & Archive PDFs', module: 'PDF', description: 'Archive, restore, or safely delete Kitāb PDF documents.' },

  // 4. App Branding & Assets
  { id: 'branding:view', name: 'View App Branding', module: 'BRANDING', description: 'View active branding assets, color schemes, and banner campaigns.' },
  { id: 'branding:manage', name: 'Manage App Branding', module: 'BRANDING', description: 'Upload logos, banners, launcher icons, and activate branding versions.' },

  // 5. Communications & Push
  { id: 'announcements:manage', name: 'Manage Announcements', module: 'COMMUNICATION', description: 'Create, edit, schedule, and retire in-app announcements.' },
  { id: 'notifications:manage', name: 'Manage Push Notifications', module: 'COMMUNICATION', description: 'Broadcast push notifications and inspect delivery metrics.' },

  // 6. Security, Users & System
  { id: 'users:manage', name: 'Manage Admin Users', module: 'SECURITY', description: 'Invite, edit, activate, deactivate accounts, and revoke sessions.' },
  { id: 'roles:manage', name: 'Manage Roles', module: 'SECURITY', description: 'Define custom administrative roles and assign permission policies.' },
  { id: 'audit:view', name: 'View Audit Logs', module: 'SECURITY', description: 'Inspect tamper-evident system audit trail and user activities.' },
  { id: 'settings:manage', name: 'Manage System Settings', module: 'SYSTEM', description: 'Configure mobile flags, version gates, and storage settings.' },
];

export const ROLE_PERMISSIONS: Record<string, string[]> = {
  SUPER_ADMIN: PERMISSIONS.map((p) => p.id),

  ADMIN: [
    'catalog:view', 'catalog:edit', 'catalog:publish', 'catalog:rollback', 'modules:manage', 'categories:manage',
    'tracks:view', 'tracks:upload', 'tracks:edit', 'tracks:replace', 'tracks:bulk', 'tracks:delete',
    'pdf:view', 'pdf:upload', 'pdf:edit', 'pdf:delete',
    'branding:view', 'branding:manage',
    'announcements:manage', 'notifications:manage',
    'users:manage', 'audit:view', 'settings:manage',
  ],

  CONTENT_MANAGER: [
    'catalog:view', 'catalog:edit', 'modules:manage', 'categories:manage',
    'tracks:view', 'tracks:upload', 'tracks:edit', 'tracks:replace', 'tracks:bulk', 'tracks:delete',
    'pdf:view', 'pdf:upload', 'pdf:edit', 'pdf:delete',
    'branding:view',
    'announcements:manage',
    'audit:view',
  ],

  AUDIO_MANAGER: [
    'catalog:view',
    'tracks:view', 'tracks:upload', 'tracks:edit', 'tracks:replace', 'tracks:bulk', 'tracks:delete',
  ],

  PDF_MANAGER: [
    'catalog:view',
    'pdf:view', 'pdf:upload', 'pdf:edit', 'pdf:delete',
  ],

  PUBLISHER: [
    'catalog:view', 'catalog:publish', 'catalog:rollback',
    'tracks:view',
    'pdf:view',
    'audit:view',
  ],

  NOTIFICATION_MANAGER: [
    'announcements:manage',
    'notifications:manage',
    'audit:view',
  ],

  VIEWER: [
    'catalog:view',
    'tracks:view',
    'pdf:view',
    'branding:view',
    'audit:view',
  ],
};

async function main() {
  console.log('🌱 Seeding Advanced RBAC (8 Roles & Granular Permissions)...');

  // 1. Upsert Roles
  for (const role of ROLES) {
    await prisma.adminRole.upsert({
      where: { id: role.id },
      update: { name: role.name, description: role.description },
      create: role,
    });
  }
  console.log(`✅ Upserted ${ROLES.length} administrative roles.`);

  // 2. Upsert Permissions
  for (const perm of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { id: perm.id },
      update: { name: perm.name, description: perm.description, module: perm.module },
      create: perm,
    });
  }
  console.log(`✅ Upserted ${PERMISSIONS.length} granular permissions.`);

  // 3. Connect Role-Permissions using batch create
  const rolePermissionData: { roleId: string; permissionId: string }[] = [];
  for (const [roleId, permIds] of Object.entries(ROLE_PERMISSIONS)) {
    for (const permissionId of permIds) {
      rolePermissionData.push({ roleId, permissionId });
    }
  }

  const { count: linkedCount } = await prisma.rolePermission.createMany({
    data: rolePermissionData,
    skipDuplicates: true,
  });
  console.log(`✅ Synchronized ${linkedCount} role-permission mappings.`);

  // 4. Initialize Default System Settings if missing
  const defaultSettings = [
    { key: 'app_version', value: '2.0.0', description: 'Current production mobile app version', isPublic: true },
    { key: 'min_supported_version', value: '1.0.0', description: 'Minimum supported mobile app build', isPublic: true },
    { key: 'maintenance_mode', value: 'false', description: 'When true, mobile apps display maintenance screen', isPublic: true },
    { key: 'maintenance_message', value: 'Sheikh Zabuur service is undergoing brief scheduled maintenance. Please check back shortly.', description: 'Message shown during maintenance', isPublic: true },
    { key: 'offline_downloads_enabled', value: 'true', description: 'Allow users to download audio tracks and PDFs for offline use', isPublic: true },
    { key: 'catalog_auto_update', value: 'true', description: 'Automatically check and sync catalog on app foreground', isPublic: true },
    { key: 'announcements_enabled', value: 'true', description: 'Enable in-app announcement banners on mobile feed', isPublic: true },
    { key: 'storage_provider', value: 'cloudflare-r2', description: 'Active cloud object storage provider', isPublic: false },
    { key: 'cdn_base_url', value: 'https://cdn.sheikhzabur.com', description: 'Base CDN URL for audio streaming and downloads', isPublic: true },
  ];

  for (const s of defaultSettings) {
    await prisma.systemSetting.upsert({
      where: { key: s.key },
      update: {},
      create: s,
    });
  }
  console.log(`✅ Initialized ${defaultSettings.length} system settings.`);

  // 5. Seed Initial AppBranding if not exists
  const existingBranding = await prisma.appBranding.findFirst({ where: { isCurrent: true } });
  if (!existingBranding) {
    await prisma.appBranding.create({
      data: {
        version: '1.0.0',
        appName: 'Sheikh Zabuur',
        tagline: 'Comprehensive Islamic Audio Library & Kitāb Collections',
        primaryColor: '#006B4F',
        secondaryColor: '#D97706',
        inAppLogoUrl: '/brand/logo.png',
        logoEmblemUrl: '/brand/emblem.png',
        splashScreenUrl: '/brand/splash.png',
        loginArtworkUrl: '/brand/artwork.png',
        androidLauncherIconUrl: '/brand/icon-android.png',
        iosAppIconUrl: '/brand/icon-ios.png',
        isCurrent: true,
        bannerUrls: [
          {
            id: 'banner-welcome',
            title: 'Welcome to Sheikh Zabuur Audio Library',
            imageUrl: '/brand/banners/welcome.png',
            linkUrl: '/library',
          },
        ],
      },
    });
    console.log('✅ Seeded baseline production branding (v1.0.0).');
  }

  console.log('✨ Advanced RBAC & System Configuration seeding completed.');
}

main()
  .catch((e) => {
    console.error('❌ Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
