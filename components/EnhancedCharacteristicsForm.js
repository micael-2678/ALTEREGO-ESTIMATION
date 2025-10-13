'use client'

import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function EnhancedCharacteristicsForm({ type, characteristics, onChange, onNext }) {
  const updateChar = (field, value) => {
    onChange({ ...characteristics, [field]: value });
  };

  const isComplete = () => {
    // Questions obligatoires selon le type
    const required = ['outside', 'view', 'parking', 'condition', 'dpe'];
    
    if (type === 'appartement') {
      required.push('floor', 'hasElevator');
    }
    
    if (type === 'maison') {
      required.push('plot', 'houseExtras');
    }
    
    return required.every(field => characteristics[field] !== undefined && characteristics[field] !== null);
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-semibold mb-4">Affinez votre estimation</h3>
        <p className="text-gray-600 mb-6">
          Ces informations permettent d'ajuster le prix selon les caractéristiques précises de votre bien.
        </p>
      </div>

      {/* Étage & Ascenseur (Appartement) */}
      {type === 'appartement' && (
        <>
          <Card className="p-4">
            <Label className="text-base font-semibold mb-3 block">À quel étage se trouve le bien ?</Label>
            <div className="grid grid-cols-3 gap-3">
              {['rdc', '1-3', '4+'].map(floor => (
                <button
                  key={floor}
                  onClick={() => updateChar('floor', floor)}
                  className={`p-4 border-2 rounded-lg text-center transition-all ${
                    characteristics.floor === floor
                      ? 'border-black bg-gray-50 font-semibold'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {floor === 'rdc' ? 'RDC' : floor === '1-3' ? 'Étages 1-3' : 'Étage 4+'}
                </button>
              ))}
            </div>
          </Card>

          <Card className="p-4">
            <Label className="text-base font-semibold mb-3 block">Y a-t-il un ascenseur ?</Label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => updateChar('hasElevator', true)}
                className={`p-4 border-2 rounded-lg transition-all ${
                  characteristics.hasElevator === true
                    ? 'border-black bg-gray-50 font-semibold'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                ✓ Oui
              </button>
              <button
                onClick={() => updateChar('hasElevator', false)}
                className={`p-4 border-2 rounded-lg transition-all ${
                  characteristics.hasElevator === false
                    ? 'border-black bg-gray-50 font-semibold'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                ✗ Non
              </button>
            </div>
          </Card>
        </>
      )}

      {/* Extérieur */}
      <Card className="p-4">
        <Label className="text-base font-semibold mb-3 block">Espace extérieur</Label>
        <div className="grid grid-cols-3 gap-3">
          <button
            onClick={() => updateChar('outside', 'none')}
            className={`p-4 border-2 rounded-lg text-center transition-all ${
              characteristics.outside === 'none'
                ? 'border-black bg-gray-50 font-semibold'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            Aucun
          </button>
          <button
            onClick={() => updateChar('outside', 'small_balcony')}
            className={`p-4 border-2 rounded-lg text-center transition-all ${
              characteristics.outside === 'small_balcony'
                ? 'border-black bg-gray-50 font-semibold'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            Petit balcon
          </button>
          <button
            onClick={() => updateChar('outside', 'large_terrace_or_garden')}
            className={`p-4 border-2 rounded-lg text-center transition-all ${
              characteristics.outside === 'large_terrace_or_garden'
                ? 'border-black bg-gray-50 font-semibold'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            Grande terrasse / Jardin
          </button>
        </div>
      </Card>

      {/* Vue */}
      <Card className="p-4">
        <Label className="text-base font-semibold mb-3 block">Vue depuis le bien</Label>
        <div className="grid grid-cols-3 gap-3">
          <button
            onClick={() => updateChar('view', 'vis_a_vis')}
            className={`p-4 border-2 rounded-lg text-center transition-all ${
              characteristics.view === 'vis_a_vis'
                ? 'border-black bg-gray-50 font-semibold'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            Vis-à-vis
          </button>
          <button
            onClick={() => updateChar('view', 'degagee')}
            className={`p-4 border-2 rounded-lg text-center transition-all ${
              characteristics.view === 'degagee'
                ? 'border-black bg-gray-50 font-semibold'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            Dégagée
          </button>
          <button
            onClick={() => updateChar('view', 'exceptionnelle')}
            className={`p-4 border-2 rounded-lg text-center transition-all ${
              characteristics.view === 'exceptionnelle'
                ? 'border-black bg-gray-50 font-semibold'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            Exceptionnelle
          </button>
        </div>
      </Card>

      {/* Parking */}
      <Card className="p-4">
        <Label className="text-base font-semibold mb-3 block">Stationnement</Label>
        <div className="grid grid-cols-3 gap-3">
          <button
            onClick={() => updateChar('parking', 'none')}
            className={`p-4 border-2 rounded-lg text-center transition-all ${
              characteristics.parking === 'none'
                ? 'border-black bg-gray-50 font-semibold'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            Aucun
          </button>
          <button
            onClick={() => updateChar('parking', 'one')}
            className={`p-4 border-2 rounded-lg text-center transition-all ${
              characteristics.parking === 'one'
                ? 'border-black bg-gray-50 font-semibold'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            1 place
          </button>
          <button
            onClick={() => updateChar('parking', 'box_or_two')}
            className={`p-4 border-2 rounded-lg text-center transition-all ${
              characteristics.parking === 'box_or_two'
                ? 'border-black bg-gray-50 font-semibold'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            Box ou 2 places
          </button>
        </div>
      </Card>

      {/* État */}
      <Card className="p-4">
        <Label className="text-base font-semibold mb-3 block">État général / Standing</Label>
        <div className="grid grid-cols-3 gap-3">
          <button
            onClick={() => updateChar('condition', 'to_renovate')}
            className={`p-4 border-2 rounded-lg text-center transition-all ${
              characteristics.condition === 'to_renovate'
                ? 'border-black bg-gray-50 font-semibold'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            À rénover
          </button>
          <button
            onClick={() => updateChar('condition', 'good')}
            className={`p-4 border-2 rounded-lg text-center transition-all ${
              characteristics.condition === 'good'
                ? 'border-black bg-gray-50 font-semibold'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            Bon état
          </button>
          <button
            onClick={() => updateChar('condition', 'renovated')}
            className={`p-4 border-2 rounded-lg text-center transition-all ${
              characteristics.condition === 'renovated'
                ? 'border-black bg-gray-50 font-semibold'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            Rénové récent
          </button>
        </div>
      </Card>

      {/* DPE */}
      <Card className="p-4">
        <Label className="text-base font-semibold mb-3 block">Diagnostic de Performance Énergétique (DPE)</Label>
        <div className="grid grid-cols-4 gap-2">
          {['A', 'B', 'C', 'D', 'E', 'F', 'G', 'unknown'].map(dpe => (
            <button
              key={dpe}
              onClick={() => updateChar('dpe', dpe)}
              className={`p-3 border-2 rounded-lg text-center font-semibold transition-all ${
                characteristics.dpe === dpe
                  ? 'border-black bg-gray-50'
                  : 'border-gray-200 hover:border-gray-300'
              } ${dpe === 'A' || dpe === 'B' || dpe === 'C' ? 'bg-green-50' : ''}
              ${dpe === 'F' || dpe === 'G' ? 'bg-red-50' : ''}`}
            >
              {dpe === 'unknown' ? '?' : dpe}
            </button>
          ))}
        </div>
      </Card>

      {/* Maison - Parcelle */}
      {type === 'maison' && (
        <>
          <Card className="p-4">
            <Label className="text-base font-semibold mb-3 block">Taille de la parcelle</Label>
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={() => updateChar('plot', 'small')}
                className={`p-4 border-2 rounded-lg text-center transition-all ${
                  characteristics.plot === 'small'
                    ? 'border-black bg-gray-50 font-semibold'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                Petite
              </button>
              <button
                onClick={() => updateChar('plot', 'medium')}
                className={`p-4 border-2 rounded-lg text-center transition-all ${
                  characteristics.plot === 'medium'
                    ? 'border-black bg-gray-50 font-semibold'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                Moyenne
              </button>
              <button
                onClick={() => updateChar('plot', 'large')}
                className={`p-4 border-2 rounded-lg text-center transition-all ${
                  characteristics.plot === 'large'
                    ? 'border-black bg-gray-50 font-semibold'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                Grande
              </button>
            </div>
          </Card>

          <Card className="p-4">
            <Label className="text-base font-semibold mb-3 block">Équipements supplémentaires</Label>
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={() => updateChar('houseExtras', 'none')}
                className={`p-4 border-2 rounded-lg text-center transition-all ${
                  characteristics.houseExtras === 'none'
                    ? 'border-black bg-gray-50 font-semibold'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                Aucun
              </button>
              <button
                onClick={() => updateChar('houseExtras', 'annex')}
                className={`p-4 border-2 rounded-lg text-center transition-all ${
                  characteristics.houseExtras === 'annex'
                    ? 'border-black bg-gray-50 font-semibold'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                Dépendance
              </button>
              <button
                onClick={() => updateChar('houseExtras', 'pool_or_quality_extras')}
                className={`p-4 border-2 rounded-lg text-center transition-all ${
                  characteristics.houseExtras === 'pool_or_quality_extras'
                    ? 'border-black bg-gray-50 font-semibold'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                Piscine / Équipements premium
              </button>
            </div>
          </Card>
        </>
      )}

      <Button
        onClick={onNext}
        disabled={!isComplete()}
        className="w-full bg-black hover:bg-gray-800 text-white py-6 text-lg"
      >
        Obtenir l'estimation détaillée →
      </Button>
    </div>
  );
}
