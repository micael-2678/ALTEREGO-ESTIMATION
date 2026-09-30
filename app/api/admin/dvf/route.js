import { NextResponse } from 'next/server';
import { getDVFStats, startDVFIngestion, getIngestionState, clearDVFData } from '../../../../lib/dvf-admin';
import { json, serverError, corsHeadersFor, requireAdmin } from '../../../../lib/api-helpers';

export async function OPTIONS(request) {
  return new NextResponse(null, { status: 204, headers: corsHeadersFor(request) });
}

// GET - Statistiques et statut
export async function GET(request) {
  const denied = requireAdmin(request);
  if (denied) return denied;

  const action = new URL(request.url).searchParams.get('action');

  try {
    if (action === 'stats' || !action) {
      return json(request, await getDVFStats());
    }
    if (action === 'status') {
      return json(request, getIngestionState());
    }
    return json(request, { error: 'Invalid action' }, 400);
  } catch (error) {
    return serverError(request, error);
  }
}

// POST - Actions (start, clear)
export async function POST(request) {
  const denied = requireAdmin(request);
  if (denied) return denied;

  const action = new URL(request.url).searchParams.get('action');

  try {
    if (action === 'start') {
      try {
        return json(request, await startDVFIngestion());
      } catch (error) {
        return json(request, { error: error.message }, 400);
      }
    }
    if (action === 'clear') {
      return json(request, await clearDVFData());
    }
    return json(request, { error: 'Invalid action' }, 400);
  } catch (error) {
    return serverError(request, error);
  }
}
