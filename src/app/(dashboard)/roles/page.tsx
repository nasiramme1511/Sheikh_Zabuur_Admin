'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldAlert,
  Shield,
  Lock,
  Loader2,
  RefreshCw,
  Save,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

interface PermissionItem {
  id: string;
  name: string;
  module: string;
  description?: string | null;
}

interface RoleItem {
  id: string;
  name: string;
  description?: string | null;
  userCount: number;
  permissions: string[];
}

export default function RolesPage() {
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [permissions, setPermissions] = useState<PermissionItem[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<string>('CONTENT_MANAGER');
  const [rolePermissions, setRolePermissions] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/admin/roles');
      if (!res.ok) throw new Error('Failed to load roles');
      const data = await res.json();
      setRoles(data.roles || []);
      setPermissions(data.permissions || []);

      const active = (data.roles || []).find((r: RoleItem) => r.id === selectedRoleId) || data.roles[0];
      if (active) {
        setSelectedRoleId(active.id);
        setRolePermissions(new Set(active.permissions));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedRoleId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSelectRole = (role: RoleItem) => {
    setSelectedRoleId(role.id);
    setRolePermissions(new Set(role.permissions));
    setStatusMessage(null);
  };

  const togglePermission = (pId: string) => {
    if (selectedRoleId === 'SUPER_ADMIN') return; // Immutable

    setRolePermissions((prev) => {
      const next = new Set(prev);
      if (next.has(pId)) {
        next.delete(pId);
      } else {
        next.add(pId);
      }
      return next;
    });
  };

  const handleSavePermissions = async () => {
    setIsSaving(true);
    setStatusMessage(null);
    try {
      const res = await fetch(`/api/admin/roles/${selectedRoleId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          permissions: Array.from(rolePermissions),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update permissions');

      setStatusMessage({ type: 'success', text: data.message });
      await fetchData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error updating permissions';
      setStatusMessage({ type: 'error', text: msg });
    } finally {
      setIsSaving(false);
    }
  };

  const activeRole = roles.find((r) => r.id === selectedRoleId);
  const isSuperAdmin = selectedRoleId === 'SUPER_ADMIN';

  // Group permissions by module
  const groupedPermissions: Record<string, PermissionItem[]> = {};
  for (const p of permissions) {
    if (!groupedPermissions[p.module]) {
      groupedPermissions[p.module] = [];
    }
    groupedPermissions[p.module].push(p);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2.5">
            <ShieldAlert className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            Roles & Permission Matrix (RBAC)
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Configure access control levels across catalog management, media uploads, push broadcasts, and system settings.
          </p>
        </div>

        <button
          onClick={fetchData}
          disabled={isLoading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition-colors self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {statusMessage && (
        <div
          className={`p-3 rounded-lg text-xs flex items-center gap-2 ${
            statusMessage.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 text-emerald-700 dark:text-emerald-300'
              : 'bg-red-50 dark:bg-red-950/50 border border-red-200 text-red-700 dark:text-red-300'
          }`}
        >
          {statusMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Role Selection Tabs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {roles.map((r) => {
          const isSelected = r.id === selectedRoleId;
          return (
            <div
              key={r.id}
              onClick={() => handleSelectRole(r)}
              className={`p-4 rounded-xl border transition-all cursor-pointer ${
                isSelected
                  ? 'bg-emerald-50/70 dark:bg-emerald-950/40 border-emerald-500 ring-2 ring-emerald-500/20 shadow-md'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 shadow-sm'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-emerald-600" />
                  {r.name}
                </span>
                {r.id === 'SUPER_ADMIN' && <Lock className="w-3.5 h-3.5 text-purple-600" />}
              </div>
              <p className="text-xs text-slate-500 line-clamp-2">{r.description}</p>
              <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-400 flex justify-between">
                <span>{r.userCount} assigned admin{r.userCount !== 1 ? 's' : ''}</span>
                <span>{r.permissions.length} permissions</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Permissions Matrix */}
      {activeRole && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="px-6 py-4 bg-slate-50/80 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  {activeRole.name} Permissions Matrix
                </h2>
                {isSuperAdmin && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 flex items-center gap-1">
                    <Lock className="w-3 h-3" />
                    Immutable Super Admin Role
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">{activeRole.description}</p>
            </div>

            {!isSuperAdmin && (
              <button
                type="button"
                onClick={handleSavePermissions}
                disabled={isSaving}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition-colors disabled:opacity-50"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    <span>Save Role Permissions</span>
                  </>
                )}
              </button>
            )}
          </div>

          <div className="p-6 space-y-6">
            {Object.entries(groupedPermissions).map(([moduleName, perms]) => (
              <div key={moduleName} className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 pb-1 border-b border-slate-100 dark:border-slate-800">
                  Module: {moduleName}
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {perms.map((p) => {
                    const isChecked = isSuperAdmin || rolePermissions.has(p.id);

                    return (
                      <div
                        key={p.id}
                        onClick={() => togglePermission(p.id)}
                        className={`p-3 rounded-lg border flex items-start gap-3 transition-colors ${
                          isChecked
                            ? 'border-emerald-200 bg-emerald-50/40 dark:border-emerald-900/60 dark:bg-emerald-950/20'
                            : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'
                        } ${isSuperAdmin ? 'cursor-not-allowed opacity-90' : 'cursor-pointer hover:border-slate-300'}`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}} // handled by parent div onClick
                          disabled={isSuperAdmin}
                          className="mt-0.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-xs text-slate-800 dark:text-slate-200">
                              {p.name}
                            </span>
                            <code className="text-[10px] font-mono text-slate-400">{p.id}</code>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5">{p.description}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
