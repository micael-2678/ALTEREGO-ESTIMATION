import { NextResponse } from 'next/server';
import { connectToDatabase, getCollection } from '../../../lib/mongodb';
import { getDVFComparables } from '../../../lib/dvf';
import { getAdaptiveComparables } from '../../../lib/dvf-enhanced';
import { ingestDVFDepartment } from '../../../lib/dvf-ingestion';
import { scrapeSeLoger, calculateMarketStats } from '../../../lib/scraper';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret';
const ADMIN_USERNAME = process.env.ADMIN_USERNAME;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function GET(request) {
  const { pathname, searchParams } = new URL(request.url);

  try {
    // Root endpoint
    if (pathname === '/api/' || pathname === '/api') {
      return NextResponse.json(
        { message: 'AlterEgo API is running', version: '1.0.0' },
        { headers: corsHeaders }
      );
    }

    // Geocode address using French government BAN API
    if (pathname === '/api/geo/resolve') {
      const address = searchParams.get('address');
      
      if (!address) {
        return NextResponse.json(
          { error: 'Address is required' },
          { status: 400, headers: corsHeaders }
        );
      }
      
      const response = await fetch(
        `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(address)}&limit=5`
      );
      const data = await response.json();
      
      if (data.features && data.features.length > 0) {
        const suggestions = data.features.map(f => ({
          address: f.properties.label,
          lat: f.geometry.coordinates[1],
          lng: f.geometry.coordinates[0],
          city: f.properties.city,
          postalCode: f.properties.postcode
        }));
        
        return NextResponse.json(
          { suggestions },
          { headers: corsHeaders }
        );
      }
      
      return NextResponse.json(
        { error: 'Address not found' },
        { status: 404, headers: corsHeaders }
      );
    }

    // Get DVF comparables (Enhanced with adaptive algorithm)
    if (pathname === '/api/dvf/comparables') {
      const lat = parseFloat(searchParams.get('lat'));
      const lng = parseFloat(searchParams.get('lng'));
      const type = searchParams.get('type');
      const surface = parseFloat(searchParams.get('surface'));
      const radiusMeters = parseInt(searchParams.get('radiusMeters')) || 500;
      const months = parseInt(searchParams.get('months')) || 24;
      
      if (!lat || !lng || !type || !surface) {
        return NextResponse.json(
          { error: 'Missing required parameters' },
          { status: 400, headers: corsHeaders }
        );
      }
      
      // Use enhanced adaptive algorithm
      const result = await getAdaptiveComparables({
        lat,
        lng,
        type,
        surface,
        initialRadiusMeters: radiusMeters,
        maxRadiusMeters: 800,
        months,
        maxMonths: 36,
        minComparables: 8
      });
      
      return NextResponse.json(result, { headers: corsHeaders });
    }

    // Get active market listings
    if (pathname === '/api/market/listings') {
      const address = searchParams.get('address');
      const lat = parseFloat(searchParams.get('lat'));
      const lng = parseFloat(searchParams.get('lng'));
      const type = searchParams.get('type');
      const surface = parseFloat(searchParams.get('surface'));
      
      if (!address || !lat || !lng || !type || !surface) {
        return NextResponse.json(
          { error: 'Missing required parameters' },
          { status: 400, headers: corsHeaders }
        );
      }
      
      try {
        const listings = await scrapeSeLoger({ address, lat, lng, type, surface });
        const stats = calculateMarketStats(listings);
        
        return NextResponse.json(
          { listings: listings.slice(0, 20), stats },
          { headers: corsHeaders }
        );
      } catch (error) {
        console.error('Market scraping error:', error);
        return NextResponse.json(
          { error: 'Failed to fetch market listings', listings: [], stats: null },
          { status: 200, headers: corsHeaders }
        );
      }
    }

    // Get all leads (admin)
    if (pathname === '/api/leads') {
      const authHeader = request.headers.get('authorization');
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401, headers: corsHeaders }
        );
      }
      
      try {
        jwt.verify(authHeader.split(' ')[1], JWT_SECRET);
      } catch {
        return NextResponse.json(
          { error: 'Invalid token' },
          { status: 401, headers: corsHeaders }
        );
      }
      
      const collection = await getCollection('leads');
      const leads = await collection.find({}).sort({ createdAt: -1 }).toArray();
      
      return NextResponse.json({ leads }, { headers: corsHeaders });
    }

    // Get DVF ingestion status (admin)
    if (pathname === '/api/admin/dvf/status') {
      const authHeader = request.headers.get('authorization');
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401, headers: corsHeaders }
        );
      }
      
      try {
        jwt.verify(authHeader.split(' ')[1], JWT_SECRET);
      } catch {
        return NextResponse.json(
          { error: 'Invalid token' },
          { status: 401, headers: corsHeaders }
        );
      }
      
      const collection = await getCollection('dvf_sales');
      
      // Get statistics per department
      const pipeline = [
        {
          $group: {
            _id: '$code_departement',
            count: { $sum: 1 },
            appartements: {
              $sum: { $cond: [{ $eq: ['$type_local', 'appartement'] }, 1, 0] }
            },
            maisons: {
              $sum: { $cond: [{ $eq: ['$type_local', 'maison'] }, 1, 0] }
            },
            lastImport: { $max: '$imported_at' }
          }
        },
        { $sort: { _id: 1 } }
      ];
      
      const stats = await collection.aggregate(pipeline).toArray();
      const total = await collection.countDocuments({});
      
      return NextResponse.json({ 
        total, 
        byDepartment: stats 
      }, { headers: corsHeaders });
    }

    return NextResponse.json(
      { error: 'Not found' },
      { status: 404, headers: corsHeaders }
    );
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function POST(request) {
  const { pathname } = new URL(request.url);

  try {
    // Admin login
    if (pathname === '/api/auth/login') {
      const { username, password } = await request.json();
      
      if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
        const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: '24h' });
        
        return NextResponse.json(
          { token, user: { username } },
          { headers: corsHeaders }
        );
      }
      
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401, headers: corsHeaders }
      );
    }

    // Submit lead
    if (pathname === '/api/leads') {
      const leadData = await request.json();
      
      const lead = {
        id: uuidv4(),
        ...leadData,
        createdAt: new Date().toISOString()
      };
      
      const collection = await getCollection('leads');
      await collection.insertOne(lead);
      
      return NextResponse.json(
        { success: true, leadId: lead.id },
        { headers: corsHeaders }
      );
    }

    // Full estimation (DVF + Market)
    if (pathname === '/api/estimate') {
      const { address, lat, lng, type, surface, characteristics } = await request.json();
      
      if (!address || !lat || !lng || !type || !surface) {
        return NextResponse.json(
          { error: 'Missing required parameters' },
          { status: 400, headers: corsHeaders }
        );
      }
      
      // Get DVF comparables
      const dvfResult = await getDVFComparables({
        lat,
        lng,
        type,
        surface,
        radiusMeters: 1000,
        months: 24
      });
      
      // Get market listings
      let marketResult = { listings: [], stats: null };
      try {
        const listings = await scrapeSeLoger({ address, lat, lng, type, surface });
        marketResult = {
          listings: listings.slice(0, 20),
          stats: calculateMarketStats(listings)
        };
      } catch (error) {
        console.error('Market scraping failed:', error);
      }
      
      // Calculate delta
      let delta = null;
      if (dvfResult.stats && marketResult.stats) {
        const dvfPrice = dvfResult.stats.weightedAverage;
        const marketPrice = marketResult.stats.medianPricePerM2;
        delta = ((marketPrice - dvfPrice) / dvfPrice * 100).toFixed(1);
      }
      
      return NextResponse.json(
        {
          dvf: dvfResult,
          market: marketResult,
          delta,
          estimatedValue: dvfResult.stats ? Math.round(dvfResult.stats.weightedAverage * surface) : null
        },
        { headers: corsHeaders }
      );
    }

    return NextResponse.json(
      { error: 'Not found' },
      { status: 404, headers: corsHeaders }
    );
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500, headers: corsHeaders }
    );
  }
}