import { NextResponse } from 'next/server';

/**
 * Standardized API Response Helpers.
 * Eliminates redundant error formatting, HTTP status logic, and JSON serialization.
 */

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  details?: unknown;
  meta?: {
    page?: number;
    limit?: number;
    totalCount?: number;
    totalPages?: number;
    hasNextPage?: boolean;
    hasPrevPage?: boolean;
    [key: string]: unknown;
  };
}

export function apiSuccess<T>(data: T, meta?: ApiResponse<T>['meta'], status = 200) {
  return NextResponse.json(
    {
      success: true,
      data,
      ...(meta ? { meta } : {}),
    },
    { status }
  );
}

export function apiError(message: string, status = 500, details?: unknown) {
  return NextResponse.json(
    {
      success: false,
      error: message,
      ...(details ? { details } : {}),
    },
    { status }
  );
}

export function apiBadRequest(message = 'Invalid request parameters', details?: unknown) {
  return apiError(message, 400, details);
}

export function apiUnauthorized(message = 'Authentication required') {
  return apiError(message, 401);
}

export function apiForbidden(message = 'Insufficient permissions') {
  return apiError(message, 403);
}

export function apiNotFound(message = 'Resource not found') {
  return apiError(message, 404);
}

export function parsePaginationParams(url: URL, defaultLimit = 25, maxLimit = 100) {
  const pageParam = parseInt(url.searchParams.get('page') || '1', 10);
  const limitParam = parseInt(url.searchParams.get('limit') || String(defaultLimit), 10);

  const page = Math.max(1, isNaN(pageParam) ? 1 : pageParam);
  const limit = Math.min(maxLimit, Math.max(1, isNaN(limitParam) ? defaultLimit : limitParam));
  const skip = (page - 1) * limit;

  return { page, limit, skip };
}
