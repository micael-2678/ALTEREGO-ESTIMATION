import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { getDVFStats, startDVFIngestion, getIngestionState, clearDVFData } from '../../../../lib/dvf-admin';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret';

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// Vérifier l'authentification
function verifyAuth(request) {
  const authHeader = request.headers.get('authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { authorized: false, error: 'Unauthorized' };
  }
  
  try {
    jwt.verify(authHeader.split(' ')[1], JWT_SECRET);
    return { authorized: true };
  } catch {
    return { authorized: false, error: 'Invalid token' };
  }
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

// GET - Statistiques et statut
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');

  // Vérifier l'authentification
  const auth = verifyAuth(request);
  if (!auth.authorized) {
    return NextResponse.json(
      { error: auth.error },
      { status: 401, headers: corsHeaders }
    );
  }

  try {
    // GET stats
    if (action === 'stats' || !action) {
      const stats = await getDVFStats();
      return NextResponse.json(stats, { headers: corsHeaders });
    }

    // GET status
    if (action === 'status') {
      const state = getIngestionState();
      return NextResponse.json(state, { headers: corsHeaders });
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400, headers: corsHeaders }
    );
  } catch (error) {
    console.error('DVF Admin GET Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500, headers: corsHeaders }
    );
  }
}

// POST - Actions (start, clear)
export async function POST(request) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');

  // Vérifier l'authentification
  const auth = verifyAuth(request);
  if (!auth.authorized) {
    return NextResponse.json(
      { error: auth.error },
      { status: 401, headers: corsHeaders }
    );
  }

  try {
    // POST start ingestion
    if (action === 'start') {
      try {
        const result = await startDVFIngestion();
        return NextResponse.json(result, { headers: corsHeaders });
      } catch (error) {
        return NextResponse.json(
          { error: error.message },
          { status: 400, headers: corsHeaders }
        );
      }
    }

    // POST clear data
    if (action === 'clear') {
      const result = await clearDVFData();
      return NextResponse.json(result, { headers: corsHeaders });
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400, headers: corsHeaders }
    );
  } catch (error) {
    console.error('DVF Admin POST Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500, headers: corsHeaders }
    );
  }
}
