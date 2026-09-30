'use client'

import { useState, useEffect, useRef } from 'react';
import { Home, Building2, MapPin, ArrowRight, ArrowLeft, Loader2, RotateCcw, Check, ShieldCheck, Clock, LineChart } from 'lucide-react';
import { InputOTP, InputOTPGroup, InputOTPSlot, InputOTPSeparator } from '@/components/ui/input-otp';
import dynamic from 'next/dynamic';

const EstimationMap = dynamic(() => import('@/components/EstimationMap'), {
  ssr: false,
  loading: () => <div className="h-96 w-full rounded-card bg-ae-sand animate-pulse" />
});

const SITE_URL = process.env.NEXT_PUBLIC_MAIN_SITE_URL || 'https://alteregopatrimoine.com';
const CONTACT_URL = process.env.NEXT_PUBLIC_CONTACT_URL || SITE_URL;
const TOTAL_STEPS = 6;

const INITIAL_FORM = {
  // Étape 1 : adresse
  address: '',
  lat: null,
  lng: null,
  // Étape 2 : type
  type: '',
  // Étape 3 : caractéristiques principales
  surface: '',
  totalSurface: '',
  rooms: '',
  bathrooms: '',
  floors: '',
  floor: '',
  hasElevator: null,
  // Étape 4 : atouts
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
  // Étape 5 : état
  yearBuilt: '',
  dpe: '',
  standing: 3
};

const INITIAL_LEAD = {
  name: '',
  email: '',
  phone: '',
  estimationReason: '',
  consent: false
};

const STANDING_LEVELS = [
  { value: 1, label: 'À rénover', sentence: 'nécessite une rénovation' },
  { value: 2, label: 'Moyen', sentence: 'est dans un état moyen' },
  { value: 3, label: 'Bon', sentence: 'est en bon état' },
  { value: 4, label: 'Très bon', sentence: 'est en très bon état' },
  { value: 5, label: 'Excellent', sentence: 'est dans un état excellent' }
];

const VIEW_OPTIONS = [
  { value: 'vis_a_vis', label: 'Vis-à-vis' },
  { value: 'degagee', label: 'Dégagée' },
  { value: 'exceptionnelle', label: 'Exceptionnelle' }
];

// Couleurs de l'étiquette énergie réglementaire (information fonctionnelle)
const DPE_COLORS = {
  A: '#009C6D', B: '#52B153', C: '#A5CC74', D: '#F4E70F', E: '#F2A93B', F: '#EB6B25', G: '#D7221F'
};

const formatEuros = (value) =>
  `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(value)} €`;

const formatDate = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' });
};

export default function App() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [embedded, setEmbedded] = useState(false);

  const [addressSuggestions, setAddressSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  const searchTimer = useRef(null);
  const searchAbort = useRef(null);
  const rootRef = useRef(null);

  // Vérification OTP
  const [otpStep, setOtpStep] = useState('form'); // 'form' | 'otp' | 'verified'
  const [otpCode, setOtpCode] = useState('');
  const [otpError, setOtpError] = useState('');
  const [otpCountdown, setOtpCountdown] = useState(0);
  const [phoneVerified, setPhoneVerified] = useState(false);

  const [formData, setFormData] = useState(INITIAL_FORM);
  const [results, setResults] = useState(null);
  const [estimateError, setEstimateError] = useState('');
  const [leadForm, setLeadForm] = useState(INITIAL_LEAD);

  const updateForm = (patch) => setFormData(prev => ({ ...prev, ...patch }));
  const updateLead = (patch) => setLeadForm(prev => ({ ...prev, ...patch }));

  // Mode intégré (iframe sur alteregopatrimoine.com) : ?embed=1
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setEmbedded(params.get('embed') === '1' || window.self !== window.top);
  }, []);

  // En iframe, transmet la hauteur au site parent pour un redimensionnement automatique
  useEffect(() => {
    if (!embedded || !rootRef.current || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => {
      window.parent.postMessage(
        { type: 'alterego-estimation:height', height: document.documentElement.scrollHeight },
        '*'
      );
    });
    observer.observe(rootRef.current);
    return () => observer.disconnect();
  }, [embedded]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (embedded) {
      window.parent.postMessage({ type: 'alterego-estimation:step', step }, '*');
    }
  }, [step, embedded]);

  // Compte à rebours de renvoi du SMS
  useEffect(() => {
    if (otpCountdown <= 0) return;
    const timer = setTimeout(() => setOtpCountdown(c => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [otpCountdown]);

  useEffect(() => () => {
    clearTimeout(searchTimer.current);
    searchAbort.current?.abort();
  }, []);

  // Autocomplétion d'adresse : temporisée et annulable (pas de réponses dans le désordre)
  const searchAddress = (query) => {
    clearTimeout(searchTimer.current);
    searchAbort.current?.abort();

    if (query.trim().length < 3) {
      setAddressSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    searchTimer.current = setTimeout(async () => {
      const controller = new AbortController();
      searchAbort.current = controller;
      try {
        const res = await fetch(`/api/geo/resolve?address=${encodeURIComponent(query)}`, { signal: controller.signal });
        const data = await res.json();
        setAddressSuggestions(data.suggestions || []);
        setShowSuggestions(true);
        setActiveSuggestion(-1);
      } catch (error) {
        if (error.name !== 'AbortError') console.error('Address search error:', error);
      }
    }, 250);
  };

  const selectAddress = (suggestion) => {
    updateForm({ address: suggestion.address, lat: suggestion.lat, lng: suggestion.lng });
    setShowSuggestions(false);
    setAddressSuggestions([]);
  };

  const onAddressKeyDown = (e) => {
    if (!showSuggestions || addressSuggestions.length === 0) {
      if (e.key === 'Enter' && formData.lat) setStep(2);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveSuggestion(i => Math.min(i + 1, addressSuggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveSuggestion(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      selectAddress(addressSuggestions[Math.max(activeSuggestion, 0)]);
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  // Traduit le formulaire en caractéristiques pour le moteur d'ajustement
  const mapToCharacteristics = () => {
    const floorNumber = parseInt(formData.floor, 10);
    const chars = {
      type: formData.type,
      surface: parseFloat(formData.surface),

      floor: formData.type === 'appartement' && Number.isFinite(floorNumber)
        ? (floorNumber <= 0 ? 'rdc' : floorNumber <= 3 ? '1-3' : '4+')
        : undefined,
      hasElevator: formData.type === 'appartement' ? formData.hasElevator === true : undefined,

      outside: formData.hasBalconyTerrace
        ? (parseFloat(formData.balconyTerraceSurface) > 15 || formData.type === 'maison' ? 'large_terrace_or_garden' : 'small_balcony')
        : 'none',

      view: formData.view || undefined,

      parking: formData.hasIndoorParking
        ? (parseInt(formData.indoorParkingCount) >= 2 ? 'box_or_two' : 'one')
        : formData.hasOutdoorParking
          ? (parseInt(formData.outdoorParkingCount) >= 2 ? 'box_or_two' : 'one')
          : 'none',

      condition: formData.standing <= 2 ? 'to_renovate' : (formData.standing >= 4 ? 'renovated' : 'good'),

      dpe: formData.dpe || 'unknown',

      houseExtras: formData.type === 'maison'
        ? (formData.hasPool ? 'pool_or_quality_extras' : formData.hasBasement ? 'annex' : 'none')
        : undefined,

      plot: formData.type === 'maison' && formData.totalSurface
        ? (formData.totalSurface < 300 ? 'small' : formData.totalSurface < 600 ? 'medium' : 'large')
        : undefined
    };

    return Object.fromEntries(Object.entries(chars).filter(([, v]) => v !== undefined));
  };

  const postJson = async (url, body) => {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await res.json().catch(() => ({}));
    return { res, data };
  };

  const requestOTP = async (url) => {
    setLoading(true);
    setOtpError('');
    setOtpCode('');
    try {
      const { res, data } = await postJson(url, { phone: leadForm.phone });
      if (!res.ok) {
        setOtpError(data.error || "Erreur lors de l'envoi du code");
        return;
      }
      if (data.bypass) {
        setPhoneVerified(true);
        setOtpStep('verified');
        runEstimation();
        return;
      }
      setOtpStep('otp');
      setOtpCountdown(60);
    } catch (error) {
      console.error('OTP send error:', error);
      setOtpError("Erreur lors de l'envoi du code");
    } finally {
      setLoading(false);
    }
  };

  const handleSendOTP = (e) => {
    e?.preventDefault();
    if (!leadForm.phone) return setOtpError('Veuillez saisir votre numéro de téléphone');
    if (!leadForm.estimationReason) return setOtpError('Veuillez indiquer votre projet');
    // Téléphone déjà vérifié (nouvelle estimation dans la même session) : pas de nouveau SMS
    if (phoneVerified) {
      setOtpStep('verified');
      runEstimation();
      return;
    }
    requestOTP('/api/verification/send-otp');
  };

  const handleVerifyOTP = async (code = otpCode) => {
    if (code.length !== 6) {
      setOtpError('Veuillez saisir le code à 6 chiffres');
      return;
    }
    setLoading(true);
    setOtpError('');
    try {
      const { res, data } = await postJson('/api/verification/verify-otp', { phone: leadForm.phone, code });
      if (!res.ok) {
        setOtpError(data.error || 'Code invalide');
        setOtpCode('');
        return;
      }
      setPhoneVerified(true);
      setOtpStep('verified');
      runEstimation();
    } catch (error) {
      console.error('OTP verify error:', error);
      setOtpError('Erreur lors de la vérification');
    } finally {
      setLoading(false);
    }
  };

  // 1. enregistre le lead, 2. calcule l'estimation rattachée à ce lead
  const runEstimation = async () => {
    setLoading(true);
    setEstimateError('');

    if (typeof window !== 'undefined' && window.gtag_report_conversion) {
      window.gtag_report_conversion();
    }

    try {
      const lead = await postJson('/api/leads', {
        ...leadForm,
        property: formData,
        source: embedded ? 'alteregopatrimoine-embed' : 'estimation'
      });

      if (lead.res.status === 403) {
        // Vérification expirée : on redemande un code
        setPhoneVerified(false);
        setOtpStep('form');
        setOtpError('Votre vérification a expiré, merci de confirmer à nouveau votre numéro.');
        return;
      }
      if (!lead.res.ok) {
        setOtpStep('form');
        setOtpError(lead.data.error || "Impossible d'enregistrer votre demande.");
        return;
      }

      const estimate = await postJson('/api/estimate', {
        leadId: lead.data.leadId,
        address: formData.address,
        lat: formData.lat,
        lng: formData.lng,
        type: formData.type,
        surface: parseFloat(formData.surface),
        characteristics: mapToCharacteristics()
      });

      if (!estimate.res.ok) {
        setEstimateError(estimate.data.error || "Le calcul de l'estimation a échoué.");
        return;
      }

      setResults(estimate.data);
      setStep(7);
      if (typeof window !== 'undefined') {
        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push({ event: 'estimation_complete', estimation_reason: leadForm.estimationReason, property_type: formData.type });
      }
    } catch (error) {
      console.error('Estimation error:', error);
      setEstimateError("Erreur lors de l'estimation. Veuillez réessayer.");
    } finally {
      setLoading(false);
    }
  };

  const resetEstimation = () => {
    setFormData(INITIAL_FORM);
    setResults(null);
    setEstimateError('');
    // On garde les coordonnées et la vérification du téléphone pour une nouvelle estimation
    setOtpStep('form');
    setOtpCode('');
    setOtpError('');
    setStep(1);
  };

  const step3Valid = formData.surface && parseFloat(formData.surface) > 0 && formData.rooms &&
    (formData.type !== 'appartement' || (formData.floor !== '' && formData.floors !== '' && formData.hasElevator !== null));

  const leadValid = leadForm.name.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(leadForm.email) &&
    leadForm.phone && leadForm.estimationReason && leadForm.consent;

  return (
    <div ref={rootRef} className={`bg-ae-paper text-ae-ink ${embedded ? '' : 'min-h-screen flex flex-col'}`}>
      {!embedded && (
        <header className="border-b border-ae-line bg-ae-paper/90 backdrop-blur sticky top-0 z-30">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 h-16 sm:h-20 flex items-center justify-between gap-4">
            <a href={SITE_URL} aria-label="AlterEgo Patrimoine — accueil">
              <img src="/brand/logo-alterego-noir.png" alt="AlterEgo" className="h-10 sm:h-12 w-auto" />
            </a>
            <a href={SITE_URL} className="hidden sm:inline-flex items-center gap-2 text-sm font-semibold text-ae-muted hover:text-ae-brique transition-colors">
              <ArrowLeft className="w-4 h-4" /> Retour au site
            </a>
          </div>
        </header>
      )}

      <main className={`flex-1 ${embedded ? 'py-6' : 'py-10 sm:py-16'} ${step === 7 ? '!pb-0' : ''}`}>
        {step >= 2 && step <= 6 && (
          <StepHeader step={step} onBack={() => setStep(step - 1)} disabled={loading} />
        )}

        {/* Étape 1 : adresse */}
        {step === 1 && (
          <section className="mx-auto max-w-4xl px-4 sm:px-6">
            <div className="text-center mb-10 sm:mb-12">
              <p className="ae-eyebrow mb-5">Estimation immobilière gratuite</p>
              <h1 className="ae-h1 mb-6">Combien vaut votre bien&nbsp;?</h1>
              <p className="text-lg text-ae-muted max-w-2xl mx-auto">
                Une première valeur en 3 minutes, calculée à partir des ventes réelles
                enregistrées autour de chez vous. Un conseiller AlterEgo l'affine ensuite avec vous.
              </p>
            </div>

            <div className="ae-card p-5 sm:p-8">
              <label htmlFor="address" className="ae-label">Adresse du bien</label>
              <div className="relative">
                <MapPin className="w-5 h-5 text-ae-muted absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="address"
                  type="text"
                  role="combobox"
                  aria-expanded={showSuggestions && addressSuggestions.length > 0}
                  aria-controls="address-suggestions"
                  aria-autocomplete="list"
                  autoComplete="off"
                  placeholder="Ex. 2 rue des Italiens, 75009 Paris"
                  value={formData.address}
                  onChange={(e) => {
                    updateForm({ address: e.target.value, lat: null, lng: null });
                    searchAddress(e.target.value);
                  }}
                  onKeyDown={onAddressKeyDown}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                  className="ae-input pl-12 text-lg"
                />
                {showSuggestions && addressSuggestions.length > 0 && (
                  <ul
                    id="address-suggestions"
                    role="listbox"
                    className="absolute z-20 w-full mt-2 bg-white border border-ae-line rounded-2xl shadow-xl overflow-hidden max-h-72 overflow-y-auto"
                  >
                    {addressSuggestions.map((suggestion, idx) => (
                      <li
                        key={`${suggestion.address}-${idx}`}
                        role="option"
                        aria-selected={idx === activeSuggestion}
                        onMouseDown={(e) => { e.preventDefault(); selectAddress(suggestion); }}
                        onMouseEnter={() => setActiveSuggestion(idx)}
                        className={`flex items-center gap-3 px-4 py-3 cursor-pointer border-b border-ae-line last:border-b-0 ${
                          idx === activeSuggestion ? 'bg-ae-sand' : ''
                        }`}
                      >
                        <MapPin className="w-4 h-4 text-ae-brique shrink-0" />
                        <span>{suggestion.address}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {formData.address.length >= 3 && !formData.lat && !showSuggestions && (
                <p className="text-sm text-ae-muted mt-2">Sélectionnez une adresse dans la liste proposée.</p>
              )}

              <button
                type="button"
                onClick={() => setStep(2)}
                disabled={!formData.lat}
                className="ae-btn ae-btn-ink w-full mt-6"
              >
                Commencer l'estimation <ArrowRight className="w-5 h-5" />
              </button>
            </div>

            <ul className="grid sm:grid-cols-3 gap-4 sm:gap-6 mt-10">
              {[
                { icon: LineChart, title: 'Ventes réelles', text: 'Données publiques DVF des notaires, pas des prix affichés.' },
                { icon: Clock, title: '3 minutes', text: 'Quelques questions simples sur votre bien.' },
                { icon: ShieldCheck, title: 'Sans engagement', text: 'Gratuit, et vos données ne sont jamais revendues.' }
              ].map(({ icon: Icon, title, text }) => (
                <li key={title} className="flex gap-4 items-start">
                  <span className="w-10 h-10 rounded-full bg-ae-sand flex items-center justify-center shrink-0">
                    <Icon className="w-5 h-5 text-ae-brique" />
                  </span>
                  <div>
                    <p className="font-semibold">{title}</p>
                    <p className="text-sm text-ae-muted leading-relaxed">{text}</p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Étape 2 : type de bien */}
        {step === 2 && (
          <StepSection title="S'agit-il d'une maison ou d'un appartement ?">
            <div className="grid grid-cols-2 gap-4 sm:gap-6">
              {[
                { value: 'appartement', label: 'Appartement', icon: Building2 },
                { value: 'maison', label: 'Maison', icon: Home }
              ].map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={formData.type === value}
                  onClick={() => {
                    updateForm({ type: value });
                    setStep(3);
                  }}
                  className="ae-choice p-6 sm:p-12 flex flex-col items-center gap-4"
                >
                  <Icon className="w-12 h-12 sm:w-16 sm:h-16" strokeWidth={1.25} />
                  <span className="font-display text-xl sm:text-2xl">{label}</span>
                </button>
              ))}
            </div>
          </StepSection>
        )}

        {/* Étape 3 : caractéristiques principales */}
        {step === 3 && (
          <StepSection title="Les principales caractéristiques" subtitle="* Information obligatoire">
            <form
              className="ae-card p-5 sm:p-8 space-y-6"
              onSubmit={(e) => { e.preventDefault(); if (step3Valid) setStep(4); }}
            >
              <div className="grid sm:grid-cols-2 gap-5">
                <Field id="surface" label="Surface habitable (m²) *">
                  <input id="surface" type="number" inputMode="decimal" min="5" placeholder="75" className="ae-input"
                    value={formData.surface} onChange={(e) => updateForm({ surface: e.target.value })} />
                </Field>
                <Field id="totalSurface" label={formData.type === 'maison' ? 'Surface du terrain (m²)' : 'Surface totale, annexes comprises (m²)'}>
                  <input id="totalSurface" type="number" inputMode="decimal" min="0" placeholder={formData.type === 'maison' ? '500' : '80'} className="ae-input"
                    value={formData.totalSurface} onChange={(e) => updateForm({ totalSurface: e.target.value })} />
                </Field>
                <Field id="rooms" label="Nombre de pièces *" hint="Hors cuisine et salle de bains">
                  <input id="rooms" type="number" inputMode="numeric" min="1" placeholder="3" className="ae-input"
                    value={formData.rooms} onChange={(e) => updateForm({ rooms: e.target.value })} />
                </Field>
                <Field id="bathrooms" label="Salles de bains / d'eau">
                  <input id="bathrooms" type="number" inputMode="numeric" min="0" placeholder="1" className="ae-input"
                    value={formData.bathrooms} onChange={(e) => updateForm({ bathrooms: e.target.value })} />
                </Field>

                {formData.type === 'appartement' && (
                  <>
                    <Field id="floor" label="Étage du bien *" hint="0 pour un rez-de-chaussée">
                      <input id="floor" type="number" inputMode="numeric" min="0" placeholder="2" className="ae-input"
                        value={formData.floor} onChange={(e) => updateForm({ floor: e.target.value })} />
                    </Field>
                    <Field id="floors" label="Nombre d'étages de l'immeuble *">
                      <input id="floors" type="number" inputMode="numeric" min="0" placeholder="5" className="ae-input"
                        value={formData.floors} onChange={(e) => updateForm({ floors: e.target.value })} />
                    </Field>
                    <fieldset className="sm:col-span-2">
                      <legend className="ae-label">Ascenseur *</legend>
                      <div className="grid grid-cols-2 gap-3 max-w-sm">
                        {[{ value: true, label: 'Oui' }, { value: false, label: 'Non' }].map(opt => (
                          <button key={opt.label} type="button" aria-pressed={formData.hasElevator === opt.value}
                            onClick={() => updateForm({ hasElevator: opt.value })}
                            className="ae-choice py-3 font-semibold">
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </fieldset>
                  </>
                )}
              </div>

              <button type="submit" disabled={!step3Valid} className="ae-btn ae-btn-ink w-full">
                Continuer <ArrowRight className="w-5 h-5" />
              </button>
            </form>
          </StepSection>
        )}

        {/* Étape 4 : atouts */}
        {step === 4 && (
          <StepSection title="Les atouts du bien" subtitle="Facultatif, mais chaque détail rend l'estimation plus précise.">
            <div className="ae-card p-5 sm:p-8 space-y-8">
              <div className="space-y-3">
                <ExtraOption
                  label={formData.type === 'maison' ? 'Sous-sol ou dépendance' : 'Cave ou sous-sol'}
                  checked={formData.hasBasement}
                  onToggle={(checked) => updateForm({ hasBasement: checked, basementSurface: checked ? formData.basementSurface : '' })}
                  value={formData.basementSurface}
                  onValue={(v) => updateForm({ basementSurface: v })}
                  unit="m²"
                />
                <ExtraOption
                  label={formData.type === 'maison' ? 'Terrasse' : 'Balcon ou terrasse'}
                  checked={formData.hasBalconyTerrace}
                  onToggle={(checked) => updateForm({ hasBalconyTerrace: checked, balconyTerraceSurface: checked ? formData.balconyTerraceSurface : '' })}
                  value={formData.balconyTerraceSurface}
                  onValue={(v) => updateForm({ balconyTerraceSurface: v })}
                  unit="m²"
                />
                <ExtraOption
                  label="Stationnement extérieur"
                  checked={formData.hasOutdoorParking}
                  onToggle={(checked) => updateForm({ hasOutdoorParking: checked, outdoorParkingCount: checked ? formData.outdoorParkingCount : '' })}
                  value={formData.outdoorParkingCount}
                  onValue={(v) => updateForm({ outdoorParkingCount: v })}
                  unit="place(s)"
                />
                <ExtraOption
                  label="Garage ou parking couvert"
                  checked={formData.hasIndoorParking}
                  onToggle={(checked) => updateForm({ hasIndoorParking: checked, indoorParkingCount: checked ? formData.indoorParkingCount : '' })}
                  value={formData.indoorParkingCount}
                  onValue={(v) => updateForm({ indoorParkingCount: v })}
                  unit="place(s)"
                />
                {formData.type === 'maison' && (
                  <ExtraOption
                    label="Piscine"
                    checked={formData.hasPool}
                    onToggle={(checked) => updateForm({ hasPool: checked })}
                  />
                )}
              </div>

              <fieldset>
                <legend className="ae-label">Vue</legend>
                <p className="text-sm text-ae-muted mb-3">Une vue exceptionnelle : monument, mer, montagne…</p>
                <div className="grid grid-cols-3 gap-3">
                  {VIEW_OPTIONS.map(opt => (
                    <button key={opt.value} type="button" aria-pressed={formData.view === opt.value}
                      onClick={() => updateForm({ view: formData.view === opt.value ? '' : opt.value })}
                      className="ae-choice py-3 px-2 text-sm sm:text-base font-semibold">
                      {opt.label}
                    </button>
                  ))}
                </div>
              </fieldset>

              <button type="button" onClick={() => setStep(5)} className="ae-btn ae-btn-ink w-full">
                Continuer <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </StepSection>
        )}

        {/* Étape 5 : état */}
        {step === 5 && (
          <StepSection title="Son état général" subtitle="Facultatif, mais chaque détail rend l'estimation plus précise.">
            <div className="ae-card p-5 sm:p-8 space-y-8">
              <div className="grid sm:grid-cols-2 gap-6">
                <Field id="yearBuilt" label="Année de construction">
                  <input id="yearBuilt" type="number" inputMode="numeric" min="1500" max={new Date().getFullYear()} placeholder="1980" className="ae-input"
                    value={formData.yearBuilt} onChange={(e) => updateForm({ yearBuilt: e.target.value })} />
                </Field>

                <fieldset>
                  <legend className="ae-label">Diagnostic énergétique (DPE)</legend>
                  <div className="grid grid-cols-7 gap-1.5">
                    {Object.keys(DPE_COLORS).map(letter => (
                      <button key={letter} type="button" aria-pressed={formData.dpe === letter}
                        aria-label={`DPE ${letter}`}
                        onClick={() => updateForm({ dpe: formData.dpe === letter ? '' : letter })}
                        className="ae-choice relative h-12 font-display text-lg overflow-hidden">
                        <span className="absolute inset-x-0 bottom-0 h-1.5" style={{ background: DPE_COLORS[letter] }} />
                        {letter}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-ae-muted mt-2">Laissez vide si vous ne le connaissez pas.</p>
                </fieldset>
              </div>

              <fieldset>
                <legend className="ae-label">Comment évaluez-vous son état&nbsp;?</legend>
                <div className="grid grid-cols-5 gap-2 sm:gap-3">
                  {STANDING_LEVELS.map(level => (
                    <button key={level.value} type="button" aria-pressed={formData.standing === level.value}
                      onClick={() => updateForm({ standing: level.value })}
                      className="ae-choice py-4 px-1 flex flex-col items-center gap-1">
                      <span className="font-display text-2xl">{level.value}</span>
                      <span className="text-[11px] sm:text-xs font-semibold text-ae-muted leading-tight text-center">{level.label}</span>
                    </button>
                  ))}
                </div>
                <p className="text-center mt-3 text-sm text-ae-muted">
                  Le bien {STANDING_LEVELS.find(l => l.value === formData.standing)?.sentence}.
                </p>
              </fieldset>

              <button type="button" onClick={() => setStep(6)} className="ae-btn ae-btn-ink w-full">
                Continuer <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </StepSection>
        )}

        {/* Étape 6 : coordonnées + vérification SMS */}
        {step === 6 && (
          <StepSection
            title="Votre estimation est presque prête"
            subtitle="Indiquez où vous l'envoyer. Un conseiller AlterEgo pourra ensuite l'affiner avec vous, sans engagement."
          >
            <div className="ae-card p-5 sm:p-8">
              {otpStep === 'form' && (
                <form className="space-y-5" onSubmit={handleSendOTP} noValidate>
                  <Field id="name" label="Nom complet *">
                    <input id="name" autoComplete="name" placeholder="Jean Dupont" className="ae-input"
                      value={leadForm.name} onChange={(e) => updateLead({ name: e.target.value })} />
                  </Field>
                  <div className="grid sm:grid-cols-2 gap-5">
                    <Field id="email" label="Email *">
                      <input id="email" type="email" autoComplete="email" placeholder="jean.dupont@email.fr" className="ae-input"
                        value={leadForm.email} onChange={(e) => updateLead({ email: e.target.value })} />
                    </Field>
                    <Field id="phone" label="Téléphone mobile *" hint={phoneVerified ? 'Numéro déjà vérifié' : 'Un code de vérification vous sera envoyé par SMS'}>
                      <input id="phone" type="tel" autoComplete="tel" placeholder="06 12 34 56 78" className="ae-input"
                        value={leadForm.phone}
                        onChange={(e) => {
                          updateLead({ phone: e.target.value });
                          setPhoneVerified(false);
                        }} />
                    </Field>
                  </div>

                  <fieldset>
                    <legend className="ae-label">Votre projet *</legend>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { value: 'Vendre', label: 'Vendre', text: 'Je souhaite vendre ce bien' },
                        { value: 'Acheter', label: 'Acheter', text: "J'envisage d'acheter ce bien" }
                      ].map(opt => (
                        <button key={opt.value} type="button" aria-pressed={leadForm.estimationReason === opt.value}
                          onClick={() => updateLead({ estimationReason: opt.value })}
                          className="ae-choice p-4 text-left">
                          <span className="block font-semibold">{opt.label}</span>
                          <span className="block text-sm text-ae-muted mt-0.5">{opt.text}</span>
                        </button>
                      ))}
                    </div>
                  </fieldset>

                  <label htmlFor="consent" className="flex items-start gap-3 p-4 rounded-2xl bg-ae-sand cursor-pointer">
                    <input id="consent" type="checkbox" className="ae-checkbox mt-0.5"
                      checked={leadForm.consent} onChange={(e) => updateLead({ consent: e.target.checked })} />
                    <span className="text-sm text-ae-muted leading-relaxed">
                      J'accepte d'être contacté par AlterEgo et ses partenaires pour recevoir mon estimation détaillée
                      et bénéficier d'un accompagnement personnalisé dans mon projet immobilier. *
                    </span>
                  </label>

                  {otpError && <ErrorMessage>{otpError}</ErrorMessage>}

                  <button type="submit" disabled={!leadValid || loading} className="ae-btn ae-btn-brique w-full">
                    {loading
                      ? <><Loader2 className="w-5 h-5 animate-spin" /> Envoi du code…</>
                      : <>Recevoir mon estimation <ArrowRight className="w-5 h-5" /></>}
                  </button>
                </form>
              )}

              {otpStep === 'otp' && (
                <div className="space-y-6 text-center">
                  <div>
                    <h3 className="ae-h3 mb-2">Vérifiez votre téléphone</h3>
                    <p className="text-ae-muted">
                      Saisissez le code à 6 chiffres envoyé au <strong className="text-ae-ink">{leadForm.phone}</strong>
                    </p>
                  </div>

                  <div className="flex justify-center">
                    <InputOTP
                      maxLength={6}
                      value={otpCode}
                      autoFocus
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      onChange={(value) => {
                        setOtpCode(value);
                        setOtpError('');
                        if (value.length === 6) handleVerifyOTP(value);
                      }}
                      disabled={loading}
                    >
                      <InputOTPGroup>
                        <InputOTPSlot index={0} className="h-12 w-11 text-lg bg-white" />
                        <InputOTPSlot index={1} className="h-12 w-11 text-lg bg-white" />
                        <InputOTPSlot index={2} className="h-12 w-11 text-lg bg-white" />
                      </InputOTPGroup>
                      <InputOTPSeparator />
                      <InputOTPGroup>
                        <InputOTPSlot index={3} className="h-12 w-11 text-lg bg-white" />
                        <InputOTPSlot index={4} className="h-12 w-11 text-lg bg-white" />
                        <InputOTPSlot index={5} className="h-12 w-11 text-lg bg-white" />
                      </InputOTPGroup>
                    </InputOTP>
                  </div>

                  {otpError && <ErrorMessage>{otpError}</ErrorMessage>}

                  <button type="button" onClick={() => handleVerifyOTP()} disabled={otpCode.length !== 6 || loading}
                    className="ae-btn ae-btn-ink w-full">
                    {loading ? <><Loader2 className="w-5 h-5 animate-spin" /> Vérification…</> : 'Valider le code'}
                  </button>

                  <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-6 pt-2 text-sm">
                    <button type="button" onClick={() => requestOTP('/api/verification/resend-otp')}
                      disabled={otpCountdown > 0 || loading}
                      className="inline-flex items-center gap-1.5 font-semibold text-ae-ink hover:text-ae-brique disabled:text-ae-muted disabled:cursor-not-allowed">
                      <RotateCcw className="w-4 h-4" />
                      {otpCountdown > 0 ? `Renvoyer le code (${otpCountdown} s)` : 'Renvoyer le code'}
                    </button>
                    <button type="button"
                      onClick={() => { setOtpStep('form'); setOtpCode(''); setOtpError(''); }}
                      className="text-ae-muted underline underline-offset-4 hover:text-ae-ink">
                      Modifier mon numéro
                    </button>
                  </div>
                </div>
              )}

              {otpStep === 'verified' && (
                <div className="text-center py-6 space-y-5">
                  {estimateError ? (
                    <>
                      <ErrorMessage>{estimateError}</ErrorMessage>
                      <button type="button" onClick={runEstimation} disabled={loading} className="ae-btn ae-btn-ink">
                        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <RotateCcw className="w-5 h-5" />} Réessayer
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="w-14 h-14 rounded-full bg-ae-sauge mx-auto flex items-center justify-center">
                        <Check className="w-7 h-7" />
                      </span>
                      <div>
                        <h3 className="ae-h3 mb-2">Numéro vérifié</h3>
                        <p className="text-ae-muted inline-flex items-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin" /> Analyse des ventes autour de votre bien…
                        </p>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            <ul className="flex flex-col sm:flex-row sm:justify-center gap-2 sm:gap-6 mt-6 text-sm text-ae-muted">
              {['Gratuit et sans engagement', 'Basée sur les ventes réelles DVF', 'Un conseiller près de chez vous'].map(t => (
                <li key={t} className="inline-flex items-center gap-2"><Check className="w-4 h-4 text-ae-brique" /> {t}</li>
              ))}
            </ul>
          </StepSection>
        )}

        {/* Étape 7 : résultats */}
        {step === 7 && results && (
          <Results results={results} formData={formData} onReset={resetEstimation} />
        )}
      </main>

      {!embedded && (
        <footer className="bg-ae-ink text-ae-paper">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 py-10 flex flex-col sm:flex-row gap-6 sm:items-center sm:justify-between">
            <img src="/brand/logo-alterego-blanc.png" alt="AlterEgo" className="h-10 w-auto self-start" />
            <div className="text-sm text-ae-paper/70 sm:text-right space-y-1">
              <p>© {new Date().getFullYear()} AlterEgo Patrimoine. Tous droits réservés.</p>
              <p>Estimations basées sur DVF (open data) — valeurs indicatives, non contractuelles.</p>
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}

function StepHeader({ step, onBack, disabled }) {
  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 mb-8">
      <div className="flex items-center justify-between mb-3">
        <button type="button" onClick={onBack} disabled={disabled}
          className="inline-flex items-center gap-2 text-sm font-semibold text-ae-muted hover:text-ae-ink disabled:opacity-40">
          <ArrowLeft className="w-4 h-4" /> Retour
        </button>
        <span className="ae-eyebrow">Étape {step} sur {TOTAL_STEPS}</span>
      </div>
      <div className="h-1 rounded-full bg-ae-line overflow-hidden" role="progressbar"
        aria-valuemin={1} aria-valuemax={TOTAL_STEPS} aria-valuenow={step}>
        <div className="h-full bg-ae-brique transition-all duration-500" style={{ width: `${(step / TOTAL_STEPS) * 100}%` }} />
      </div>
    </div>
  );
}

function StepSection({ title, subtitle, children }) {
  return (
    <section className="mx-auto max-w-3xl px-4 sm:px-6">
      <h2 className="ae-h2 mb-3">{title}</h2>
      {subtitle && <p className="text-ae-muted mb-8">{subtitle}</p>}
      {!subtitle && <div className="mb-8" />}
      {children}
    </section>
  );
}

function Field({ id, label, hint, children }) {
  return (
    <div>
      <label htmlFor={id} className="ae-label">{label}</label>
      {children}
      {hint && <p className="text-xs text-ae-muted mt-1.5">{hint}</p>}
    </div>
  );
}

function ExtraOption({ label, checked, onToggle, value, onValue, unit }) {
  return (
    <div className={`ae-choice p-4 ${checked ? 'is-selected' : ''}`}>
      <label className="flex items-center gap-3 cursor-pointer">
        <input type="checkbox" className="ae-checkbox" checked={checked} onChange={(e) => onToggle(e.target.checked)} />
        <span className="font-semibold">{label}</span>
      </label>
      {checked && onValue && (
        <div className="mt-3 ml-8 flex items-center gap-3">
          <input type="number" inputMode="numeric" min="0" aria-label={`${label} (${unit})`}
            placeholder={unit === 'm²' ? 'Surface' : 'Nombre'}
            value={value} onChange={(e) => onValue(e.target.value)}
            className="ae-input w-32 min-h-0 py-2" />
          <span className="text-ae-muted text-sm">{unit}</span>
        </div>
      )}
    </div>
  );
}

function ErrorMessage({ children }) {
  return (
    <div role="alert" className="p-3 rounded-xl border border-ae-brique/40 bg-ae-brique/5 text-ae-brique text-sm">
      {children}
    </div>
  );
}

function Results({ results, formData, onReset }) {
  const { finalPrice, adjustments, dvf, market } = results;
  const confidence = finalPrice?.confidence ?? 0;
  const confidenceLabel = confidence >= 80 ? 'Élevée' : confidence >= 70 ? 'Bonne' : 'Modérée';

  return (
    <div>
      <section className="mx-auto max-w-6xl px-4 sm:px-6 mb-8">
        <p className="ae-eyebrow mb-3">Résultat de l'estimation</p>
        <h1 className="ae-h2 mb-2">{formData.address}</h1>
        <p className="text-ae-muted">
          {formData.type === 'maison' ? 'Maison' : 'Appartement'} · {formData.surface} m²
          {formData.rooms ? ` · ${formData.rooms} pièce${formData.rooms > 1 ? 's' : ''}` : ''}
        </p>
      </section>

      {/* Bande sombre : prix */}
      {finalPrice ? (
        <section className="mx-auto max-w-6xl px-4 sm:px-6 mb-8">
          <div className="rounded-card bg-ae-ink text-ae-paper p-6 sm:p-12">
            <div className="grid lg:grid-cols-[1.4fr_1fr] gap-10 items-end">
              <div>
                <p className="ae-eyebrow !text-ae-paper/60 mb-4">Valeur estimée</p>
                <p className="font-display font-extrabold tracking-tight leading-none text-[clamp(2.75rem,7vw,5.5rem)]">
                  {formatEuros(finalPrice.mid)}
                </p>
                <p className="mt-5 text-ae-paper/75 text-lg">
                  Fourchette : <strong className="text-ae-paper">{formatEuros(finalPrice.low)}</strong> à{' '}
                  <strong className="text-ae-paper">{formatEuros(finalPrice.high)}</strong>
                </p>
              </div>

              <dl className="grid grid-cols-2 gap-6 lg:border-l lg:border-ae-paper/15 lg:pl-10">
                {adjustments?.adjustedPricePerM2 && (
                  <div>
                    <dt className="text-sm text-ae-paper/60 mb-1">Prix au m²</dt>
                    <dd className="font-display text-2xl">{formatEuros(adjustments.adjustedPricePerM2)}</dd>
                  </div>
                )}
                <div>
                  <dt className="text-sm text-ae-paper/60 mb-1">Fiabilité</dt>
                  <dd className="font-display text-2xl">{confidenceLabel}</dd>
                  <div className="mt-2 h-1 rounded-full bg-ae-paper/15 overflow-hidden">
                    <div className="h-full bg-ae-brique" style={{ width: `${confidence}%` }} />
                  </div>
                </div>
                {dvf?.count > 0 && (
                  <div className="col-span-2 text-sm text-ae-paper/60">
                    Calculée sur {dvf.count} vente{dvf.count > 1 ? 's' : ''} dans un rayon de {dvf.radius} m, sur {dvf.months} mois.
                  </div>
                )}
              </dl>
            </div>
          </div>
        </section>
      ) : (
        <section className="mx-auto max-w-6xl px-4 sm:px-6 mb-8">
          <div className="ae-card p-6 sm:p-10">
            <p className="ae-eyebrow mb-3">Estimation à affiner</p>
            <h2 className="ae-h3 mb-3">Pas assez de ventes comparables dans ce secteur</h2>
            <p className="text-ae-muted max-w-2xl">
              {dvf?.warning || "Nous n'avons pas trouvé suffisamment de ventes récentes similaires pour calculer une valeur fiable."}{' '}
              Un conseiller AlterEgo vous recontacte pour réaliser une estimation personnalisée.
            </p>
          </div>
        </section>
      )}

      {dvf?.warning && finalPrice && (
        <div className="mx-auto max-w-6xl px-4 sm:px-6 mb-8">
          <p className="p-4 rounded-2xl bg-ae-sand text-sm text-ae-muted">{dvf.warning}</p>
        </div>
      )}

      <div className="mx-auto max-w-6xl px-4 sm:px-6 grid lg:grid-cols-2 gap-6 mb-8">
        {/* Détail des ajustements */}
        {adjustments?.adjustments?.length > 0 && (
          <section className="ae-card p-6 sm:p-8">
            <h2 className="ae-h3 mb-6">Comment nous l'avons calculée</h2>
            <div className="flex justify-between items-baseline pb-4 border-b border-ae-line">
              <span className="font-semibold">Prix de référence du quartier</span>
              <span className="font-display text-lg">{formatEuros(adjustments.basePricePerM2)}/m²</span>
            </div>
            <ul>
              {adjustments.adjustments.map((adj, idx) => (
                <li key={idx} className="flex justify-between items-center gap-4 py-3 border-b border-ae-line">
                  <div>
                    <p className="font-medium">{adj.factor}</p>
                    <p className="text-sm text-ae-muted">{adj.description}</p>
                  </div>
                  <span className={`font-semibold tabular-nums ${adj.impact > 0 ? 'text-ae-ink' : adj.impact < 0 ? 'text-ae-brique' : 'text-ae-muted'}`}>
                    {adj.impact > 0 ? '+' : ''}{adj.impact.toFixed(1)} %
                  </span>
                </li>
              ))}
            </ul>
            <div className="flex justify-between items-baseline pt-4">
              <span className="font-semibold">Prix retenu pour votre bien</span>
              <span className="font-display text-lg">{formatEuros(adjustments.adjustedPricePerM2)}/m²</span>
            </div>
          </section>
        )}

        {/* Ventes comparables */}
        {dvf?.comparables?.length > 0 && (
          <section className="ae-card p-6 sm:p-8">
            <h2 className="ae-h3 mb-6">Ventes récentes à proximité</h2>
            <ul className="divide-y divide-ae-line">
              {dvf.comparables.slice(0, 6).map(sale => (
                <li key={sale.id} className="py-3 flex justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{sale.address}</p>
                    <p className="text-sm text-ae-muted">
                      {sale.surface} m² · {formatDate(sale.date)} · à {sale.distance} m
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-semibold tabular-nums">{formatEuros(sale.price)}</p>
                    <p className="text-sm text-ae-muted tabular-nums">{formatEuros(sale.pricePerM2)}/m²</p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      {dvf?.comparables?.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 sm:px-6 mb-8">
          <div className="ae-card p-4 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4 px-1">
              <h2 className="ae-h3">Carte des ventes</h2>
              <div className="flex gap-5 text-sm text-ae-muted">
                <span className="inline-flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-ae-brique" /> Votre bien</span>
                <span className="inline-flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-ae-ink" /> Ventes DVF</span>
              </div>
            </div>
            <EstimationMap
              center={[formData.lat, formData.lng]}
              radius={dvf.radius}
              dvfSales={dvf.comparables}
            />
          </div>
        </section>
      )}

      {market?.listings?.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 sm:px-6 mb-8">
          <div className="ae-card p-6 sm:p-8">
            <h2 className="ae-h3 mb-4">Biens actuellement en vente</h2>
            <ul className="divide-y divide-ae-line">
              {market.listings.slice(0, 6).map(listing => (
                <li key={listing.url} className="py-3 flex justify-between gap-4">
                  <a href={listing.url} target="_blank" rel="noopener noreferrer" className="font-medium hover:text-ae-brique truncate">{listing.title}</a>
                  <span className="tabular-nums shrink-0">{formatEuros(listing.price)}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* Appel à l'action */}
      <section className="bg-ae-sand py-12 sm:py-16">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 text-center">
          <p className="ae-eyebrow mb-4">Aller plus loin</p>
          <h2 className="ae-h2 mb-5">Affinez cette estimation avec un conseiller AlterEgo</h2>
          <p className="text-ae-muted text-lg max-w-2xl mx-auto mb-8">
            Une visite permet de prendre en compte ce que les données ne voient pas :
            luminosité, prestations, copropriété, potentiel. C'est gratuit et sans engagement.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a href={CONTACT_URL} target="_top" className="ae-btn ae-btn-brique">
              Prendre rendez-vous <ArrowRight className="w-5 h-5" />
            </a>
            <button type="button" onClick={onReset} className="ae-btn ae-btn-outline">
              Nouvelle estimation
            </button>
          </div>
          <p className="text-xs text-ae-muted mt-8 max-w-2xl mx-auto">{results.disclaimer}</p>
        </div>
      </section>
    </div>
  );
}
