'use client'

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Download, Search } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [leads, setLeads] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [token, setToken] = useState(null);

  useEffect(() => {
    const savedToken = localStorage.getItem('adminToken');
    if (savedToken) {
      setToken(savedToken);
      setIsAuthenticated(true);
      loadLeads(savedToken);
    }
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      
      if (res.ok) {
        const data = await res.json();
        localStorage.setItem('adminToken', data.token);
        setToken(data.token);
        setIsAuthenticated(true);
        loadLeads(data.token);
      } else {
        alert('Identifiants invalides');
      }
    } catch (error) {
      console.error('Login error:', error);
      alert('Erreur de connexion');
    } finally {
      setLoading(false);
    }
  };

  const loadLeads = async (authToken) => {
    try {
      const res = await fetch('/api/leads', {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      
      if (res.ok) {
        const data = await res.json();
        setLeads(data.leads || []);
      }
    } catch (error) {
      console.error('Error loading leads:', error);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    setIsAuthenticated(false);
    setToken(null);
    setLeads([]);
  };

  const exportToCSV = () => {
    const headers = ['Date', 'Nom', 'Email', 'Téléphone', 'Adresse', 'Type', 'Surface', 'Estimation DVF', 'Estimation Marché'];
    const rows = filteredLeads.map(lead => [
      new Date(lead.createdAt).toLocaleDateString('fr-FR'),
      lead.name,
      lead.email,
      lead.phone || '',
      lead.property?.address || '',
      lead.property?.type || '',
      lead.property?.surface || '',
      lead.estimation?.estimatedValue?.toLocaleString() || '',
      lead.estimation?.market?.stats?.medianPricePerM2 ? 
        Math.round(lead.estimation.market.stats.medianPricePerM2 * parseFloat(lead.property?.surface || 0)).toLocaleString() : ''
    ]);
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `leads_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const filteredLeads = leads.filter(lead => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      lead.name?.toLowerCase().includes(query) ||
      lead.email?.toLowerCase().includes(query) ||
      lead.property?.address?.toLowerCase().includes(query)
    );
  });

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold mb-2">AlterEgo Admin</h1>
            <p className="text-gray-600">Connectez-vous pour accéder au panneau d'administration</p>
          </div>
          
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Nom d'utilisateur</label>
              <Input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Entrez votre nom d'utilisateur"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Mot de passe</label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Entrez votre mot de passe"
                required
              />
            </div>
            
            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-black hover:bg-gray-800 text-white"
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Connexion...</>
              ) : (
                'Se connecter'
              )}
            </Button>
          </form>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <header className="bg-white border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">AlterEgo Admin</h1>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600">Connecté en tant que <strong>{username}</strong></span>
              <Button onClick={handleLogout} variant="outline" size="sm">
                Déconnexion
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold mb-4">Gestion des Leads</h2>
          
          <div className="flex gap-4 mb-6">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <Input
                placeholder="Rechercher par nom, email ou adresse..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button onClick={exportToCSV} className="bg-black hover:bg-gray-800 text-white">
              <Download className="w-4 h-4 mr-2" />
              Exporter CSV
            </Button>
          </div>

          <Card>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Nom</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Téléphone</TableHead>
                    <TableHead>Adresse</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Surface</TableHead>
                    <TableHead className="text-right">Est. DVF</TableHead>
                    <TableHead className="text-right">Est. Marché</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLeads.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center text-gray-500 py-8">
                        Aucun lead trouvé
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredLeads.map((lead) => (
                      <TableRow key={lead.id}>
                        <TableCell className="whitespace-nowrap">
                          {new Date(lead.createdAt).toLocaleDateString('fr-FR')}
                        </TableCell>
                        <TableCell className="font-medium">{lead.name}</TableCell>
                        <TableCell>{lead.email}</TableCell>
                        <TableCell>{lead.phone || '-'}</TableCell>
                        <TableCell className="max-w-xs truncate" title={lead.property?.address}>
                          {lead.property?.address || '-'}
                        </TableCell>
                        <TableCell className="capitalize">{lead.property?.type || '-'}</TableCell>
                        <TableCell>{lead.property?.surface ? `${lead.property.surface} m²` : '-'}</TableCell>
                        <TableCell className="text-right font-semibold">
                          {lead.estimation?.estimatedValue
                            ? `${lead.estimation.estimatedValue.toLocaleString()} €`
                            : '-'}
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {lead.estimation?.market?.stats?.medianPricePerM2 && lead.property?.surface
                            ? `${Math.round(lead.estimation.market.stats.medianPricePerM2 * parseFloat(lead.property.surface)).toLocaleString()} €`
                            : '-'}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
          
          <div className="mt-4 text-sm text-gray-600">
            Total: <strong>{filteredLeads.length}</strong> lead{filteredLeads.length !== 1 ? 's' : ''}
          </div>
        </div>
      </main>
    </div>
  );
}