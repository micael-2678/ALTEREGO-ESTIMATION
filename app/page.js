'use client'

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Home, Building2, MapPin, ArrowRight, Loader2, Info } from 'lucide-react';
import dynamic from 'next/dynamic';

const EstimationMap = dynamic(() => import('@/components/EstimationMap'), { ssr: false });

export default function App() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [addressSuggestions, setAddressSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  
  const [formData, setFormData] = useState({
    // Étape 1: Adresse
    address: '',
    lat: null,
    lng: null,
    
    // Étape 2: Type
    type: '',
    
    // Étape 3: Caractéristiques principales
    surface: '',
    totalSurface: '',
    rooms: '',
    bathrooms: '',
    floors: '',
    floor: '', // Pour appartement: à quel étage
    
    // Étape 4: Avantages supplémentaires
    hasBasement: false,
    basementSurface: '',
    hasBalconyTerrace: false,
    balconyTerraceSurface: '',
    hasOutdoorParking: false,
    outdoorParkingCount: '',
    hasIndoorParking: false,
    indoorParkingCount: '',
    hasPool: false,
    view: '',
    
    // Étape 5: État du bien
    yearBuilt: '',
    dpe: '',
    standing: 3 // 1-5
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
  
  // Map form data to characteristics for API
  const mapToCharacteristics = () => {
    const chars = {
      type: formData.type,
      surface: parseFloat(formData.surface),
      
      // Étage & ascenseur (appartement)
      floor: formData.type === 'appartement' && formData.floor ? 
        (formData.floor === '0' ? 'rdc' : formData.floor <= 3 ? '1-3' : '4+') : undefined,
      hasElevator: formData.floors > 0, // Si building a des étages, assume ascenseur possible
      
      // Extérieur
      outside: formData.hasBalconyTerrace ? 
        (formData.type === 'maison' || formData.totalSurface > formData.surface + 20 ? 'large_terrace_or_garden' : 'small_balcony') : 'none',
      
      // Vue
      view: formData.view,
      
      // Parking
      parking: formData.hasIndoorParking ? 'box_or_two' : 
        (formData.hasOutdoorParking ? 'one' : 'none'),
      
      // État/Standing (1-5 → condition)
      condition: formData.standing <= 2 ? 'to_renovate' : 
        (formData.standing >= 4 ? 'renovated' : 'good'),
      
      // DPE
      dpe: formData.dpe || 'unknown',
      
      // Maison extras
      houseExtras: formData.type === 'maison' ? 
        (formData.hasPool ? 'pool_or_quality_extras' : 
         formData.hasBasement ? 'annex' : 'none') : undefined,
      
      // Parcelle (maison)
      plot: formData.type === 'maison' && formData.totalSurface ? 
        (formData.totalSurface < 300 ? 'small' : 
         formData.totalSurface < 600 ? 'medium' : 'large') : undefined
    };
    
    // Remove undefined values
    return Object.fromEntries(Object.entries(chars).filter(([_, v]) => v !== undefined));
  };

  const handleEstimate = async () => {
    setLoading(true);
    try {
      const characteristics = mapToCharacteristics();
      
      const res = await fetch('/api/estimate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address: formData.address,
          lat: formData.lat,
          lng: formData.lng,
          type: formData.type,
          surface: parseFloat(formData.surface),
          characteristics
        })
      });
      
      const data = await res.json();
      setResults(data);
      setStep(6); // Résultats
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
      
      setStep(7); // Confirmation
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
        {/* Étape 1: Adresse */}
        {step === 1 && (
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-5xl font-bold mb-4">Estimation immobilière gratuite en ligne</h2>
              <p className="text-xl text-gray-600 mb-2">Estimation en 3 minutes</p>
              <p className="text-gray-600 max-w-2xl mx-auto">
                Saisissez votre adresse pour obtenir votre estimation gratuite instantanément basée sur les données actuelles du marché.
              </p>
            </div>

            <Card className="p-8">
              <Label className="text-lg mb-2 block font-semibold">Adresse du bien</Label>
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

              <Button
                onClick={() => formData.lat && setStep(2)}
                disabled={!formData.lat}
                className="w-full mt-6 bg-black hover:bg-gray-800 text-white py-6 text-lg"
              >
                Continuer <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </Card>
          </div>
        )}

        {/* Étape 2: Type de bien */}
        {step === 2 && (
          <div className="max-w-4xl mx-auto">
            <Button onClick={() => setStep(1)} variant="outline" className="mb-6">← Retour</Button>
            
            <h2 className="text-3xl font-bold mb-8">S'agit-il d'une maison ou d'un appartement ?</h2>
            
            <div className="grid grid-cols-2 gap-6">
              <button
                onClick={() => {
                  setFormData({ ...formData, type: 'appartement' });
                  setStep(3);
                }}
                className="p-12 border-2 rounded-xl hover:border-black transition-all bg-white shadow-sm hover:shadow-md"
              >
                <Building2 className="w-20 h-20 mx-auto mb-4" />
                <div className="text-2xl font-bold">Appartement</div>
              </button>
              <button
                onClick={() => {
                  setFormData({ ...formData, type: 'maison' });
                  setStep(3);
                }}
                className="p-12 border-2 rounded-xl hover:border-black transition-all bg-white shadow-sm hover:shadow-md"
              >
                <Home className="w-20 h-20 mx-auto mb-4" />
                <div className="text-2xl font-bold">Maison</div>
              </button>
            </div>
          </div>
        )}

        {/* Étape 3: Caractéristiques principales */}
        {step === 3 && (
          <div className="max-w-4xl mx-auto">
            <Button onClick={() => setStep(2)} variant="outline" className="mb-6">← Retour</Button>
            
            <Card className="p-8">
              <h2 className="text-3xl font-bold mb-2">Quelles sont les principales caractéristiques du bien ?</h2>
              <p className="text-sm text-gray-600 mb-6">*Information obligatoire</p>
              
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <Label>Surface habitable (m²) *</Label>
                    <Input
                      type="number"
                      placeholder="120"
                      value={formData.surface}
                      onChange={(e) => setFormData({ ...formData, surface: e.target.value })}
                      className="mt-2"
                    />
                  </div>
                  
                  <div>
                    <Label>{formData.type === 'maison' ? 'Superficie totale terrain (m²)' : 'Superficie totale (m²)'}</Label>
                    <Input
                      type="number"
                      placeholder="200"
                      value={formData.totalSurface}
                      onChange={(e) => setFormData({ ...formData, totalSurface: e.target.value })}
                      className="mt-2"
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <Label className="flex items-center gap-2">
                      Nombre de pièces *
                      <Info className="w-4 h-4 text-gray-400" />
                    </Label>
                    <Input
                      type="number"
                      placeholder="4"
                      value={formData.rooms}
                      onChange={(e) => setFormData({ ...formData, rooms: e.target.value })}
                      className="mt-2"
                    />
                  </div>
                  
                  <div>
                    <Label className="flex items-center gap-2">
                      Nombre de salles de bains *
                      <Info className="w-4 h-4 text-gray-400" />
                    </Label>
                    <Input
                      type="number"
                      placeholder="2"
                      value={formData.bathrooms}
                      onChange={(e) => setFormData({ ...formData, bathrooms: e.target.value })}
                      className="mt-2"
                    />
                  </div>
                </div>
                
                {formData.type === 'appartement' && (
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <Label>À quel étage ? *</Label>
                      <Input
                        type="number"
                        placeholder="3"
                        value={formData.floor}
                        onChange={(e) => setFormData({ ...formData, floor: e.target.value })}
                        className="mt-2"
                      />
                    </div>
                    
                    <div>
                      <Label>Nombre d'étages dans le bâtiment *</Label>
                      <Input
                        type="number"
                        placeholder="5"
                        value={formData.floors}
                        onChange={(e) => setFormData({ ...formData, floors: e.target.value })}
                        className="mt-2"
                      />
                    </div>
                  </div>
                )}
                
                <Button
                  onClick={() => setStep(4)}
                  disabled={!formData.surface || !formData.rooms || !formData.bathrooms || (formData.type === 'appartement' && (!formData.floor || !formData.floors))}
                  className="w-full bg-black hover:bg-gray-800 text-white py-6 text-lg"
                >
                  Continuer <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </div>
            </Card>
          </div>
        )}

        {/* Étape 4: Avantages supplémentaires */}
        {step === 4 && (
          <div className="max-w-4xl mx-auto">
            <Button onClick={() => setStep(3)} variant="outline" className="mb-6">← Retour</Button>
            
            <Card className="p-8">
              <h2 className="text-3xl font-bold mb-2">Quels sont les avantages supplémentaires offerts par le lieu ?</h2>
              <p className="text-sm text-gray-600 mb-6">Ces informations sont facultatives mais permettent une estimation plus précise.</p>
              
              <div className="space-y-6">
                {/* Checkboxes */}
                <div className="grid grid-cols-2 gap-4">
                  <label className="flex items-center gap-3 p-4 border rounded-lg cursor-pointer hover:bg-gray-50">
                    <input
                      type="checkbox"
                      checked={formData.hasBasement}
                      onChange={(e) => setFormData({ ...formData, hasBasement: e.target.checked })}
                      className="w-5 h-5"
                    />
                    <span>Sous-sol</span>
                  </label>
                  
                  <label className="flex items-center gap-3 p-4 border rounded-lg cursor-pointer hover:bg-gray-50">
                    <input
                      type="checkbox"
                      checked={formData.hasBalconyTerrace}
                      onChange={(e) => setFormData({ ...formData, hasBalconyTerrace: e.target.checked })}
                      className="w-5 h-5"
                    />
                    <span>Balcon ou terrasse</span>
                  </label>
                  
                  <label className="flex items-center gap-3 p-4 border rounded-lg cursor-pointer hover:bg-gray-50">
                    <input
                      type="checkbox"
                      checked={formData.hasOutdoorParking}
                      onChange={(e) => setFormData({ ...formData, hasOutdoorParking: e.target.checked })}
                      className="w-5 h-5"
                    />
                    <span>Place de parking extérieur</span>
                  </label>
                  
                  <label className="flex items-center gap-3 p-4 border rounded-lg cursor-pointer hover:bg-gray-50">
                    <input
                      type="checkbox"
                      checked={formData.hasIndoorParking}
                      onChange={(e) => setFormData({ ...formData, hasIndoorParking: e.target.checked })}
                      className="w-5 h-5"
                    />
                    <span>Place de parking intérieur</span>
                  </label>
                  
                  {formData.type === 'maison' && (
                    <label className="flex items-center gap-3 p-4 border rounded-lg cursor-pointer hover:bg-gray-50">
                      <input
                        type="checkbox"
                        checked={formData.hasPool}
                        onChange={(e) => setFormData({ ...formData, hasPool: e.target.checked })}
                        className="w-5 h-5"
                      />
                      <span>Piscine</span>
                    </label>
                  )}
                </div>
                
                {/* Vue */}
                <div>
                  <Label className="text-base font-semibold mb-3 block">Vue</Label>
                  <p className="text-sm text-gray-600 mb-3">Exemples de vues exceptionnelles : Monument, montagne, plage.</p>
                  <div className="grid grid-cols-3 gap-4">
                    <button
                      onClick={() => setFormData({ ...formData, view: 'vis_a_vis' })}
                      className={`p-4 border-2 rounded-lg transition-all ${
                        formData.view === 'vis_a_vis'
                          ? 'border-black bg-gray-50 font-semibold'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      Vis-à-vis
                    </button>
                    <button
                      onClick={() => setFormData({ ...formData, view: 'degagee' })}
                      className={`p-4 border-2 rounded-lg transition-all ${
                        formData.view === 'degagee'
                          ? 'border-black bg-gray-50 font-semibold'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      Dégagée
                    </button>
                    <button
                      onClick={() => setFormData({ ...formData, view: 'exceptionnelle' })}
                      className={`p-4 border-2 rounded-lg transition-all ${
                        formData.view === 'exceptionnelle'
                          ? 'border-black bg-gray-50 font-semibold'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      Exceptionnelle
                    </button>
                  </div>
                </div>
                
                <Button
                  onClick={() => setStep(5)}
                  className="w-full bg-black hover:bg-gray-800 text-white py-6 text-lg"
                >
                  Continuer <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </div>
            </Card>
          </div>
        )}

        {/* Étape 5: État du bien */}
        {step === 5 && (
          <div className="max-w-4xl mx-auto">
            <Button onClick={() => setStep(4)} variant="outline" className="mb-6">← Retour</Button>
            
            <Card className="p-8">
              <h2 className="text-3xl font-bold mb-2">Comment évaluez-vous son état ?</h2>
              <p className="text-sm text-gray-600 mb-6">Ces informations sont facultatives mais permettent une estimation plus précise.</p>
              
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <Label>Année de construction</Label>
                    <Input
                      type="number"
                      placeholder="1980"
                      value={formData.yearBuilt}
                      onChange={(e) => setFormData({ ...formData, yearBuilt: e.target.value })}
                      className="mt-2"
                    />
                  </div>
                  
                  <div>
                    <Label>Diagnostic énergétique (DPE)</Label>
                    <div className="grid grid-cols-4 gap-2 mt-2">
                      {['A', 'B', 'C', 'D', 'E', 'F', 'G'].map(dpe => (
                        <button
                          key={dpe}
                          onClick={() => setFormData({ ...formData, dpe })}
                          className={`p-3 border-2 rounded-lg font-bold transition-all ${
                            formData.dpe === dpe
                              ? 'border-black bg-gray-50'
                              : 'border-gray-200 hover:border-gray-300'
                          } ${['A', 'B', 'C'].includes(dpe) ? 'bg-green-50' : ''}
                          ${['F', 'G'].includes(dpe) ? 'bg-red-50' : ''}`}
                        >
                          {dpe}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                
                {/* Standing */}
                <div>
                  <Label className="text-base font-semibold mb-3 block">Évaluez le standing de votre propriété</Label>
                  <div className="flex items-center justify-between gap-4 p-6 bg-gray-50 rounded-lg">
                    {[1, 2, 3, 4, 5].map(level => (
                      <button
                        key={level}
                        onClick={() => setFormData({ ...formData, standing: level })}
                        className={`flex-1 p-4 rounded-lg border-2 transition-all ${
                          formData.standing === level
                            ? 'border-black bg-white shadow-md scale-105'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="text-3xl mb-2">
                          {level === 1 ? '😟' : level === 2 ? '😐' : level === 3 ? '🙂' : level === 4 ? '😊' : '🤩'}
                        </div>
                        <div className="text-xs font-semibold">
                          {level === 1 ? 'À rénover' : level === 2 ? 'Moyen' : level === 3 ? 'Bon' : level === 4 ? 'Très bon' : 'Excellent'}
                        </div>
                      </button>
                    ))}
                  </div>
                  {formData.standing && (
                    <p className="text-center mt-3 text-sm text-gray-600">
                      La propriété est en {formData.standing === 1 ? 'état nécessitant rénovation' : formData.standing === 2 ? 'état moyen' : formData.standing === 3 ? 'bon état' : formData.standing === 4 ? 'très bon état' : 'excellent état'} !
                    </p>
                  )}
                </div>
                
                <Button
                  onClick={handleEstimate}
                  disabled={loading}
                  className="w-full bg-black hover:bg-gray-800 text-white py-6 text-lg"
                >
                  {loading ? (
                    <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Calcul en cours...</>
                  ) : (
                    <>Voir mon estimation <ArrowRight className="w-5 h-5 ml-2" /></>
                  )}
                </Button>
              </div>
            </Card>
          </div>
        )}

        {/* Étape 6: Résultats */}
        {step === 6 && results && (
          <div className="max-w-6xl mx-auto">
            <div className="mb-8">
              <Button onClick={() => setStep(1)} variant="outline" className="mb-4">
                ← Nouvelle estimation
              </Button>
              <h2 className="text-4xl font-bold mb-2">Résultats de l'estimation</h2>
              <p className="text-gray-600">{formData.address}</p>
              <p className="text-sm text-gray-500 mt-2">{results.disclaimer}</p>
            </div>

            {/* Prix Final avec fourchette */}
            {results.finalPrice && (
              <Card className="p-8 mb-8 bg-gradient-to-br from-gray-900 to-gray-800 text-white">
                <div className="text-center">
                  <h3 className="text-2xl font-semibold mb-6">Estimation de votre bien</h3>
                  
                  <div className="grid grid-cols-3 gap-6 mb-8">
                    <div className="p-6 bg-white/10 rounded-lg backdrop-blur">
                      <div className="text-sm opacity-80 mb-2">Fourchette basse</div>
                      <div className="text-2xl font-bold">{results.finalPrice.low.toLocaleString()} €</div>
                    </div>
                    
                    <div className="p-6 bg-white/20 rounded-lg backdrop-blur border-2 border-white/30">
                      <div className="text-sm opacity-80 mb-2">Prix estimé</div>
                      <div className="text-4xl font-bold">{results.finalPrice.mid.toLocaleString()} €</div>
                    </div>
                    
                    <div className="p-6 bg-white/10 rounded-lg backdrop-blur">
                      <div className="text-sm opacity-80 mb-2">Fourchette haute</div>
                      <div className="text-2xl font-bold">{results.finalPrice.high.toLocaleString()} €</div>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-center gap-4 text-sm">
                    <span className="opacity-80">Indice de confiance:</span>
                    <span className="text-2xl font-bold">{results.finalPrice.confidence}/100</span>
                  </div>
                </div>
              </Card>
            )}

            {/* Ajustements détaillés */}
            {results.adjustments && results.adjustments.adjustments && results.adjustments.adjustments.length > 0 && (
              <Card className="p-6 mb-8">
                <h3 className="text-2xl font-bold mb-4">Ajustements appliqués</h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center p-3 bg-gray-50 rounded font-semibold">
                    <span>Base DVF (données réelles)</span>
                    <span>{results.adjustments.basePricePerM2.toLocaleString()} €/m²</span>
                  </div>
                  
                  {results.adjustments.adjustments.map((adj, idx) => (
                    <div key={idx} className="flex justify-between items-center p-3 border-b">
                      <div>
                        <div className="font-medium">{adj.factor}</div>
                        <div className="text-sm text-gray-600">{adj.description}</div>
                      </div>
                      <div className={`font-bold ${
                        adj.impact > 0 ? 'text-green-600' : adj.impact < 0 ? 'text-red-600' : 'text-gray-600'
                      }`}>
                        {adj.impact > 0 ? '+' : ''}{adj.impact.toFixed(1)}%
                      </div>
                    </div>
                  ))}
                  
                  <div className="flex justify-between items-center p-4 bg-black text-white rounded-lg font-bold text-lg mt-4">
                    <span>Prix ajusté final</span>
                    <span>{results.adjustments.adjustedPricePerM2.toLocaleString()} €/m²</span>
                  </div>
                </div>
              </Card>
            )}

            {/* DVF Statistics */}
            {results.dvf && results.dvf.stats && (
              <Card className="p-6 mb-8">
                <h3 className="text-2xl font-bold mb-4 flex items-center gap-2">
                  <span className="w-3 h-3 bg-blue-500 rounded-full"></span>
                  Ventes Réelles DVF
                </h3>
                
                {results.dvf.warning && (
                  <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800">
                    ⚠️ {results.dvf.warning}
                  </div>
                )}
                
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <div className="text-sm text-gray-600">Comparables</div>
                    <div className="text-2xl font-bold">{results.dvf.count}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">Rayon</div>
                    <div className="text-2xl font-bold">{results.dvf.radius}m</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">Période</div>
                    <div className="text-2xl font-bold">{results.dvf.months} mois</div>
                  </div>
                </div>
              </Card>
            )}

            {/* Map */}
            {(results.dvf?.comparables?.length > 0 || results.market?.listings?.length > 0) && (
              <Card className="p-6 mb-8">
                <h3 className="text-2xl font-bold mb-4">Carte des comparables</h3>
                <EstimationMap
                  center={[formData.lat, formData.lng]}
                  dvfSales={results.dvf.comparables || []}
                  marketListings={results.market?.listings || []}
                />
              </Card>
            )}

            {/* CTA Lead */}
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

        {/* Étape 7: Confirmation */}
        {step === 7 && (
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
                    floors: '',
                    floor: '',
                    hasBasement: false,
                    hasBalconyTerrace: false,
                    hasOutdoorParking: false,
                    hasIndoorParking: false,
                    hasPool: false,
                    view: '',
                    yearBuilt: '',
                    dpe: '',
                    standing: 3
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
          <p className="text-xs mt-2">Estimations basées sur DVF (open data) — valeurs indicatives, non contractuelles.</p>
        </div>
      </footer>
    </div>
  );
}