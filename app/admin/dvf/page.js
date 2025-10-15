'use client';

import { useState, useEffect } from 'react';

export default function DVFAdminPage() {
  const [stats, setStats] = useState({ total: 0, byType: {} });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!localStorage.getItem('adminToken')) {
      window.location.href = '/admin';
      return;
    }
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const token = localStorage.getItem('adminToken');
      const res = await fetch('/api/admin/dvf/stats', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const startIngestion = async () => {
    if (!confirm('Charger ~900 000 transactions DVF depuis data.gouv.fr ?\n\nCela prendra 15-30 minutes.')) {
      return;
    }
    
    setLoading(true);
    setMessage('⏳ Chargement en cours... (15-30 min)');

    try {
      const token = localStorage.getItem('adminToken');
      const res = await fetch('/api/admin/dvf/start', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.ok) {
        setMessage('✅ Ingestion démarrée ! Rechargez la page dans 20 minutes pour voir les résultats.');
      } else {
        const data = await res.json();
        setMessage('❌ Erreur: ' + (data.error || 'Échec'));
      }
    } catch (err) {
      setMessage('❌ Erreur: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const clearData = async () => {
    if (!confirm('Supprimer TOUTES les données DVF ?\n\nCette action est irréversible !')) {
      return;
    }

    setLoading(true);
    setMessage('⏳ Suppression en cours...');
    
    try {
      const token = localStorage.getItem('adminToken');
      const res = await fetch('/api/admin/dvf/clear', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.ok) {
        setMessage('✅ Base vidée avec succès');
        await loadStats();
      } else {
        setMessage('❌ Erreur lors de la suppression');
      }
    } catch (err) {
      setMessage('❌ Erreur: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f9fafb', padding: '2rem' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        
        {/* Header */}
        <div style={{ marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
            📊 Gestion des Données DVF
          </h1>
          <p style={{ color: '#6b7280' }}>
            Chargement automatique depuis l'API officielle data.gouv.fr
          </p>
          <button 
            onClick={() => window.location.href = '/admin'}
            style={{
              marginTop: '1rem',
              padding: '0.5rem 1rem',
              background: '#e5e7eb',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            ← Retour Admin
          </button>
        </div>

        {/* Message */}
        {message && (
          <div style={{ 
            background: message.includes('❌') ? '#fee2e2' : '#d1fae5', 
            border: `1px solid ${message.includes('❌') ? '#fca5a5' : '#86efac'}`,
            borderRadius: '8px',
            padding: '1rem',
            marginBottom: '1.5rem',
            fontSize: '1rem'
          }}>
            {message}
          </div>
        )}

        {/* Statistiques */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', 
          gap: '1.5rem', 
          marginBottom: '2rem' 
        }}>
          <div style={{ background: 'white', borderRadius: '8px', padding: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.5rem' }}>Total Transactions</div>
            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#111827' }}>
              {stats.total.toLocaleString()}
            </div>
          </div>

          <div style={{ background: 'white', borderRadius: '8px', padding: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.5rem' }}>Appartements</div>
            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#111827' }}>
              {(stats.byType?.appartement || 0).toLocaleString()}
            </div>
          </div>

          <div style={{ background: 'white', borderRadius: '8px', padding: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.5rem' }}>Maisons</div>
            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#111827' }}>
              {(stats.byType?.maison || 0).toLocaleString()}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div style={{ background: 'white', borderRadius: '8px', padding: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '1rem' }}>Actions</h2>
          
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <button
              onClick={startIngestion}
              disabled={loading}
              style={{
                padding: '0.75rem 1.5rem',
                background: loading ? '#9ca3af' : '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '1rem',
                fontWeight: '500',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.5 : 1
              }}
            >
              {loading ? '⏳ Chargement...' : '📥 Charger les Données DVF'}
            </button>

            <button
              onClick={loadStats}
              disabled={loading}
              style={{
                padding: '0.75rem 1.5rem',
                background: 'white',
                color: '#374151',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '1rem',
                fontWeight: '500',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.5 : 1
              }}
            >
              🔄 Rafraîchir
            </button>

            <button
              onClick={clearData}
              disabled={loading || stats.total === 0}
              style={{
                padding: '0.75rem 1.5rem',
                background: (loading || stats.total === 0) ? '#fca5a5' : '#ef4444',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '1rem',
                fontWeight: '500',
                cursor: (loading || stats.total === 0) ? 'not-allowed' : 'pointer',
                opacity: (loading || stats.total === 0) ? 0.5 : 1
              }}
            >
              🗑️ Vider la Base
            </button>
          </div>
        </div>

        {/* Info */}
        <div style={{ background: '#eff6ff', borderRadius: '8px', padding: '1.5rem', border: '1px solid #bfdbfe' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '0.5rem', color: '#1e40af' }}>
            ℹ️ Informations
          </h3>
          <ul style={{ marginLeft: '1.5rem', color: '#1e3a8a', lineHeight: '1.6' }}>
            <li>Le chargement télécharge ~900 000 transactions depuis data.gouv.fr</li>
            <li>Durée estimée : 15-30 minutes</li>
            <li>Les données sont mises à jour automatiquement (5 dernières années)</li>
            <li>Une fois chargées, les estimations fonctionneront immédiatement</li>
          </ul>
        </div>

      </div>
    </div>
  );
}
