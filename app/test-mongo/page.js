'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { CheckCircle2, XCircle, Database, Loader2 } from 'lucide-react';

export default function TestMongoPage() {
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState(null);

  const testConnection = async () => {
    setTesting(true);
    setResult(null);
    
    try {
      const response = await fetch('/api/test-mongo');
      const data = await response.json();
      setResult(data);
    } catch (error) {
      setResult({
        success: false,
        error: error.message
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            🔍 Test Connexion MongoDB
          </h1>
          <p className="text-gray-600">
            Vérification de l'accès aux données DVF
          </p>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Configuration MongoDB
            </CardTitle>
            <CardDescription>
              Test de connexion à la base de données de production
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={testConnection} 
              disabled={testing}
              size="lg"
              className="w-full"
            >
              {testing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Test en cours...
                </>
              ) : (
                'Tester la connexion'
              )}
            </Button>
          </CardContent>
        </Card>

        {result && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {result.success ? (
                  <>
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                    <span className="text-green-600">Connexion réussie !</span>
                  </>
                ) : (
                  <>
                    <XCircle className="h-5 w-5 text-red-600" />
                    <span className="text-red-600">Échec de connexion</span>
                  </>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {result.success ? (
                <>
                  <Alert>
                    <CheckCircle2 className="h-4 w-4" />
                    <AlertTitle>Connexion établie</AlertTitle>
                    <AlertDescription>
                      L'application peut accéder aux données DVF
                    </AlertDescription>
                  </Alert>

                  <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                    <div>
                      <p className="text-sm text-gray-500">Base de données</p>
                      <p className="font-semibold">{result.database}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Collection</p>
                      <p className="font-semibold">{result.collection}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Nombre de documents</p>
                      <p className="font-semibold text-2xl text-green-600">
                        {result.count?.toLocaleString('fr-FR')}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Serveur MongoDB</p>
                      <p className="font-semibold text-xs">{result.mongoUrl}</p>
                    </div>
                  </div>

                  {result.sample && (
                    <div className="mt-4">
                      <h4 className="font-semibold mb-2">📍 Exemple de transaction DVF:</h4>
                      <div className="p-4 bg-blue-50 rounded-lg space-y-2 text-sm">
                        <p><strong>Commune:</strong> {result.sample.commune}</p>
                        <p><strong>Type:</strong> {result.sample.type}</p>
                        <p><strong>Surface:</strong> {result.sample.surface} m²</p>
                        <p><strong>Prix:</strong> {result.sample.prix?.toLocaleString('fr-FR')} €</p>
                        <p><strong>Date:</strong> {result.sample.date}</p>
                        <p><strong>Coordonnées:</strong> {result.sample.coords}</p>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <Alert variant="destructive">
                    <XCircle className="h-4 w-4" />
                    <AlertTitle>Erreur de connexion</AlertTitle>
                    <AlertDescription>
                      {result.error}
                    </AlertDescription>
                  </Alert>

                  {result.stack && (
                    <div className="p-4 bg-red-50 rounded-lg">
                      <p className="text-xs font-mono text-red-800 whitespace-pre-wrap">
                        {result.stack}
                      </p>
                    </div>
                  )}

                  <div className="p-4 bg-gray-50 rounded-lg space-y-2 text-sm">
                    <p><strong>Database:</strong> {result.database}</p>
                    <p><strong>Serveur:</strong> {result.mongoUrl}</p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )}

        <div className="mt-8 text-center">
          <a 
            href="/"
            className="text-blue-600 hover:underline"
          >
            ← Retour à l'accueil
          </a>
        </div>
      </div>
    </div>
  );
}
