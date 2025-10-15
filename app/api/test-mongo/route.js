import { NextResponse } from 'next/server';
import { getCollection } from '@/lib/mongodb';

export async function GET() {
  try {
    console.log('[TEST-MONGO] Début du test de connexion...');
    console.log('[TEST-MONGO] MONGO_URL:', process.env.MONGO_URL);
    console.log('[TEST-MONGO] DB_NAME:', process.env.DB_NAME);
    
    const collection = await getCollection('dvf_sales');
    console.log('[TEST-MONGO] Collection obtenue');
    
    const count = await collection.countDocuments();
    console.log('[TEST-MONGO] Count:', count);
    
    const sample = await collection.findOne({
      latitude: { $exists: true },
      longitude: { $exists: true }
    });
    console.log('[TEST-MONGO] Sample trouvé');
    
    return NextResponse.json({
      success: true,
      message: 'Connexion MongoDB réussie',
      mongoUrl: process.env.MONGO_URL?.split('@')[1] || 'URL masquée',
      database: process.env.DB_NAME,
      collection: 'dvf_sales',
      count: count,
      sample: sample ? {
        commune: sample.commune,
        type: sample.type_local,
        surface: sample.surface_reelle_bati,
        prix: sample.valeur_fonciere,
        date: sample.date_mutation,
        coords: `${sample.latitude}, ${sample.longitude}`
      } : null
    });
    
  } catch (error) {
    console.error('[TEST-MONGO] Erreur:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: error.stack,
      mongoUrl: process.env.MONGO_URL?.split('@')[1] || 'URL masquée',
      database: process.env.DB_NAME
    }, { status: 500 });
  }
}
