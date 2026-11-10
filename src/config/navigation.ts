import {
  Bell,
  ClipboardList,
  FolderTree,
  Layers,
  LayoutDashboard,
  Music,
  Send,
  Settings,
  ShieldAlert,
  Tags,
  UploadCloud,
  Users,
} from 'lucide-react';
import React from 'react';

export interface NavItemConfig {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  requiredPermission?: string;
  group: 'content' | 'operations' | 'system';
}

export const APP_NAVIGATION: NavItemConfig[] = [
  // Content Tier
  {
    name: 'Overview',
    href: '/',
    icon: LayoutDashboard,
    description: 'System overview and catalog metrics',
    group: 'content',
  },
  {
    name: 'Audio Library',
    href: '/library',
    icon: Music,
    description: 'Browse, search, and edit audio track metadata',
    requiredPermission: 'tracks:read',
    group: 'content',
  },
  {
    name: 'Modules',
    href: '/modules',
    icon: FolderTree,
    description: 'Curriculum module hierarchy',
    requiredPermission: 'modules:read',
    group: 'content',
  },
  {
    name: 'Categories',
    href: '/categories',
    icon: Tags,
    description: 'Nested category taxonomy and ordering',
    requiredPermission: 'categories:read',
    group: 'content',
  },
  {
    name: 'Upload Center',
    href: '/upload',
    icon: UploadCloud,
    description: 'Direct-to-cloud audio file upload pipeline',
    requiredPermission: 'tracks:upload',
    group: 'content',
  },
  {
    name: 'Catalog Releases',
    href: '/releases',
    icon: Layers,
    description: 'Compile, publish, and rollback mobile catalog releases',
    requiredPermission: 'releases:read',
    group: 'content',
  },

  // Operations Tier
  {
    name: 'Announcements',
    href: '/announcements',
    icon: Bell,
    description: 'Schedule in-app notices for mobile users',
    requiredPermission: 'announcements:read',
    group: 'operations',
  },
  {
    name: 'Push Notifications',
    href: '/push',
    icon: Send,
    description: 'Broadcast notifications to mobile devices',
    requiredPermission: 'push:read',
    group: 'operations',
  },

  // System & Administration Tier
  {
    name: 'Admin Users',
    href: '/users',
    icon: Users,
    description: 'Manage staff administrator accounts',
    requiredPermission: 'users:read',
    group: 'system',
  },
  {
    name: 'Roles & Permissions',
    href: '/roles',
    icon: ShieldAlert,
    description: 'RBAC domain permission matrix',
    requiredPermission: 'roles:read',
    group: 'system',
  },
  {
    name: 'Audit Logs',
    href: '/audit',
    icon: ClipboardList,
    description: 'Security audit trail and changeset inspector',
    requiredPermission: 'audit:read',
    group: 'system',
  },
  {
    name: 'System Settings',
    href: '/settings',
    icon: Settings,
    description: 'Client configuration and feature toggles',
    requiredPermission: 'settings:read',
    group: 'system',
  },
];

export const APP_METADATA = {
  name: 'Sheikh Zabuur',
  subtitle: 'Admin Platform',
  fullTitle: 'Islamic Audio Administration Platform',
  version: '1.0.0',
  apiStatus: 'Healthy',
};
