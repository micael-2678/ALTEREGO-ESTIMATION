'use client'

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Home, Building2, MapPin, ArrowRight, Loader2 } from 'lucide-react';
import dynamic from 'next/dynamic';

const EstimationMap = dynamic(() => import('@/components/EstimationMap'), { ssr: false });

export default function App() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [addressSuggestions, setAddressSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  
  const [formData, setFormData] = useState({
    address: '',
    lat: null,
    lng: null,
    type: '',
    surface: '',
    totalSurface: '',
    rooms: '',
    bathrooms: '',
    floors: ''
  });
  
  const [results, setResults] = useState(null);
  const [leadForm, setLeadForm] = useState({
    name: '',
    email: '',
    phone: '',
    consent: false
  });

  // Search address suggestions
  const searchAddress = async (query) => {
    if (query.length < 3) {
      setAddressSuggestions([]);
      return;
    }
    
    try {
      const res = await fetch(`/api/geo/resolve?address=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (data.suggestions) {
        setAddressSuggestions(data.suggestions);
        setShowSuggestions(true);
      }
    } catch (error) {
      console.error('Address search error:', error);
    }
  };

  const selectAddress = (suggestion) => {
    setFormData({
      ...formData,
      address: suggestion.address,
      lat: suggestion.lat,
      lng: suggestion.lng
    });
    setShowSuggestions(false);
    setAddressSuggestions([]);
  };

  const handleEstimate = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/estimate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address: formData.address,
          lat: formData.lat,
          lng: formData.lng,
          type: formData.type,
          surface: parseFloat(formData.surface),
          characteristics: {
            totalSurface: formData.totalSurface,
            rooms: formData.rooms,
            bathrooms: formData.bathrooms,
            floors: formData.floors
          }
        })
      });
      
      const data = await res.json();
      setResults(data);
      setStep(2);
    } catch (error) {
      console.error('Estimation error:', error);
      alert('Erreur lors de l\'estimation. Veuillez réessayer.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitLead = async () => {
    if (!leadForm.name || !leadForm.email || !leadForm.consent) {
      alert('Veuillez remplir tous les champs obligatoires et accepter les conditions.');
      return;
    }
    
    setLoading(true);
    try {
      await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...leadForm,
          estimation: results,
          property: formData
        })
      });
      
      setStep(3);
    } catch (error) {
      console.error('Lead submission error:', error);
      alert('Erreur lors de l\'envoi. Veuillez réessayer.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold tracking-tight">AlterEgo</h1>
            <div className="text-sm text-gray-600">
              Accueil &gt; Estimation immobilière
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-12">
        {step === 1 && (
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-5xl font-bold mb-4">Estimation immobilière gratuite en ligne</h2>
              <p className="text-xl text-gray-600 mb-2">Estimation en 3 minutes</p>
              <p className="text-gray-600 max-w-2xl mx-auto">
                Saisissez votre adresse pour obtenir votre estimation gratuite instantanément basée sur les données actuelles du marché. 
                Bénéficiez des conseils avisés d'un professionnel de l'immobilier pour guider vos décisions en matière de bien.
              </p>
            </div>

            {/* Address Input */}
            <Card className="p-8 mb-8">
              <div className="mb-6">
                <Label className="text-lg mb-2 block">Adresse du bien</Label>
                <div className="relative">
                  <Input
                    placeholder="Ex: 2 rue des italiens, 75009 Paris"
                    value={formData.address}
                    onChange={(e) => {
                      setFormData({ ...formData, address: e.target.value });
                      searchAddress(e.target.value);
                    }}
                    className="text-lg py-6"
                  />
                  {showSuggestions && addressSuggestions.length > 0 && (
                    <div className="absolute z-10 w-full bg-white border rounded-md shadow-lg mt-1 max-h-60 overflow-y-auto">
                      {addressSuggestions.map((suggestion, idx) => (
                        <button
                          key={idx}
                          className="w-full text-left px-4 py-3 hover:bg-gray-100 border-b last:border-b-0"
                          onClick={() => selectAddress(suggestion)}
                        >
                          <div className="flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-gray-400" />
                            <span>{suggestion.address}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {formData.lat && (
                <>
                  {/* Property Type */}
                  <div className="mb-6">
                    <Label className="text-lg mb-3 block">S'agit-il d'une maison ou d'un appartement ?</Label>
                    <div className="grid grid-cols-2 gap-4">
                      <button
                        onClick={() => setFormData({ ...formData, type: 'appartement' })}
                        className={`p-6 border-2 rounded-lg transition-all ${
                          formData.type === 'appartement'
                            ? 'border-black bg-gray-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <Building2 className="w-12 h-12 mx-auto mb-2" />
                        <div className="text-lg font-semibold">Appartement</div>
                      </button>
                      <button
                        onClick={() => setFormData({ ...formData, type: 'maison' })}
                        className={`p-6 border-2 rounded-lg transition-all ${
                          formData.type === 'maison'
                            ? 'border-black bg-gray-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <Home className="w-12 h-12 mx-auto mb-2" />
                        <div className="text-lg font-semibold">Maison</div>
                      </button>
                    </div>
                  </div>

                  {formData.type && (
                    <>
                      {/* Characteristics */}
                      <div className="space-y-4">
                        <h3 className="text-xl font-semibold mb-4">Quelles sont les principales caractéristiques du bien ?</h3>
                        <p className="text-sm text-gray-600 mb-4">*Information obligatoire</p>
                        
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label>Surface habitable (m²) *</Label>
                            <Input
                              type="number"
                              placeholder="120"
                              value={formData.surface}
                              onChange={(e) => setFormData({ ...formData, surface: e.target.value })}
                              className="mt-1"
                            />
                          </div>
                          <div>
                            <Label>Superficie totale (m²)</Label>
                            <Input
                              type="number"
                              placeholder="200"
                              value={formData.totalSurface}
                              onChange={(e) => setFormData({ ...formData, totalSurface: e.target.value })}
                              className="mt-1"
                            />
                          </div>
                          <div>
                            <Label>Nombre de pièces *</Label>
                            <Input
                              type="number"
                              placeholder="8"
                              value={formData.rooms}
                              onChange={(e) => setFormData({ ...formData, rooms: e.target.value })}
                              className="mt-1"
                            />
                          </div>
                          <div>
                            <Label>Nombre de salles de bains *</Label>
                            <Input
                              type="number"
                              placeholder="3"
                              value={formData.bathrooms}
                              onChange={(e) => setFormData({ ...formData, bathrooms: e.target.value })}
                              className="mt-1"
                            />
                          </div>
                          {formData.type === 'appartement' && (
                            <div>
                              <Label>Nombre d'étages dans le bâtiment *</Label>
                              <Input
                                type="number"
                                placeholder="3"
                                value={formData.floors}
                                onChange={(e) => setFormData({ ...formData, floors: e.target.value })}
                                className="mt-1"
                              />
                            </div>
                          )}
                        </div>
                      </div>

                      <Button
                        onClick={handleEstimate}
                        disabled={!formData.surface || loading}
                        className="w-full mt-8 bg-black hover:bg-gray-800 text-white py-6 text-lg"
                      >
                        {loading ? (
                          <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Estimation en cours...</>
                        ) : (
                          <>Estimer mon bien <ArrowRight className="w-5 h-5 ml-2" /></>
                        )}
                      </Button>
                    </>
                  )}
                </>
              )}
            </Card>
          </div>
        )}

        {step === 2 && results && (
          <div className="max-w-6xl mx-auto">
            <div className="mb-8">
              <Button
                onClick={() => setStep(1)}
                variant="outline"
                className="mb-4"
              >
                ← Retour
              </Button>
              <h2 className="text-4xl font-bold mb-2">Résultats de l'estimation</h2>
              <p className="text-gray-600">{formData.address}</p>
            </div>

            {/* Statistics Cards */}
            <div className="grid md:grid-cols-2 gap-6 mb-8">
              {/* DVF Card */}
              <Card className="p-6">
                <h3 className="text-2xl font-bold mb-4 flex items-center gap-2">
                  <span className="w-3 h-3 bg-blue-500 rounded-full"></span>
                  Ventes Réelles DVF
                </h3>
                
                {results.dvf.stats ? (
                  <>
                    {results.dvf.warning && (
                      <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800">
                        ⚠️ {results.dvf.warning}
                      </div>
                    )}
                    
                    <div className="space-y-3 mb-4">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Nombre de comparables:</span>
                        <span className="font-semibold">{results.dvf.count}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Rayon:</span>
                        <span className="font-semibold">{results.dvf.radius}m</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Période:</span>
                        <span className="font-semibold">{results.dvf.months} mois</span>
                      </div>
                      <div className="border-t pt-3 mt-3">
                        <div className="flex justify-between text-lg">
                          <span className="text-gray-600">Moyenne €/m²:</span>
                          <span className="font-bold">{results.dvf.stats.meanPricePerM2.toLocaleString()} €</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Médiane €/m²:</span>
                          <span className="font-semibold">{results.dvf.stats.medianPricePerM2.toLocaleString()} €</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Écart-type:</span>
                          <span className="font-semibold">{results.dvf.stats.stdDev.toLocaleString()} €</span>
                        </div>
                        <div className="flex justify-between text-lg font-bold text-blue-600 mt-2">
                          <span>Moyenne pondérée:</span>
                          <span>{results.dvf.stats.weightedAverage.toLocaleString()} €/m²</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="bg-blue-50 p-4 rounded-lg">
                      <div className="flex justify-between items-center">
                        <span className="font-semibold">Indice de confiance:</span>
                        <span className="text-2xl font-bold text-blue-600">{results.dvf.stats.confidenceIndex}/100</span>
                      </div>
                    </div>
                    
                    {results.estimatedValue && (
                      <div className="mt-4 p-4 bg-gray-900 text-white rounded-lg">
                        <div className="text-sm opacity-90">Prix marché à annoncer (basé sur DVF)</div>
                        <div className="text-3xl font-bold">{results.estimatedValue.toLocaleString()} €</div>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-gray-600">Aucune donnée DVF disponible pour cette zone.</p>
                )}
              </Card>

              {/* Market Card */}
              <Card className="p-6">
                <h3 className="text-2xl font-bold mb-4 flex items-center gap-2">
                  <span className="w-3 h-3 bg-green-500 rounded-full"></span>
                  Marché Actif
                </h3>
                
                {results.market.stats ? (
                  <>
                    <div className="space-y-3 mb-4">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Nombre d'annonces:</span>
                        <span className="font-semibold">{results.market.stats.count}</span>
                      </div>
                      <div className="border-t pt-3 mt-3">
                        <div className="flex justify-between text-lg">
                          <span className="text-gray-600">Moyenne €/m²:</span>
                          <span className="font-bold">{results.market.stats.meanPricePerM2.toLocaleString()} €</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Médiane €/m²:</span>
                          <span className="font-semibold">{results.market.stats.medianPricePerM2.toLocaleString()} €</span>
                        </div>
                      </div>
                    </div>
                    
                    {results.delta && (
                      <div className={`p-4 rounded-lg ${
                        parseFloat(results.delta) > 0 ? 'bg-green-50' : 'bg-red-50'
                      }`}>
                        <div className="flex justify-between items-center">
                          <span className="font-semibold">Delta marché vs DVF:</span>
                          <span className={`text-2xl font-bold ${
                            parseFloat(results.delta) > 0 ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {parseFloat(results.delta) > 0 ? '+' : ''}{results.delta}%
                          </span>
                        </div>
                      </div>
                    )}
                    
                    {results.estimatedValue && results.market.stats && (
                      <div className="mt-4 p-4 bg-green-900 text-white rounded-lg">
                        <div className="text-sm opacity-90">Prix conseillé de mise en vente</div>
                        <div className="text-3xl font-bold">
                          {Math.round(results.market.stats.medianPricePerM2 * parseFloat(formData.surface)).toLocaleString()} €
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-gray-600">Aucune annonce active trouvée pour cette zone.</p>
                )}
              </Card>
            </div>

            {/* Map */}
            {(results.dvf.comparables?.length > 0 || results.market.listings?.length > 0) && (
              <Card className="p-6 mb-8">
                <h3 className="text-2xl font-bold mb-4">Carte des comparables</h3>
                <EstimationMap
                  center={[formData.lat, formData.lng]}
                  dvfSales={results.dvf.comparables || []}
                  marketListings={results.market.listings || []}
                />
              </Card>
            )}

            {/* CTA */}
            <Card className="p-8 bg-gradient-to-r from-gray-900 to-gray-800 text-white text-center">
              <h3 className="text-3xl font-bold mb-4">Recevoir le rapport complet + être rappelé</h3>
              <p className="mb-6 text-gray-300">Un expert immobilier vous contactera pour affiner votre estimation</p>
              
              <div className="max-w-md mx-auto space-y-4">
                <Input
                  placeholder="Nom complet"
                  value={leadForm.name}
                  onChange={(e) => setLeadForm({ ...leadForm, name: e.target.value })}
                  className="bg-white text-black"
                />
                <Input
                  type="email"
                  placeholder="Email"
                  value={leadForm.email}
                  onChange={(e) => setLeadForm({ ...leadForm, email: e.target.value })}
                  className="bg-white text-black"
                />
                <Input
                  placeholder="Téléphone"
                  value={leadForm.phone}
                  onChange={(e) => setLeadForm({ ...leadForm, phone: e.target.value })}
                  className="bg-white text-black"
                />
                
                <div className="flex items-start gap-2 text-left">
                  <input
                    type="checkbox"
                    checked={leadForm.consent}
                    onChange={(e) => setLeadForm({ ...leadForm, consent: e.target.checked })}
                    className="mt-1"
                  />
                  <label className="text-sm text-gray-300">
                    J'accepte d'être contacté par AlterEgo et ses partenaires pour recevoir mon rapport et bénéficier d'un accompagnement personnalisé.
                  </label>
                </div>
                
                <Button
                  onClick={handleSubmitLead}
                  disabled={loading}
                  className="w-full bg-white text-black hover:bg-gray-200"
                >
                  {loading ? 'Envoi...' : 'Recevoir le rapport + RDV'}
                </Button>
              </div>
            </Card>
          </div>
        )}

        {step === 3 && (
          <div className="max-w-2xl mx-auto text-center">
            <div className="bg-white p-12 rounded-lg shadow-lg">
              <div className="w-20 h-20 bg-green-500 rounded-full mx-auto mb-6 flex items-center justify-center">
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-4xl font-bold mb-4">Merci !</h2>
              <p className="text-xl text-gray-600 mb-8">
                Votre demande a été envoyée avec succès. Un expert immobilier vous contactera dans les plus brefs délais.
              </p>
              <Button
                onClick={() => {
                  setStep(1);
                  setFormData({
                    address: '',
                    lat: null,
                    lng: null,
                    type: '',
                    surface: '',
                    totalSurface: '',
                    rooms: '',
                    bathrooms: '',
                    floors: ''
                  });
                  setResults(null);
                  setLeadForm({ name: '', email: '', phone: '', consent: false });
                }}
                className="bg-black hover:bg-gray-800 text-white"
              >
                Nouvelle estimation
              </Button>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t mt-12 py-8">
        <div className="container mx-auto px-4 text-center text-gray-600">
          <p>© 2025 AlterEgo. Tous droits réservés.</p>
        </div>
      </footer>
    </div>
  );
}