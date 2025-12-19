'use client'

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Home, Building2, MapPin, ArrowRight, Loader2, Info, RotateCcw, CheckCircle2 } from 'lucide-react';
import { InputOTP, InputOTPGroup, InputOTPSlot, InputOTPSeparator } from '@/components/ui/input-otp';
import dynamic from 'next/dynamic';

const EstimationMap = dynamic(() => import('@/components/EstimationMap'), { ssr: false });

export default function App() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [addressSuggestions, setAddressSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  
  // États pour la vérification OTP
  const [otpStep, setOtpStep] = useState('form'); // 'form', 'otp', 'verified'
  const [otpCode, setOtpCode] = useState('');
  const [otpError, setOtpError] = useState('');
  const [otpCountdown, setOtpCountdown] = useState(0);
  const [phoneVerified, setPhoneVerified] = useState(false);
  
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
      
      // Extérieur (prend en compte la surface saisie)
      outside: formData.hasBalconyTerrace ? 
        (parseFloat(formData.balconyTerraceSurface) > 15 || formData.type === 'maison' ? 'large_terrace_or_garden' : 'small_balcony') : 'none',
      
      // Vue
      view: formData.view,
      
      // Parking (compte le nombre total)
      parking: formData.hasIndoorParking ? 
        (parseInt(formData.indoorParkingCount) >= 2 ? 'box_or_two' : 'one') :
        formData.hasOutdoorParking ? 
          (parseInt(formData.outdoorParkingCount) >= 2 ? 'box_or_two' : 'one') : 'none',
      
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
         formData.totalSurface < 600 ? 'medium' : 'large') : undefined,
      
      // Données additionnelles pour référence
      basementSurface: formData.basementSurface ? parseFloat(formData.basementSurface) : undefined,
      balconyTerraceSurface: formData.balconyTerraceSurface ? parseFloat(formData.balconyTerraceSurface) : undefined,
      outdoorParkingCount: formData.outdoorParkingCount ? parseInt(formData.outdoorParkingCount) : undefined,
      indoorParkingCount: formData.indoorParkingCount ? parseInt(formData.indoorParkingCount) : undefined
    };
    
    // Remove undefined values
    return Object.fromEntries(Object.entries(chars).filter(([_, v]) => v !== undefined));
  };

  // Envoyer le code OTP
  const handleSendOTP = async () => {
    if (!leadForm.phone) {
      setOtpError('Veuillez saisir votre numéro de téléphone');
      return;
    }
    
    setLoading(true);
    setOtpError('');
    
    try {
      const res = await fetch('/api/verification/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: leadForm.phone })
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        setOtpError(data.error || 'Erreur lors de l\'envoi du code');
        setLoading(false);
        return;
      }
      
      // Si bypass
      if (data.bypass) {
        setPhoneVerified(true);
        setOtpStep('verified');
        setLoading(false);
        return;
      }
      
      // Passer à l'étape OTP
      setOtpStep('otp');
      setOtpCountdown(60);
      
      // Démarrer le compte à rebours
      const interval = setInterval(() => {
        setOtpCountdown(prev => {
          if (prev <= 1) {
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      
    } catch (error) {
      console.error('OTP send error:', error);
      setOtpError('Erreur lors de l\'envoi du code');
    } finally {
      setLoading(false);
    }
  };
  
  // Vérifier le code OTP
  const handleVerifyOTP = async () => {
    if (otpCode.length !== 6) {
      setOtpError('Veuillez saisir le code à 6 chiffres');
      return;
    }
    
    setLoading(true);
    setOtpError('');
    
    try {
      const res = await fetch('/api/verification/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          phone: leadForm.phone,
          code: otpCode 
        })
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        setOtpError(data.error || 'Code invalide');
        setOtpCode('');
        setLoading(false);
        return;
      }
      
      // Vérification réussie
      setPhoneVerified(true);
      setOtpStep('verified');
      
    } catch (error) {
      console.error('OTP verify error:', error);
      setOtpError('Erreur lors de la vérification');
    } finally {
      setLoading(false);
    }
  };
  
  // Renvoyer le code OTP
  const handleResendOTP = async () => {
    setLoading(true);
    setOtpError('');
    setOtpCode('');
    
    try {
      const res = await fetch('/api/verification/resend-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: leadForm.phone })
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        setOtpError(data.error || 'Erreur lors du renvoi du code');
        setLoading(false);
        return;
      }
      
      // Réinitialiser le compte à rebours
      setOtpCountdown(60);
      const interval = setInterval(() => {
        setOtpCountdown(prev => {
          if (prev <= 1) {
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      
    } catch (error) {
      console.error('OTP resend error:', error);
      setOtpError('Erreur lors du renvoi du code');
    } finally {
      setLoading(false);
    }
  };

  const handleEstimate = async () => {
    if (!phoneVerified) {
      setOtpError('Veuillez vérifier votre numéro de téléphone');
      return;
    }
    
    setLoading(true);
    
    // Tracker la conversion Google Ads
    if (typeof window !== 'undefined' && window.gtag_report_conversion) {
      window.gtag_report_conversion();
    }
    
    try {
      // 1. Enregistrer le lead IMMÉDIATEMENT
      await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...leadForm,
          property: formData,
          status: 'pending_estimation', // Lead capturé, estimation en cours
          phoneVerified: true
        })
      });
      
      // 2. Calculer l'estimation
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
      
      // 3. Mettre à jour le lead avec l'estimation
      await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...leadForm,
          property: formData,
          estimation: data,
          status: 'estimation_complete',
          phoneVerified: true
        })
      });
      
      setStep(7); // Afficher résultats
    } catch (error) {
      console.error('Estimation error:', error);
      alert('Erreur lors de l\'estimation. Veuillez réessayer.');
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
            <img 
              src="https://customer-assets.emergentagent.com/job_realprice-wizard/artifacts/h5ubvkxs_Valide%CC%81%20%2812%29.png" 
              alt="AlterEgo" 
              className="h-12 w-auto"
            />
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
                {/* Checkboxes avec inputs conditionnels */}
                <div className="space-y-4">
                  {/* Sous-sol */}
                  <div className="border rounded-lg p-4 hover:bg-gray-50 transition-all">
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.hasBasement}
                        onChange={(e) => setFormData({ 
                          ...formData, 
                          hasBasement: e.target.checked,
                          basementSurface: e.target.checked ? formData.basementSurface : ''
                        })}
                        className="w-5 h-5 mt-1"
                      />
                      <div className="flex-1">
                        <span className="font-medium">Sous-sol</span>
                        {formData.hasBasement && (
                          <div className="mt-3 flex items-center gap-3">
                            <Input
                              type="number"
                              placeholder="Surface"
                              value={formData.basementSurface}
                              onChange={(e) => setFormData({ ...formData, basementSurface: e.target.value })}
                              className="w-32"
                            />
                            <span className="text-gray-600">m²</span>
                          </div>
                        )}
                      </div>
                    </label>
                  </div>
                  
                  {/* Balcon ou terrasse */}
                  <div className="border rounded-lg p-4 hover:bg-gray-50 transition-all">
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.hasBalconyTerrace}
                        onChange={(e) => setFormData({ 
                          ...formData, 
                          hasBalconyTerrace: e.target.checked,
                          balconyTerraceSurface: e.target.checked ? formData.balconyTerraceSurface : ''
                        })}
                        className="w-5 h-5 mt-1"
                      />
                      <div className="flex-1">
                        <span className="font-medium">Balcon ou terrasse</span>
                        {formData.hasBalconyTerrace && (
                          <div className="mt-3 flex items-center gap-3">
                            <Input
                              type="number"
                              placeholder="Surface"
                              value={formData.balconyTerraceSurface}
                              onChange={(e) => setFormData({ ...formData, balconyTerraceSurface: e.target.value })}
                              className="w-32"
                            />
                            <span className="text-gray-600">m²</span>
                          </div>
                        )}
                      </div>
                    </label>
                  </div>
                  
                  {/* Parking extérieur */}
                  <div className="border rounded-lg p-4 hover:bg-gray-50 transition-all">
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.hasOutdoorParking}
                        onChange={(e) => setFormData({ 
                          ...formData, 
                          hasOutdoorParking: e.target.checked,
                          outdoorParkingCount: e.target.checked ? formData.outdoorParkingCount : ''
                        })}
                        className="w-5 h-5 mt-1"
                      />
                      <div className="flex-1">
                        <span className="font-medium">Place de parking extérieur</span>
                        {formData.hasOutdoorParking && (
                          <div className="mt-3 flex items-center gap-3">
                            <Input
                              type="number"
                              placeholder="Nombre"
                              value={formData.outdoorParkingCount}
                              onChange={(e) => setFormData({ ...formData, outdoorParkingCount: e.target.value })}
                              className="w-32"
                              min="1"
                            />
                            <span className="text-gray-600">place(s)</span>
                          </div>
                        )}
                      </div>
                    </label>
                  </div>
                  
                  {/* Parking intérieur */}
                  <div className="border rounded-lg p-4 hover:bg-gray-50 transition-all">
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.hasIndoorParking}
                        onChange={(e) => setFormData({ 
                          ...formData, 
                          hasIndoorParking: e.target.checked,
                          indoorParkingCount: e.target.checked ? formData.indoorParkingCount : ''
                        })}
                        className="w-5 h-5 mt-1"
                      />
                      <div className="flex-1">
                        <span className="font-medium">Place de parking intérieur</span>
                        {formData.hasIndoorParking && (
                          <div className="mt-3 flex items-center gap-3">
                            <Input
                              type="number"
                              placeholder="Nombre"
                              value={formData.indoorParkingCount}
                              onChange={(e) => setFormData({ ...formData, indoorParkingCount: e.target.value })}
                              className="w-32"
                              min="1"
                            />
                            <span className="text-gray-600">place(s)</span>
                          </div>
                        )}
                      </div>
                    </label>
                  </div>
                  
                  {/* Piscine (maison uniquement) */}
                  {formData.type === 'maison' && (
                    <div className="border rounded-lg p-4 hover:bg-gray-50 transition-all">
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.hasPool}
                          onChange={(e) => setFormData({ ...formData, hasPool: e.target.checked })}
                          className="w-5 h-5"
                        />
                        <span className="font-medium">Piscine</span>
                      </label>
                    </div>
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
                  onClick={() => setStep(6)}
                  className="w-full bg-black hover:bg-gray-800 text-white py-6 text-lg"
                >
                  Continuer <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </div>
            </Card>
          </div>
        )}

        {/* Étape 6: FORMULAIRE LEAD (AVANT RÉSULTATS) */}
        {step === 6 && (
          <div className="max-w-4xl mx-auto">
            <Button onClick={() => setStep(5)} variant="outline" className="mb-6">← Retour</Button>
            
            <Card className="p-8 bg-gradient-to-br from-gray-50 to-white border-2">
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-green-500 rounded-full mx-auto mb-4 flex items-center justify-center">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h2 className="text-4xl font-bold mb-3">🎯 Votre estimation est prête !</h2>
                <p className="text-xl text-gray-600 mb-2">
                  Pour consulter <strong>gratuitement</strong> votre estimation détaillée et bénéficier d'un accompagnement personnalisé
                </p>
                <p className="text-gray-500">
                  Un expert immobilier vous contactera pour affiner votre estimation et vous conseiller
                </p>
              </div>

              <div className="max-w-md mx-auto space-y-4 mb-6">
                <div>
                  <Label className="font-semibold">Nom complet *</Label>
                  <Input
                    placeholder="Ex: Jean Dupont"
                    value={leadForm.name}
                    onChange={(e) => setLeadForm({ ...leadForm, name: e.target.value })}
                    className="mt-2"
                  />
                </div>
                
                <div>
                  <Label className="font-semibold">Email *</Label>
                  <Input
                    type="email"
                    placeholder="Ex: jean.dupont@email.com"
                    value={leadForm.email}
                    onChange={(e) => setLeadForm({ ...leadForm, email: e.target.value })}
                    className="mt-2"
                  />
                </div>
                
                <div>
                  <Label className="font-semibold">Téléphone *</Label>
                  <Input
                    type="tel"
                    placeholder="Ex: 06 12 34 56 78"
                    value={leadForm.phone}
                    onChange={(e) => setLeadForm({ ...leadForm, phone: e.target.value })}
                    className="mt-2"
                  />
                </div>
                
                <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg">
                  <input
                    type="checkbox"
                    checked={leadForm.consent}
                    onChange={(e) => setLeadForm({ ...leadForm, consent: e.target.checked })}
                    className="mt-1 w-5 h-5"
                    id="consent"
                  />
                  <label htmlFor="consent" className="text-sm text-gray-700">
                    J'accepte d'être contacté par AlterEgo et ses partenaires pour recevoir mon estimation détaillée et bénéficier d'un accompagnement personnalisé dans mon projet de vente. *
                  </label>
                </div>
                
                <Button
                  onClick={handleEstimate}
                  disabled={!leadForm.name || !leadForm.email || !leadForm.phone || !leadForm.consent || loading}
                  className="w-full bg-black hover:bg-gray-800 text-white py-6 text-lg"
                >
                  {loading ? (
                    <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Calcul en cours...</>
                  ) : (
                    <>Voir mon estimation gratuite <ArrowRight className="w-5 h-5 ml-2" /></>
                  )}
                </Button>
              </div>

              <div className="text-center space-y-2 text-sm text-gray-500">
                <p>✓ Estimation 100% gratuite et sans engagement</p>
                <p>✓ Basée sur les données officielles DVF</p>
                <p>✓ Accompagnement par un expert local</p>
              </div>
            </Card>
          </div>
        )}

        {/* Étape 7: Résultats */}
        {step === 7 && results && (
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
                  
                  <div className="grid grid-cols-2 gap-6 mb-8">
                    <div className="p-8 bg-white/20 rounded-lg backdrop-blur border-2 border-white/30">
                      <div className="text-sm opacity-80 mb-2">Prix Estimé</div>
                      <div className="text-sm opacity-70 mb-3">(Basé sur DVF - données réelles)</div>
                      <div className="text-4xl font-bold">{results.finalPrice.low.toLocaleString()} €</div>
                    </div>
                    
                    <div className="p-8 bg-white/15 rounded-lg backdrop-blur">
                      <div className="text-sm opacity-80 mb-2">Prix Conseillé de Mise en Vente</div>
                      <div className="text-sm opacity-70 mb-3">(Optimisé marché actuel)</div>
                      <div className="text-4xl font-bold">{results.finalPrice.mid.toLocaleString()} €</div>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-center gap-4 text-sm mb-4">
                    <span className="opacity-80">Indice de confiance:</span>
                    <span className="text-2xl font-bold">{results.finalPrice.confidence}/100</span>
                  </div>
                  
                  <div className="text-xs opacity-70">
                    Fourchette totale : {results.finalPrice.low.toLocaleString()} € - {results.finalPrice.high.toLocaleString()} €
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

            {/* Call to Action - Découvrir AlterEgo */}
            <Card className="p-8 mb-8 bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200">
              <div className="text-center">
                <h3 className="text-3xl font-bold mb-4">Besoin d'un accompagnement personnalisé ?</h3>
                <p className="text-lg text-gray-700 mb-6 max-w-2xl mx-auto">
                  Découvrez nos services d'expertise immobilière et bénéficiez de l'accompagnement d'un professionnel pour votre projet.
                </p>
                <Button
                  onClick={() => window.open('https://alteregopatrimoine.com', '_blank')}
                  className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-12 py-6 text-lg font-semibold shadow-lg hover:shadow-xl transition-all"
                >
                  Découvrir le site AlterEgo
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </div>
            </Card>

            {/* Bouton nouvelle estimation */}
            <div className="text-center">
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
                    basementSurface: '',
                    hasBalconyTerrace: false,
                    balconyTerraceSurface: '',
                    hasOutdoorParking: false,
                    outdoorParkingCount: '',
                    hasIndoorParking: false,
                    indoorParkingCount: '',
                    hasPool: false,
                    view: '',
                    yearBuilt: '',
                    dpe: '',
                    standing: 3
                  });
                  setResults(null);
                  setLeadForm({ name: '', email: '', phone: '', consent: false });
                }}
                variant="outline"
                className="px-8 py-3"
              >
                Faire une nouvelle estimation
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