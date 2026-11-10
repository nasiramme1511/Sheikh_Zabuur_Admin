import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const ROLES = [
  {
    id: 'SUPER_ADMIN',
    name: 'Super Administrator',
    description: 'Unrestricted administrative access to all systems, users, and release pipelines.',
  },
  {
    id: 'CONTENT_MANAGER',
    name: 'Content Manager',
    description: 'Manages modules, categories, tracks, and audio uploads. Can trigger catalog releases.',
  },
  {
    id: 'EDITOR',
    name: 'Editor',
    description: 'Edits audio metadata, Amharic/Arabic titles, and transliterations. Can upload draft media.',
  },
  {
    id: 'VIEWER',
    name: 'Viewer',
    description: 'Read-only access to catalog items, releases, and operational dashboards.',
  },
];

const PERMISSIONS = [
  // Catalog & Releases
  { id: 'catalog:view', name: 'View Catalog', module: 'CATALOG', description: 'View modules, categories, and published releases.' },
  { id: 'catalog:edit', name: 'Edit Catalog', module: 'CATALOG', description: 'Create and update modules and categories.' },
  { id: 'catalog:publish', name: 'Publish Catalog', module: 'CATALOG', description: 'Compile and publish production catalog releases.' },
  { id: 'catalog:rollback', name: 'Rollback Catalog', module: 'CATALOG', description: 'Restore a previous catalog release as active.' },

  // Audio Tracks & Media
  { id: 'tracks:view', name: 'View Tracks', module: 'MEDIA', description: 'Browse and search audio recordings.' },
  { id: 'tracks:edit', name: 'Edit Tracks', module: 'MEDIA', description: 'Modify titles, track numbers, and metadata.' },
  { id: 'tracks:upload', name: 'Upload Audio', module: 'MEDIA', description: 'Upload audio files and generate presigned URLs.' },
  { id: 'tracks:delete', name: 'Delete Tracks', module: 'MEDIA', description: 'Archive or unpublish audio tracks.' },

  // Announcements & Notifications
  { id: 'announcements:manage', name: 'Manage Announcements', module: 'COMMUNICATION', description: 'Create and schedule system banners.' },
  { id: 'notifications:manage', name: 'Manage Push Notifications', module: 'COMMUNICATION', description: 'Broadcast push notifications to devices.' },

  // User Management & Security
  { id: 'users:manage', name: 'Manage Users', module: 'SECURITY', description: 'Invite, edit, activate, and deactivate admin accounts.' },
  { id: 'roles:manage', name: 'Manage Roles', module: 'SECURITY', description: 'Configure role permissions and access levels.' },
  { id: 'audit:view', name: 'View Audit Logs', module: 'SECURITY', description: 'Inspect audit trail and security event history.' },
  { id: 'settings:manage', name: 'Manage System Settings', module: 'SYSTEM', description: 'Update platform flags and mobile version limits.' },
];

// Mapping permissions to roles
const ROLE_PERMISSIONS: Record<string, string[]> = {
  SUPER_ADMIN: PERMISSIONS.map((p) => p.id),
  CONTENT_MANAGER: [
    'catalog:view',
    'catalog:edit',
    'catalog:publish',
    'tracks:view',
    'tracks:edit',
    'tracks:upload',
    'tracks:delete',
    'announcements:manage',
    'notifications:manage',
  ],
  EDITOR: [
    'catalog:view',
    'tracks:view',
    'tracks:edit',
    'tracks:upload',
  ],
  VIEWER: [
    'catalog:view',
    'tracks:view',
  ],
};

async function main() {
  console.log('🌱 Seeding RBAC Roles and Permissions...');

  // 1. Upsert Roles
  for (const role of ROLES) {
    await prisma.adminRole.upsert({
      where: { id: role.id },
      update: { name: role.name, description: role.description },
      create: role,
    });
  }
  console.log(`✅ Upserted ${ROLES.length} roles.`);

  // 2. Upsert Permissions
  for (const perm of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { id: perm.id },
      update: { name: perm.name, description: perm.description, module: perm.module },
      create: perm,
    });
  }
  console.log(`✅ Upserted ${PERMISSIONS.length} permissions.`);

  // 3. Connect Role-Permissions
  let linkedCount = 0;
  for (const [roleId, permIds] of Object.entries(ROLE_PERMISSIONS)) {
    for (const permissionId of permIds) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: { roleId, permissionId },
        },
        update: {},
        create: { roleId, permissionId },
      });
      linkedCount++;
    }
  }
  console.log(`✅ Linked ${linkedCount} role-permission mappings.`);
  console.log('✨ RBAC seeding completed successfully.');
}

main()
  .catch((e) => {
    console.error('❌ Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

