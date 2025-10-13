'use client'

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Search, Download, Eye, MessageSquare, Edit, Phone, Mail, MapPin, Home, Calendar, Filter, X, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';

const EstimationMap = dynamic(() => import('@/components/EstimationMap'), { ssr: false });

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [leads, setLeads] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [token, setToken] = useState(null);
  const [selectedLead, setSelectedLead] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editedLead, setEditedLead] = useState(null);
  const [newComment, setNewComment] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [leadToDelete, setLeadToDelete] = useState(null);

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

  const updateLeadStatus = async (leadId, newStatus) => {
    try {
      const res = await fetch('/api/admin/leads/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ leadId, status: newStatus })
      });
      
      if (res.ok) {
        // Update local state immediately for better UX
        setLeads(prevLeads => 
          prevLeads.map(lead => 
            lead.id === leadId ? { ...lead, status: newStatus } : lead
          )
        );
        if (selectedLead && selectedLead.id === leadId) {
          setSelectedLead({ ...selectedLead, status: newStatus });
        }
      } else {
        console.error('Failed to update status:', await res.text());
        alert('Erreur lors de la mise à jour du statut');
      }
    } catch (error) {
      console.error('Error updating status:', error);
      alert('Erreur lors de la mise à jour du statut');
    }
  };

  const addComment = async (leadId, comment) => {
    if (!comment.trim()) return;
    
    try {
      await fetch('/api/admin/leads/comment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          leadId, 
          comment,
          author: username,
          timestamp: new Date().toISOString()
        })
      });
      setNewComment('');
      loadLeads(token);
    } catch (error) {
      console.error('Error adding comment:', error);
    }
  };

  const updateLeadField = async (leadId, field, value) => {
    try {
      const updates = { [field]: value };
      const res = await fetch('/api/admin/leads/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ leadId, updates })
      });
      
      if (res.ok) {
        // Update local state
        setLeads(prevLeads => 
          prevLeads.map(lead => 
            lead.id === leadId ? { ...lead, [field]: value } : lead
          )
        );
        if (selectedLead && selectedLead.id === leadId) {
          setSelectedLead({ ...selectedLead, [field]: value });
        }
        if (editedLead && editedLead.id === leadId) {
          setEditedLead({ ...editedLead, [field]: value });
        }
      }
    } catch (error) {
      console.error('Error updating field:', error);
    }
  };

  const deleteLead = async (leadId) => {
    setLeadToDelete(leadId);
    setShowDeleteConfirm(true);
  };
  
  const confirmDelete = async () => {
    if (!leadToDelete) return;
    
    try {
      const res = await fetch(`/api/admin/leads/delete?leadId=${leadToDelete}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (res.ok) {
        setLeads(prevLeads => prevLeads.filter(lead => lead.id !== leadToDelete));
        setShowDetailModal(false);
        setShowEditModal(false);
        setShowDeleteConfirm(false);
        setSelectedLead(null);
        setEditedLead(null);
        setLeadToDelete(null);
      } else {
        alert('Erreur lors de la suppression du lead');
      }
    } catch (error) {
      console.error('Error deleting lead:', error);
      alert('Erreur lors de la suppression du lead');
    }
  };

  const exportToCSV = () => {
    const headers = [
      'Date', 'Heure', 'Nom', 'Email', 'Téléphone', 'Adresse', 'Type', 'Surface (m²)',
      'Prix Estimé (€)', 'Prix Conseillé (€)', 'Confiance (%)', 'Statut', 'Commentaires'
    ];
    
    const rows = filteredLeads.map(lead => [
      new Date(lead.createdAt).toLocaleDateString('fr-FR'),
      new Date(lead.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      lead.name,
      lead.email,
      lead.phone || '',
      lead.property?.address || '',
      lead.property?.type || '',
      lead.property?.surface || '',
      lead.estimation?.finalPrice?.low || '',
      lead.estimation?.finalPrice?.mid || '',
      lead.estimation?.finalPrice?.confidence || '',
      lead.status || '',
      lead.comments?.length || 0
    ]);
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');
    
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `leads_alterego_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const filteredLeads = leads.filter(lead => {
    if (!searchQuery && filterStatus === 'all' && filterType === 'all') return true;
    
    let matches = true;
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      matches = matches && (
        lead.name?.toLowerCase().includes(query) ||
        lead.email?.toLowerCase().includes(query) ||
        lead.property?.address?.toLowerCase().includes(query)
      );
    }
    
    if (filterStatus !== 'all') {
      matches = matches && lead.status === filterStatus;
    }
    
    if (filterType !== 'all') {
      matches = matches && lead.property?.type === filterType;
    }
    
    return matches;
  });

  const getStatusColor = (status) => {
    switch(status) {
      case 'estimation_complete': return 'bg-green-100 text-green-800';
      case 'pending_estimation': return 'bg-yellow-100 text-yellow-800';
      case 'contacted': return 'bg-blue-100 text-blue-800';
      case 'qualified': return 'bg-purple-100 text-purple-800';
      case 'closed_won': return 'bg-green-600 text-white';
      case 'closed_lost': return 'bg-gray-400 text-white';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status) => {
    switch(status) {
      case 'estimation_complete': return 'Estimation complète';
      case 'pending_estimation': return 'En cours';
      case 'contacted': return 'Contacté';
      case 'qualified': return 'Qualifié';
      case 'closed_won': return 'Gagné';
      case 'closed_lost': return 'Perdu';
      default: return 'Nouveau';
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md p-8">
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <img 
                src="https://customer-assets.emergentagent.com/job_realprice-wizard/artifacts/h5ubvkxs_Valide%CC%81%20%2812%29.png" 
                alt="AlterEgo" 
                className="h-16 w-auto"
              />
            </div>
            <h1 className="text-2xl font-bold mb-2">Administration</h1>
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
      <header className="bg-white border-b sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <img 
                src="https://customer-assets.emergentagent.com/job_realprice-wizard/artifacts/h5ubvkxs_Valide%CC%81%20%2812%29.png" 
                alt="AlterEgo" 
                className="h-10 w-auto"
              />
              <Badge variant="outline" className="text-sm">{filteredLeads.length} lead{filteredLeads.length !== 1 ? 's' : ''}</Badge>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600">Connecté: <strong>{username}</strong></span>
              <Button onClick={handleLogout} variant="outline" size="sm">
                Déconnexion
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Filters & Actions */}
        <Card className="p-6 mb-6">
          <div className="flex flex-wrap gap-4 items-center">
            {/* Search */}
            <div className="flex-1 min-w-[300px] relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <Input
                placeholder="Rechercher par nom, email ou adresse..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            
            {/* Filter Status */}
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les statuts</SelectItem>
                <SelectItem value="estimation_complete">Estimation complète</SelectItem>
                <SelectItem value="contacted">Contacté</SelectItem>
                <SelectItem value="qualified">Qualifié</SelectItem>
                <SelectItem value="closed_won">Gagné</SelectItem>
                <SelectItem value="closed_lost">Perdu</SelectItem>
              </SelectContent>
            </Select>
            
            {/* Filter Type */}
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous types</SelectItem>
                <SelectItem value="appartement">Appartement</SelectItem>
                <SelectItem value="maison">Maison</SelectItem>
              </SelectContent>
            </Select>
            
            {/* Reset Filters */}
            {(filterStatus !== 'all' || filterType !== 'all' || searchQuery) && (
              <Button variant="outline" size="sm" onClick={() => {
                setFilterStatus('all');
                setFilterType('all');
                setSearchQuery('');
              }}>
                <X className="w-4 h-4 mr-2" /> Réinitialiser
              </Button>
            )}
            
            {/* Export */}
            <Button onClick={exportToCSV} className="bg-black hover:bg-gray-800 text-white">
              <Download className="w-4 h-4 mr-2" />
              Exporter CSV
            </Button>
          </div>
        </Card>

        {/* Leads Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredLeads.map((lead) => (
            <Card key={lead.id} className="p-6 hover:shadow-lg transition-shadow">
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-bold mb-1">{lead.name}</h3>
                  <p className="text-sm text-gray-500">
                    {new Date(lead.createdAt).toLocaleDateString('fr-FR', { 
                      day: 'numeric', 
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>
                <Badge className={getStatusColor(lead.status)}>
                  {getStatusLabel(lead.status)}
                </Badge>
              </div>

              {/* Contact Info */}
              <div className="space-y-2 mb-4">
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="w-4 h-4 text-gray-400" />
                  <a href={`mailto:${lead.email}`} className="text-blue-600 hover:underline truncate">
                    {lead.email}
                  </a>
                </div>
                {lead.phone && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="w-4 h-4 text-gray-400" />
                    <a href={`tel:${lead.phone}`} className="text-blue-600 hover:underline">
                      {lead.phone}
                    </a>
                  </div>
                )}
                {lead.property?.address && (
                  <div className="flex items-start gap-2 text-sm">
                    <MapPin className="w-4 h-4 text-gray-400 mt-0.5" />
                    <span className="text-gray-600 line-clamp-2">{lead.property.address}</span>
                  </div>
                )}
              </div>

              {/* Property Info */}
              {lead.property && (
                <div className="bg-gray-50 rounded-lg p-3 mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Home className="w-4 h-4 text-gray-600" />
                      <span className="text-sm font-medium capitalize">{lead.property.type}</span>
                    </div>
                    <span className="text-sm font-bold">{lead.property.surface} m²</span>
                  </div>
                  {lead.estimation?.finalPrice && (
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Prix estimé:</span>
                        <span className="font-bold">{lead.estimation.finalPrice.low.toLocaleString()} €</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Confiance:</span>
                        <Badge className={lead.estimation.finalPrice.confidence >= 75 ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}>
                          {lead.estimation.finalPrice.confidence}%
                        </Badge>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Comments Badge */}
              {lead.comments && lead.comments.length > 0 && (
                <div className="mb-4">
                  <Badge variant="outline" className="text-xs">
                    <MessageSquare className="w-3 h-3 mr-1" />
                    {lead.comments.length} commentaire{lead.comments.length > 1 ? 's' : ''}
                  </Badge>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2">
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="flex-1"
                  onClick={() => {
                    setSelectedLead(lead);
                    setShowDetailModal(true);
                  }}
                >
                  <Eye className="w-4 h-4 mr-2" />
                  Détails
                </Button>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => {
                    setEditedLead(lead);
                    setShowEditModal(true);
                  }}
                >
                  <Edit className="w-4 h-4" />
                </Button>
              </div>
            </Card>
          ))}
        </div>

        {filteredLeads.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">Aucun lead trouvé</p>
          </div>
        )}
      </main>

      {/* Detail Modal */}
      <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          {selectedLead && (
            <>
              <DialogHeader>
                <DialogTitle className="text-2xl flex items-center justify-between">
                  <span>{selectedLead.name}</span>
                  <div className="flex items-center gap-2">
                    <Badge className={getStatusColor(selectedLead.status)}>
                      {getStatusLabel(selectedLead.status)}
                    </Badge>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => deleteLead(selectedLead.id)}
                    >
                      <Trash2 className="w-4 h-4 mr-1" />
                      Supprimer
                    </Button>
                  </div>
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-6">
                {/* Contact & Property Info */}
                <div className="grid md:grid-cols-2 gap-6">
                  <Card className="p-4">
                    <h3 className="font-semibold mb-3">Informations contact</h3>
                    <div className="space-y-2 text-sm">
                      <div><strong>Email:</strong> <a href={`mailto:${selectedLead.email}`} className="text-blue-600">{selectedLead.email}</a></div>
                      <div><strong>Téléphone:</strong> <a href={`tel:${selectedLead.phone}`} className="text-blue-600">{selectedLead.phone}</a></div>
                      <div><strong>Date:</strong> {new Date(selectedLead.createdAt).toLocaleString('fr-FR')}</div>
                    </div>
                  </Card>

                  <Card className="p-4">
                    <h3 className="font-semibold mb-3">Bien immobilier</h3>
                    <div className="space-y-2 text-sm">
                      <div><strong>Type:</strong> <span className="capitalize">{selectedLead.property?.type}</span></div>
                      <div><strong>Surface:</strong> {selectedLead.property?.surface} m²</div>
                      <div><strong>Pièces:</strong> {selectedLead.property?.rooms}</div>
                      <div><strong>Adresse:</strong> {selectedLead.property?.address}</div>
                    </div>
                  </Card>
                </div>

                {/* Estimation */}
                {selectedLead.estimation?.finalPrice && (
                  <Card className="p-6 bg-gradient-to-br from-gray-900 to-gray-800 text-white">
                    <h3 className="font-semibold mb-4 text-xl">Estimation</h3>
                    <div className="grid md:grid-cols-3 gap-4">
                      <div>
                        <div className="text-sm opacity-80 mb-1">Prix Estimé</div>
                        <div className="text-2xl font-bold">{selectedLead.estimation.finalPrice.low.toLocaleString()} €</div>
                      </div>
                      <div>
                        <div className="text-sm opacity-80 mb-1">Prix Conseillé</div>
                        <div className="text-2xl font-bold">{selectedLead.estimation.finalPrice.mid.toLocaleString()} €</div>
                      </div>
                      <div>
                        <div className="text-sm opacity-80 mb-1">Confiance</div>
                        <div className="text-2xl font-bold">{selectedLead.estimation.finalPrice.confidence}%</div>
                      </div>
                    </div>
                  </Card>
                )}

                {/* Change Status */}
                <Card className="p-4">
                  <h3 className="font-semibold mb-3">Changer le statut</h3>
                  <Select 
                    value={selectedLead.status || 'estimation_complete'} 
                    onValueChange={(value) => updateLeadStatus(selectedLead.id, value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="estimation_complete">Estimation complète</SelectItem>
                      <SelectItem value="contacted">Contacté</SelectItem>
                      <SelectItem value="qualified">Qualifié</SelectItem>
                      <SelectItem value="closed_won">Gagné</SelectItem>
                      <SelectItem value="closed_lost">Perdu</SelectItem>
                    </SelectContent>
                  </Select>
                </Card>

                {/* Comments */}
                <Card className="p-4">
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <MessageSquare className="w-5 h-5" />
                    Commentaires & Notes
                  </h3>
                  
                  {/* Existing Comments */}
                  {selectedLead.comments && selectedLead.comments.length > 0 && (
                    <div className="space-y-3 mb-4">
                      {selectedLead.comments.map((comment, idx) => (
                        <div key={idx} className="bg-gray-50 p-3 rounded-lg">
                          <div className="flex items-start justify-between mb-1">
                            <span className="font-medium text-sm">{comment.author}</span>
                            <span className="text-xs text-gray-500">
                              {new Date(comment.timestamp).toLocaleString('fr-FR')}
                            </span>
                          </div>
                          <p className="text-sm text-gray-700">{comment.comment}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {/* Add Comment */}
                  <div className="space-y-2">
                    <Textarea
                      placeholder="Ajouter un commentaire ou une note..."
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      rows={3}
                    />
                    <Button 
                      onClick={() => {
                        addComment(selectedLead.id, newComment);
                        setSelectedLead({
                          ...selectedLead,
                          comments: [...(selectedLead.comments || []), {
                            author: username,
                            comment: newComment,
                            timestamp: new Date().toISOString()
                          }]
                        });
                        setNewComment('');
                      }}
                      disabled={!newComment.trim()}
                      className="w-full"
                    >
                      Ajouter le commentaire
                    </Button>
                  </div>
                </Card>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Modal */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="max-w-2xl">
          {editedLead && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center justify-between">
                  <span>Modifier le lead</span>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => deleteLead(editedLead.id)}
                  >
                    <Trash2 className="w-4 h-4 mr-1" />
                    Supprimer
                  </Button>
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                <div className="text-sm text-gray-500 bg-blue-50 p-3 rounded-lg">
                  💡 Les modifications sont enregistrées automatiquement
                </div>
                
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Nom</label>
                    <Input
                      value={editedLead.name}
                      onChange={(e) => {
                        const newValue = e.target.value;
                        setEditedLead({ ...editedLead, name: newValue });
                      }}
                      onBlur={(e) => updateLeadField(editedLead.id, 'name', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Email</label>
                    <Input
                      type="email"
                      value={editedLead.email}
                      onChange={(e) => {
                        const newValue = e.target.value;
                        setEditedLead({ ...editedLead, email: newValue });
                      }}
                      onBlur={(e) => updateLeadField(editedLead.id, 'email', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Téléphone</label>
                    <Input
                      value={editedLead.phone}
                      onChange={(e) => {
                        const newValue = e.target.value;
                        setEditedLead({ ...editedLead, phone: newValue });
                      }}
                      onBlur={(e) => updateLeadField(editedLead.id, 'phone', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Statut</label>
                    <Select 
                      value={editedLead.status || 'estimation_complete'} 
                      onValueChange={(value) => {
                        setEditedLead({ ...editedLead, status: value });
                        updateLeadField(editedLead.id, 'status', value);
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="estimation_complete">Estimation complète</SelectItem>
                        <SelectItem value="contacted">Contacté</SelectItem>
                        <SelectItem value="qualified">Qualifié</SelectItem>
                        <SelectItem value="closed_won">Gagné</SelectItem>
                        <SelectItem value="closed_lost">Perdu</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setShowEditModal(false)}>
                  Fermer
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}