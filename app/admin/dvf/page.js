'use client';

import { useState, useEffect } from 'react';

export default function DVFAdminPage() {
  const [stats, setStats] = useState(null);
  const [ingestionState, setIngestionState] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Vérifier l'authentification
  useEffect(() => {
    const token = localStorage.getItem('adminToken');
    if (!token) {
      window.location.href = '/admin';
    } else {
      setIsAuthenticated(true);
    }
  }, []);

  // Récupérer les statistiques
  const fetchStats = async () => {
    try {
      const token = localStorage.getItem('adminToken');
      if (!token) {
        window.location.href = '/admin';
        return;
      }

      const res = await fetch('/api/admin/dvf/stats', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (res.status === 401) {
        router.push('/admin');
        return;
      }

      const data = await res.json();
      setStats(data);
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  };

  // Récupérer l'état de l'ingestion
  const fetchIngestionState = async () => {
    try {
      const token = localStorage.getItem('adminToken');
      if (!token) return;

      const res = await fetch('/api/admin/dvf/status', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (res.status === 401) {
        window.location.href = '/admin';
        return;
      }

      if (res.ok) {
        const data = await res.json();
        setIngestionState(data);
      }
    } catch (err) {
      console.error('Error fetching ingestion state:', err);
    }
  };

  // Démarrer l'ingestion
  const startIngestion = async () => {
    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('adminToken');
      const res = await fetch('/api/admin/dvf/start', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Erreur lors du démarrage');
      }

      const data = await res.json();
      setIngestionState(data.state);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Vider la base
  const clearData = async () => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer toutes les données DVF ? Cette action est irréversible.')) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('adminToken');
      const res = await fetch('/api/admin/dvf/clear', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!res.ok) {
        throw new Error('Erreur lors de la suppression');
      }

      await fetchStats();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Charger les données initiales
  useEffect(() => {
    fetchStats();
    fetchIngestionState();
  }, []);

  // Polling pour la progression
  useEffect(() => {
    if (ingestionState?.isRunning) {
      const interval = setInterval(() => {
        fetchIngestionState();
        fetchStats();
      }, 3000); // Mise à jour toutes les 3 secondes

      return () => clearInterval(interval);
    }
  }, [ingestionState?.isRunning]);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-gray-600">Vérification de l'authentification...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Gestion des Données DVF</h1>
          <p className="text-gray-600">
            Administration des données immobilières (Demandes de Valeurs Foncières)
          </p>
        </div>

        {/* Erreur */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
            <div className="text-red-800">{error}</div>
          </div>
        )}

        {/* Statistiques */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Transactions</CardTitle>
              <Database className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats ? stats.total.toLocaleString() : '...'}
              </div>
              {stats && stats.lastUpdate && (
                <p className="text-xs text-muted-foreground mt-1">
                  Dernière mise à jour : {new Date(stats.lastUpdate).toLocaleDateString('fr-FR')}
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Appartements</CardTitle>
              <Database className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats ? (stats.byType.appartement || 0).toLocaleString() : '...'}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Maisons</CardTitle>
              <Database className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats ? (stats.byType.maison || 0).toLocaleString() : '...'}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Progression de l'ingestion */}
        {ingestionState?.isRunning && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Ingestion en cours</CardTitle>
              <CardDescription>
                Téléchargement des données depuis l'API officielle data.gouv.fr
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span>Progression</span>
                    <span className="font-medium">{ingestionState.progress}%</span>
                  </div>
                  <Progress value={ingestionState.progress} className="h-2" />
                </div>

                {ingestionState.currentDepartment && (
                  <div className="text-sm text-gray-600">
                    📍 Département en cours : <span className="font-medium">{ingestionState.currentDepartment}</span>
                  </div>
                )}

                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Terminés</span>
                    <div className="font-medium text-green-600">{ingestionState.completed} / {ingestionState.totalDepartments}</div>
                  </div>
                  <div>
                    <span className="text-gray-600">Échecs</span>
                    <div className="font-medium text-red-600">{ingestionState.failed}</div>
                  </div>
                  <div>
                    <span className="text-gray-600">Démarré</span>
                    <div className="font-medium">{new Date(ingestionState.startTime).toLocaleTimeString('fr-FR')}</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Actions</CardTitle>
            <CardDescription>
              Gérer le chargement et la suppression des données DVF
            </CardDescription>
          </CardHeader>
          <CardContent className="flex gap-4">
            <Button
              onClick={startIngestion}
              disabled={loading || ingestionState?.isRunning}
              className="flex items-center gap-2"
            >
              {ingestionState?.isRunning ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              {ingestionState?.isRunning ? 'Ingestion en cours...' : 'Charger les Données DVF'}
            </Button>

            <Button
              onClick={fetchStats}
              variant="outline"
              disabled={loading}
              className="flex items-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Rafraîchir
            </Button>

            <Button
              onClick={clearData}
              variant="destructive"
              disabled={loading || ingestionState?.isRunning || !stats || stats.total === 0}
              className="flex items-center gap-2"
            >
              <Trash2 className="h-4 w-4" />
              Vider la Base
            </Button>
          </CardContent>
        </Card>

        {/* Logs récents */}
        {ingestionState?.logs && ingestionState.logs.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Logs récents</CardTitle>
              <CardDescription>Dernières activités d'ingestion</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {ingestionState.logs.slice().reverse().map((log, index) => (
                  <div
                    key={index}
                    className="flex items-start gap-2 p-2 rounded bg-gray-50 text-sm"
                  >
                    {log.type === 'success' && <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />}
                    {log.type === 'error' && <XCircle className="h-4 w-4 text-red-600 mt-0.5" />}
                    {log.type === 'info' && <AlertCircle className="h-4 w-4 text-blue-600 mt-0.5" />}
                    <div className="flex-1">
                      <div className="font-medium">{log.message}</div>
                      <div className="text-xs text-gray-500">
                        {new Date(log.timestamp).toLocaleString('fr-FR')}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Top départements */}
        {stats && stats.byDepartment && stats.byDepartment.length > 0 && (
          <Card className="mt-8">
            <CardHeader>
              <CardTitle>Top 10 Départements</CardTitle>
              <CardDescription>Départements avec le plus de transactions</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {stats.byDepartment.map((dept) => (
                  <div key={dept.code} className="flex items-center justify-between p-2 rounded bg-gray-50">
                    <span className="font-medium">Département {dept.code}</span>
                    <span className="text-gray-600">{dept.count.toLocaleString()} transactions</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
