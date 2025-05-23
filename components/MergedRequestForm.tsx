'use client'
import React from 'react';

import { useState, useEffect } from 'react'
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { Label } from "./ui/label"
import { Textarea } from "./ui/textarea"
import { useToast } from "../hooks/use-toast"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select"
import { ClientWrapper } from "./ui/client-wrapper"
import { collection, addDoc, getDocs, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { fetchStatuts, fetchAllUsers } from '../utils/dataFetcher';
import { stat } from 'fs';

//const userData = JSON.parse(localStorage.getItem('userData') || 'null');
//console.log('(MergedRequestForm) ID utilisateur :', userData);

interface MergedRequestFormProps {
  onClose: () => void;
  type?: 'evolution' | 'new' | 'edit';
  typeGain?: string;
  user?: { 
    userId: string;
    userName: string; 
    userEmail: string;
    userSuperieur: string;
    userValidateur: string;
    password: string;
    userAgenceIds: string[]
  }
  formData?: {
    Intitulé: string;
    Description: string;
    Robot: string;
    Nb_operations_mensuelles: string; 
    Temps_consommé: string;
    Statut: string;
    Date: string;
    type: 'new' | 'evolution' | 'edit';
    type_gain?: string;
    Validateur: string;
  };
}



export default function MergedRequestForm({
  onClose,
  type,
    typeGain,
    user,
    formData = {
    Intitulé: '',
    Description: '',
    Robot: '',
    Temps_consommé: '',
    Nb_operations_mensuelles: '',
    Statut: '1', // Par défaut "En attente de validation"
    Validateur: '',
    Date: new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }),
    type: 'new',
    type_gain: '',
  }
}: MergedRequestFormProps) {
    //console.log('(MergedRequestForm) formData :', formData, 'type:', type, 'typeGain:', typeGain, 'user:', user);

  const { toast } = useToast();
  const [formDataState, setFormData] = useState({
    ...formData,
    Nb_operations_mensuelles: formData.Nb_operations_mensuelles || '',
    Temps_consommé: formData.Temps_consommé || '',
    Temps_total: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [statuts, setStatuts] = useState<{numero: string, label: string}[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [users, setUsers] = useState<{ userId: string; userName: string }[]>([]);
  const validateurValue = user?.userValidateur?.toLowerCase() === 'oui' ? user?.userName : user?.userSuperieur || '';

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    let formattedValue = value;
    
    if (name === 'Temps_consommé' || name === 'Nb_operations_mensuelles') {
      formattedValue = value.replace(',', '.');
    }
    
    setFormData(prev => {
      const newFormData = { ...prev, [name]: formattedValue };
      if (name === 'Nb_operations_mensuelles' || name === 'Temps_consommé') {
        const nbOperations = name === 'Nb_operations_mensuelles' ? formattedValue : newFormData.Nb_operations_mensuelles;
        const tempsConsomme = name === 'Temps_consommé' ? formattedValue : newFormData.Temps_consommé;
        const tempsTotal = parseFloat(nbOperations) * parseFloat(tempsConsomme);
        newFormData.Temps_total = isNaN(tempsTotal) ? '' : tempsTotal % 1 === 0 ? tempsTotal.toFixed(0) : tempsTotal.toFixed(2);
      }
      return newFormData;
    });
  };

  useEffect(() => {
    const loadStatuts = async () => {
      try {
        const statutsData = await fetchStatuts();
        if (!Array.isArray(statutsData) || statutsData.length === 0) {
          console.log('No statuts data received or invalid format');
          return;
        }
        setStatuts(statutsData);
      } catch (error) {
        console.log('Erreur lors du chargement des statuts:', error);
      }
    };
    loadStatuts();

    const loadUsers = async () => {
      try {
        const usersData = await fetchAllUsers();
        setUsers(usersData);
      } catch (error) {
        console.log('Erreur lors du chargement des utilisateurs:', error);
      }
    };
    loadUsers();
  }, []);


  const handleStatusChange = (value: string) => {
    setFormData(prev => ({ ...prev, Statut: value }))
  }

  /**
   * Gère l'envoi du formulaire de demande.
   * @param {React.FormEvent<HTMLFormElement>} e - L'événement de soumission du formulaire
   * 
   * Valide les champs obligatoires puis envoie les données à Firebase.
   * Si l'envoi est un succès, envoie un e-mail via le serveur Next.js.
   * Si l'envoi est un échec, affiche un toast d'erreur.
   * Puis ferme le formulaire.
   */
  const handleSubmit = async (e?: React.FormEvent<HTMLFormElement>) => {
    if (e) {
      e.preventDefault();
    }
    setIsLoading(true);

    // Vérifier si des modifications ont été apportées
    const hasChanges = Object.keys(formDataState).some(key => {
      const originalValue = formData[key as keyof typeof formData];
      const currentValue = formDataState[key as keyof typeof formDataState];
      return originalValue !== currentValue;
    });

    if (!hasChanges) {
      console.log('Aucune modification apportée !');
      onClose();
      return;
    }

    await submitForm();
  };

  const handleSubmitButton = async () => {
    await submitForm();
  };

  const submitForm = async () => {
    // Validation des champs obligatoires
    if (!formDataState.Intitulé.trim()) {
      toast({
        title: "Erreur",
        description: "Le champ Intitulé est obligatoire",
        variant: "destructive",
        id: ''
      });
      return;
    }
    if (!formDataState.Description.trim()) {
      toast({
        title: "Erreur",
        description: "Le champ Description est obligatoire",
        variant: "destructive",
        id: ''
      });
      return;
    }

    try {
      // Envoi à Firebase
      const evolutionCollection = collection(db, 'evolutions');
      
      // S'assurer que la date est définie
      const dataToSend = {
        ...formDataState,
        Date: new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
      };
      await addDoc(evolutionCollection, dataToSend);

      // Envoi par email
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: "Utilisateur BBL", 
          email: "contact@bbl-groupe.fr",
          subject: (formDataState.type === 'new' ? "Nouvelle demande" : "Demande d'évolution"),
          message: `
          ${formDataState.Robot === 'TOUT' ? '' : " <br>Robot :" + formDataState.Robot}
          Intitulé: ${formDataState.Intitulé}
          Description: ${formDataState.Description}
          Temps consommé: ${formDataState.Temps_consommé}
          Nb. operations mensuelles: ${formDataState.Nb_operations_mensuelles}
          ${formDataState.type === 'new' ? "Date de création de la demande" : "Date de mise à jour de la demande"} : ${new Date().toLocaleString()}
          `.trim()
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }
      setIsLoading(false);
      setIsSuccess(true);

      toast({
        title: 'Succès !',
        description: 'Votre demande a été envoyée avec succès.',
        id: ''
      });

      onClose();
      window.location.reload();

    } catch (error: unknown) {
      setIsLoading(false);
      let errorData: { error: string };
      if (error instanceof Response) {
        errorData = await error.json();
      } else if (error instanceof Error) {
        errorData = { error: error.message };
      } else {
        errorData = { error: 'Échec de l\'envoi de la demande' };
      }
      toast({
        title: 'Erreur d\'envoi de mail',
        description: errorData.error || 'Échec de l\'envoi de la demande',
        variant: 'destructive',
        id: ''
      });
    }
  }

  return (
    <ClientWrapper>
      {formDataState.type === 'new' ? (
        //  ------------------------------ Formulaire de nouvelle demande ------------------
        <Dialog open={true} onOpenChange={onClose}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nouvelle demande</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              {/* {formDataState.Robot === 'TOUT' && ( <div>Erreur ! robot: {formDataState.Robot}</div> )} */}
              <div>
                <Label htmlFor="intitulé">Intitulé</Label>
                <Input
                  id="intitulé"
                  name="Intitulé"
                  value={formDataState.Intitulé}
                  onChange={handleChange}
                />
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  name="Description"
                  value={formDataState.Description}
                  onChange={handleChange}
                />
              </div>
              <div>
                <Label htmlFor="Nombre d'opérations mensuelles">Nombre d'opérations mensuelles</Label>
                <Input
                  id="Nombre d'opérations mensuelles"
                  name="Nb_operations_mensuelles"
                  value={formDataState.Nb_operations_mensuelles}
                  onChange={handleChange}
                />
              </div>
              <div>
                <Label htmlFor="Temps consommé">Temps consommé (minutes par opération)</Label>
                <Input
                  id="Temps consommé"
                  name="Temps_consommé"
                  value={formDataState.Temps_consommé}
                  onChange={handleChange}
                />
              </div>
              <div>
                <Label htmlFor="Temps total">Temps total (minutes)</Label>
                <Input
                  id="Temps total"
                  name="Temps_total"
                  value={formDataState.Temps_total}
                  readOnly
                  className="bg-gray-100 cursor-not-allowed"
                />
              </div>

              <div>
                <Label htmlFor="Validateur">Validateur</Label>
                <Input
                  id="Validateur"
                  name="Validateur"
                  value={(() => { console.log('user:', user); return user?.userValidateur?.toLowerCase() === 'oui' ? user?.userName : user?.userSuperieur || ''; })()}
                  readOnly
                  className="bg-gray-100 cursor-not-allowed"
                />
              </div>
              
              <div className="flex justify-end space-x-2 mt-4">
                <Button type="button" className="bg-red-500 hover:bg-red-700 text-white" onClick={onClose}>
                  Annuler
                </Button>
                <Button type="submit" className="bg-green-500 hover:bg-green-700 text-white" disabled={isLoading}>
                  {isLoading ? (
                    <div className="flex items-center">
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Envoi en cours...
                    </div>
                  ) : 'Envoyer'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      ) : formDataState.type === 'edit' ? (
        // -------------- Formulaire de détail --------------------
        <Dialog open={true} onOpenChange={onClose}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Détails de {formDataState.Robot}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
            {/* {formDataState && <div>typeGain: {formDataState.type_gain}</div>} */}
              <div>
                <Label htmlFor="intitulé">Intitulé</Label>
                <Input
                  id="intitulé"
                  name="Intitulé"
                  value={formDataState.Intitulé}
                  onChange={handleChange}
                  disabled={!isEditing}
                />
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  name="Description"
                  value={formDataState.Description}
                  onChange={handleChange}
                  disabled={!isEditing}
                />
              </div>
              {user && user.userId === '0' && (
              <div>
                <Label htmlFor="statut">Statut</Label>
                {isEditing ? (
                  <Select
                    value={formDataState.Statut}
                    onValueChange={handleStatusChange}
                  >
                    <SelectTrigger className="bg-white border border-gray-300 rounded py-2 px-4">
                      <SelectValue placeholder="Sélectionnez un statut" />
                    </SelectTrigger>
                    <SelectContent className="bg-white border border-gray-300 rounded py-2 px-4">
                      {statuts && statuts.length > 0 ? (
                        statuts.map((statut, index) => (
                          <SelectItem
                            key={`${statut.numero}-${index}`}
                            value={statut.numero}
                          >
                            {statut.label}
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="loading" disabled>
                          Chargement des statuts...
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    id="statut"
                    name="Statut"
                    value={statuts.find(s => s.numero === formDataState.Statut)?.label || formDataState.Statut}
                    disabled
                  />
                )}
              </div>
              )}
            
              {formDataState.type_gain  === 'temps' ? (
              <div>
                <Label htmlFor="Temps consommé">Temps consommé (minutes par opération)</Label>
                <Input
                  id="Temps consommé"
                  name="Temps_consommé"
                  value={formDataState.Temps_consommé}
                  onChange={handleChange}
                  disabled={!isEditing}
                />
              </div>
              ) : (
              <div>
                <Label htmlFor="Nombre d'opérations mensuelles">Nombre d'opérations mensuelles</Label>
                <Input
                  id="Nombre d'opérations mensuelles"
                  name="Nb_operations_mensuelles"
                  value={formDataState.Nb_operations_mensuelles}
                  onChange={handleChange}
                  disabled={!isEditing}
                />
              </div>
              )}  
          
              <div>
                <Label htmlFor="Temps total">Temps total (minutes)</Label>
                <Input
                  id="Temps total"
                  name="Temps_total"
                  value={formDataState.Temps_total}
                  readOnly
                  className="bg-gray-100 cursor-not-allowed"
                />
              </div>
              <div>
                <Label htmlFor="Validateur">Validateur</Label>
                <Input
                  id="Validateur"
                  name="Validateur"
                  value={formDataState.Validateur}
                  readOnly
                  className="bg-gray-100 cursor-not-allowed"
                />
              </div>

              {/* // ----------------- Boutons de validation ------------------- */}
              {user && user.userId === '0' ? (
                <div className="flex justify-end space-x-2 mt-4">
                  {isEditing ? (
                    <>
                      <Button type="button"
                        className="bg-red-500 hover:bg-red-700 text-white" onClick={() => setIsEditing(false)}  >Annuler</Button>
                      <Button type="submit" className="bg-green-500 hover:bg-green-700 text-white" disabled={isLoading}>
                        {isLoading ? (
                          <div className="flex items-center">
                            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Envoi en cours...
                          </div>
                        ) : 'Envoyer'}
                      </Button>
                    </>
                  ) : (
                    <>
                    <Button type="button"
                        className="bg-red-500 hover:bg-red-700 text-white" onClick={onClose} >Annuler</Button>
                    <Button
                      type="button" 
                      className="bg-green-500 hover:bg-green-700 text-white"
                      onClick={(e) => {
                        e.preventDefault();
                        setIsEditing(true);
                        setIsLoading(false);
                      }} >Edition</Button>
                    </>
                  )}
                </div>
              ) : (
                <>
                <Button type="button"
                  className="bg-red-500 hover:bg-red-700 text-white space-x-2 mt-4" onClick={onClose} >Fermer</Button>
                {/* <Button type="button"
                  className="bg-red-500 hover:bg-red-700 text-white" onClick={() => setIsEditing(false)} >TODO</Button> */}
                </>
              )}

            </form>
          </DialogContent>
        </Dialog>
      ) : (
        // /////////////// Formulaire de demande d'évolution ///////////////// //
        <Dialog open={true} onOpenChange={onClose}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Demande d'évolution du robot {formDataState.Robot}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
            {/* {formDataState && <div>typeGain: {formDataState.type_gain}</div>} */}
              <div>
                <Label htmlFor="intitulé">Intitulé</Label>
                <Input
                  id="intitulé"
                  name="Intitulé"
                  value={formDataState.Intitulé}
                  onChange={handleChange}
                />
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  name="Description"
                  value={formDataState.Description}
                  onChange={handleChange}
                />
              </div>
              {formDataState.type_gain === 'temps' ? (
              <div>
              <Label htmlFor="Temps consommé">Temps consommé (minutes par opération)</Label>
              <Input
                id="Temps consommé"
                name="Temps_consommé"
                value={formDataState.Temps_consommé}
                onChange={handleChange}
              />
            </div>
              ) : (
              <div>
                <Label htmlFor="Nombre d'opérations mensuelles">Nombre d'opérations mensuelles</Label>
                <Input
                  id="Nombre d'opérations mensuelles"
                  name="Nb_operations_mensuelles"
                  value={formDataState.Nb_operations_mensuelles}
                  onChange={handleChange}
                />
              </div>
              )}  

              <div>
                <Label htmlFor="Temps total">Temps total (minutes)</Label>
                <Input
                  id="Temps total"
                  name="Temps_total"
                  value={formDataState.Temps_total}
                  readOnly
                  className="bg-gray-100 cursor-not-allowed"
                />
              </div>

              <div>
                <Label htmlFor="Validateur">Validateur</Label>
                <Input
                  id="Validateur"
                  name="Validateur"
                  value={formDataState.Validateur}
                  onChange={handleChange}
                  className="bg-white"
                />
              </div>

              <div className="flex justify-end space-x-2 mt-4">
                <Button type="button" className="bg-red-500 hover:bg-red-700 text-white" onClick={onClose}>Annuler</Button>
                <Button type="submit" className="bg-green-500 hover:bg-green-700 text-white" disabled={isLoading}>
                  {isLoading ? (
                    <div className="flex items-center">
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Envoi en cours...
                    </div>
                  ) : 'Envoyer'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </ClientWrapper>
  )
}

