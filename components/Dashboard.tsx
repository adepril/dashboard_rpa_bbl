'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation';
import ProgramSelector from './ProgramSelector'
import Chart from './Chart'
import ProgramTable from './ProgramTable'
import Chart4All from './Chart4All'
import Chart4Service from './Chart4Service'
import MergedRequestForm from './MergedRequestForm'
import AgencySelector from './AgencySelector'
import ServiceSelector from './ServiceSelector'
import Image from 'next/image';
import { Button } from './ui/button';
import {
  fetchDataReportingByRobot,
  fetchAllEvolutions,
  fetchEvolutionsByProgram,
  formatNumber
} from '../utils/dataFetcher'
import {
  initializeData,
  getCachedAgencies,
  getRobotsByAgency,
  getRobotsByAgencyAndService,
  Agency,
  Program,
  isDataInitialized,
  resetCache
} from '../utils/dataStore'

interface DataEntry {
  AGENCE: string;
  'NOM PROGRAMME': string;
  'NB UNITES DEPUIS DEBUT DU MOIS': string;
  'NB UNITES MOIS N-1': string;
  'NB UNITES MOIS N-2': string;
  'NB UNITES MOIS N-3': string;
  [key: string]: any;
}

interface MergedRequestFormProps {
  onClose: () => void;
  type?: 'evolution' | 'new' | 'edit';
  formData?: {
    Intitulé: string;
    Description: string;
    Programme: string;
    Nb_operations_mensuelles: string;
    Temps_consommé: string;
    Statut: string;
    Date: string;
    type: 'new' | 'evolution' | 'edit';
  };
}

export default function Dashboard() {
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const userData = JSON.parse(localStorage.getItem('userData') || 'null');
  const username = userData?.userId || '';
  const [selectedAgency, setSelectedAgency] = useState<Agency | null>(null);
  const [selectedService, setSelectedService] = useState<string>('');
  const [programs, setPrograms] = useState<Program[]>([]);
  const [selectedRobot, setSelectedRobot] = useState<Program | null>(null);
  const [selectedRobotData, setSelectedRobotData] = useState<Program | null>(null);
  const [historiqueData, setHistoriqueData] = useState<any[]>([]);
  const [robotData, setRobotData] = useState<any>(null);
  const [robotData1, setRobotData1] = useState<any>(null);
  const [robotData2, setRobotData2] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [OpenFormNewOrder, setIsFormOpen] = useState(false);
  const [useChart4All, setUseChart4All] = useState(true);

  const router = useRouter();

  useEffect(() => {
    if (!userData) {
      router.replace('/');
    }
  }, [userData, router]);

  // Fetch user data and agencies
  const initialized = useRef(false);

  useEffect(() => {
    if (!initialized.current && username) {
      initialized.current = true;

      const loadUserData = async () => {
        try {
          setIsLoading(true);
          if (!username) {
            setError('Utilisateur non trouvé');
            setIsLoading(false);
            return;
          }
          if (!userData) {
            setError('Utilisateur non trouvé');
            return;
          }

          // Initialiser les données en cache
          await initializeData(username);
          console.log('(dataStore - initializeData) Données utilisateur:', userData);

          // Récupérer les agences depuis le cache
          const userAgencies = getCachedAgencies();
          console.log('(dataStore - getCachedAgencies) userAgencies :', userAgencies);
          setAgencies(userAgencies);

          if (userAgencies.length > 0) {
            setSelectedAgency(userAgencies[0]);
          }

          setIsLoading(false);
          console.log('Données chargées - isLoading:', isLoading);
        } catch (error) {
          console.log('Erreur lors du chargement des données:', error);
          setError('Erreur lors du chargement des données');
          setIsLoading(false);
        }
      };

      loadUserData();
    }

    // Nettoyer le cache lors du démontage du composant
    return () => {
      resetCache();
    };
  }, [username]);

  // Mettre à jour les programmes quand l'agence ou le service change
  useEffect(() => {
    const loadPrograms = async () => {
      console.log('(Dashboard) l\'agence ou le service change -> Chargement des programmes...');
      if (selectedAgency && isDataInitialized()) {
        const filteredRobots = getRobotsByAgencyAndService(selectedAgency.idAgence, selectedService);
        setPrograms(filteredRobots);

        if (filteredRobots.length > 0) {
          // Sélectionner automatiquement le premier robot (ou "TOUT" si service non sélectionné)
          const firstRobot = selectedService ? filteredRobots[0] : filteredRobots.find(r => r.nom_robot === "TOUT") || filteredRobots[0];
          setSelectedRobot(firstRobot);
          setSelectedRobotData(firstRobot);

          // Réinitialiser les données du graphique
          setRobotData(null);
          setRobotData1(null);
          setRobotData2(null);
          setHistoriqueData([]);

          // Forcer un re-render complet
          setUseChart4All(prev => !prev);
        } else {
          setSelectedRobot(null);
          setSelectedRobotData(null);
        }
      }
    };

    loadPrograms();
  }, [selectedAgency, selectedService]);


  useEffect(() => {
    /**
     * Loads data for the selected program (robot). If the selected program is "TOUT",
     * loads data for all robots of the selected agency and merges their values (day by day) into a single
     * DataEntry object. Otherwise, loads data for the single selected program.
     * @returns {Promise<void>}
     */
    const loadProgramData = async () => {
      if (selectedRobotData) {
        // console.log('@@ 1 (combo robot changed:loadProgramData) selectedAgency :', selectedAgency);
        // console.log('@@ 1 (combo robot changed:loadProgramData) selectedRobotData :', selectedRobotData);

        // Si "TOUT" est sélectionné, charger les données de tous les robots
        if (selectedRobotData.nom_robot === "TOUT") {
          const allRobotsEvolution = [];
          const allMergedDataType1 = [];
          const allMergedDataType2 = [];

          let oneRobotEvolution: any[] = [];
          // Tableaux de 31 jours initialisés à 0 pour chaque type de robot
          const arrJoursDuMois: string[] = new Array(31).fill("0");
          const arrJoursDuMois_Type1: string[] = [...arrJoursDuMois];
          const arrJoursDuMois_Type2: string[] = [...arrJoursDuMois];
          let rawData: DataEntry[] = [];

          // Variables pour stocker les totaux des unités
          let totalUnitesMoisCourant_Type1 = 0;
          let totalUnitesMoisN1_Type1 = 0;
          let totalUnitesMoisN2_Type1 = 0;
          let totalUnitesMoisN3_Type1 = 0;
          let totalUnitesMoisCourant_Type2 = 0;
          let totalUnitesMoisN1_Type2 = 0;
          let totalUnitesMoisN2_Type2 = 0;
          let totalUnitesMoisN3_Type2 = 0;

          const currentDate = new Date();
          const currentMonth = (currentDate.getMonth() + 1).toString().padStart(2, '0');
          const currentYear = currentDate.getFullYear();

          for (const robot of programs) {
            // Ne pas traiter le robot "TOUT"
            if (robot.nom_robot === "TOUT") continue;

            // Vérifier si le robot correspond au service sélectionné
            if (selectedService && robot.service !== selectedService) continue;

            // Récupère les données du robot
            rawData = (await fetchDataReportingByRobot(robot.nom_robot, robot.bareme, robot.type_gain)).map((entry: any) => ({
              ...entry,
              'NB UNITES DEPUIS DEBUT DU MOIS': String(entry['NB UNITES DEPUIS DEBUT DU MOIS']),
              'NB UNITES MOIS N-1': String(entry['NB UNITES MOIS N-1']),
              'NB UNITES MOIS N-2': String(entry['NB UNITES MOIS N-2']),
              'NB UNITES MOIS N-3': String(entry['NB UNITES MOIS N-3']),
            }));

            // Vérifier si rawData existe et contient des éléments
            if (!rawData || rawData.length === 0) {
              continue;
            }

            if (robot.id_agence === selectedAgency?.idAgence || selectedAgency?.nomAgence === "TOUTES") {
              // console.log('@@ 2 (lcombo robot changed:oadProgramData) selectedAgency :', selectedAgency);
              // console.log('@@ 2 (combo robot changed:loadProgramData) selectedRobotData :', selectedRobotData);
              const currentProgram = programs.find(p => p.nom_robot === robot.nom_robot);
              const robotType = currentProgram?.type_gain;
              //console.log('@@ 3 (loadProgramData) currentProgram :', currentProgram);

              for (const entry of rawData) {
                if (robotType === 'temps') {
                  totalUnitesMoisCourant_Type1 += Number(entry['NB UNITES DEPUIS DEBUT DU MOIS']) || 0;
                  totalUnitesMoisN1_Type1 += Number(entry['NB UNITES MOIS N-1']) || 0;
                  totalUnitesMoisN2_Type1 += Number(entry['NB UNITES MOIS N-2']) || 0;
                  totalUnitesMoisN3_Type1 += Number(entry['NB UNITES MOIS N-3']) || 0;
                } else if (robotType === 'autre') {
                  totalUnitesMoisCourant_Type2 += Number(entry['NB UNITES DEPUIS DEBUT DU MOIS']) || 0;
                  totalUnitesMoisN1_Type2 += Number(entry['NB UNITES MOIS N-1']) || 0;
                  totalUnitesMoisN2_Type2 += Number(entry['NB UNITES MOIS N-2']) || 0;
                  totalUnitesMoisN3_Type2 += Number(entry['NB UNITES MOIS N-3']) || 0;
                }

                for (let i = 1; i <= 31; i++) {
                  const dateKey = i.toString().padStart(2, '0') + '/' + currentMonth + '/' + currentYear;

                  if (entry[dateKey]) {
                    const value = entry[dateKey];
                    const idx = i - 1;
                    if (robotType === 'temps') {
                      arrJoursDuMois_Type1[idx] = `${Number(arrJoursDuMois_Type1[idx]) + Number(value)}`;
                    } else if (robotType === 'autre') {
                      arrJoursDuMois_Type2[idx] = `${Number(arrJoursDuMois_Type2[idx]) + Number(value)}`;
                    }
                  }
                }
              }

              //let oneRobotEvolution: any[] = [];
              if (selectedAgency.nomAgence !== 'TOUTES') {
                oneRobotEvolution = await fetchEvolutionsByProgram(robot.nom_robot);
                //console.log('all oneRobotEvolution', oneRobotEvolution);
                allRobotsEvolution.push(...oneRobotEvolution);
              }
            }
          }

          const mergedDataType1: DataEntry = {
            ...rawData[0],
            'NB UNITES DEPUIS DEBUT DU MOIS': formatNumber(totalUnitesMoisCourant_Type1),
            'NB UNITES MOIS N-1': formatNumber(totalUnitesMoisN1_Type1),
            'NB UNITES MOIS N-2': formatNumber(totalUnitesMoisN2_Type1),
            'NB UNITES MOIS N-3': formatNumber(totalUnitesMoisN3_Type1)
          };
          const mergedDataType2: DataEntry = {
            ...rawData[0],
            'NB UNITES DEPUIS DEBUT DU MOIS': formatNumber(totalUnitesMoisCourant_Type2),
            'NB UNITES MOIS N-1': formatNumber(totalUnitesMoisN1_Type2),
            'NB UNITES MOIS N-2': formatNumber(totalUnitesMoisN2_Type2),
            'NB UNITES MOIS N-3': formatNumber(totalUnitesMoisN3_Type2)
          };

          for (let i = 1; i <= 31; i++) {
            const dateKey = i.toString().padStart(2, '0') + '/' + currentMonth + '/' + currentYear;
            mergedDataType1[dateKey] = arrJoursDuMois_Type1[i - 1];
            mergedDataType2[dateKey] = arrJoursDuMois_Type2[i - 1];
          }

          if (selectedAgency && selectedAgency.nomAgence === 'TOUTES') {
            oneRobotEvolution = await fetchAllEvolutions();
            allRobotsEvolution.push(...oneRobotEvolution);
          }

          //console.log('Données pour "TOUT":', mergedDataType1, mergedDataType2);
          setRobotData1(mergedDataType1);
          setRobotData2(mergedDataType2);
          setHistoriqueData(allRobotsEvolution);
          // Utiliser Chart4All uniquement quand aucun service n'est sélectionné
          setUseChart4All(!selectedService);

        } else {
          setUseChart4All(false);
          const baremeValue = selectedRobotData.bareme === '' || selectedRobotData.bareme === '0' ? '0' : selectedRobotData.bareme;
          const data = await fetchDataReportingByRobot(selectedRobotData.nom_robot, baremeValue, selectedRobotData.type_gain);
          setRobotData(data[0]);

          const oneRobotEvolution = await fetchEvolutionsByProgram(selectedRobotData.nom_robot);
          //console.log('oneRobotEvolution', oneRobotEvolution);
          setHistoriqueData(oneRobotEvolution);
        }
      }
    };

    loadProgramData();
  }, [selectedRobotData]);

  const handleAgencyChange = (agencyId: string) => {
    const agency = agencies.find(a => a.idAgence === agencyId);
    console.log('--- AGENCY CHANGE ---');
    console.log('Agence choisie:', agency);
    setSelectedAgency(agency || null);
    sessionStorage.setItem('selectedAgencyId', agencyId);

    // Réinitialiser le service à "TOUT"
    setSelectedService('');

    // Réinitialiser les états
    setPrograms([]);
    setSelectedRobot(null);
    setSelectedRobotData(null);
    setRobotData(null);
    setRobotData1(null);
    setRobotData2(null);
    setHistoriqueData([]);

    // Charger les nouveaux robots depuis le cache
    if (agency && isDataInitialized()) {
      const filteredRobots = getRobotsByAgencyAndService(agency.idAgence, '');
      setPrograms(filteredRobots);

      if (filteredRobots.length > 0) {
        // Si un service est sélectionné, on prend le premier robot de ce service
        // Sinon, on prend le robot "TOUT"
        const firstRobot = selectedService ? filteredRobots[0] : filteredRobots.find(r => r.nom_robot === "TOUT") || filteredRobots[0];
        setSelectedRobot(firstRobot);
        setSelectedRobotData(firstRobot);
      }
    }
  };

  const handleServiceChange = (service: string) => {
    if (service === "") {  // Si "TOUT" est sélectionné
      // Sauvegarder l'agence en session avant de recharger
      if (selectedAgency) {
        sessionStorage.setItem('selectedAgencyId', selectedAgency.idAgence);
      }
      // Recharger la page
      window.location.reload();
    } else {
      setSelectedService(service);

      // Réinitialiser les états
      setPrograms([]);
      setSelectedRobot(null);
      setSelectedRobotData(null);
      setRobotData(null);
      setRobotData1(null);
      setRobotData2(null);
      setHistoriqueData([]);

      // Charger les nouveaux robots depuis le cache
      if (selectedAgency && isDataInitialized()) {
        const filteredRobots = getRobotsByAgencyAndService(selectedAgency.idAgence, service);
        setPrograms(filteredRobots);

        if (filteredRobots.length > 0) {
          const firstRobot = filteredRobots[0];
          setSelectedRobot(firstRobot);
          setSelectedRobotData(firstRobot);

          // Charger l'historique du robot
          const loadRobotHistory = async () => {
            const oneRobotEvolution = await fetchEvolutionsByProgram(firstRobot.nom_robot);
            setHistoriqueData(oneRobotEvolution);
          };
          loadRobotHistory();
        }
      }
    }
  };

  const handleProgramChange = (programId: string) => {
    console.log('--- ROBOT CHANGE ---');
    console.log('Program ID sélectionné:', programId);
    const program = programs.find(p => p.id_robot === programId);
    console.log('Programme trouvé:', program);
    if (program && selectedAgency) {
      setSelectedRobot(program);
      // Use the exact program name for searching in Firebase
      console.log('@@@ (Dashboard.tsx) Setting program data with name:', program.nom_robot);
      setSelectedRobotData(program);

      console.log('&&& Robot changé:', programId);
      console.log('Robot sélectionné:', program);
      console.log('Agence actuelle:', selectedAgency);
    } else {
      console.log('Programme ou agence non trouvé');
    }
  };

  const handleOpenForm = () => {
    setIsFormOpen(true);
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
  };

  if (error) {
    return <div className="text-red-500">{error}</div>;
  }

  if (!username) {
    return <div className="text-red-500">Pas d'utilisateur connecté</div>;
  }

  return (
    <>
      <div className='w-full pl-0 pl-0 '>
        <div className="max-w-7xl pl-0 ">
          <div className='flex items-center pl-0'>
            <div className="flex-none">
              <Image src="/logo_bbl-groupe.svg" alt="Logo BBL Groupe" width={100} height={70} />
            </div>
            <div className="flex-1 pr-[2%]"></div>
            <div className=" flex-none">
              <div className=" px-4pl-0 bg-x-500 ">
                <span className="text-black justify-end flex">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-user w-5 h-5 mr-2 text-gray-600">
                    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle>
                  </svg> {userData.userName}</span>
                <div className="flex space-x-8 mt-2">
                  <div className="flex items-center space-x-2">
                    <span>Agence:</span>
                    <AgencySelector
                      agencies={agencies}
                      selectedAgencyId={selectedAgency?.idAgence || ''}
                      onAgencyChange={handleAgencyChange}
                    />
                  </div>

                  <div className="flex items-center space-x-2">
                    <span>Service:</span>
                    <ServiceSelector
                      selectedService={selectedService}
                      onServiceChange={setSelectedService}
                    />
                  </div>

                  <div className="flex items-center space-x-2">
                    <span>Robot:</span>
                    <ProgramSelector
                      robots={programs}
                      selectedProgramId={selectedRobot?.id_robot || ''}
                      onProgramChange={handleProgramChange}
                    />

                    <div className="w-[50px]"></div>
                    <div className="flex justify-end bg-x-100 h-[40px]">
                      <button onClick={handleOpenForm} className="bg-neutral-950 text-neutral-100 border border-neutral-400 border-b-4 font-medium overflow-hidden relative px-4 py-1 rounded-lg hover:brightness-150 hover:border-t-4 hover:border-b active:opacity-75 outline-none duration-300 group">
                        <span className="bg-neutral-400 shadow-neutral-400 absolute -top-[150%] left-0 inline-flex w-80 h-[5px] roundedlg opacity-50 group-hover:top-[250%] duration-500 shadow-[0_0_5px_5px_rgba(0,0,0,0.3)]"></span>
                        Nouvelle Demande
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {OpenFormNewOrder &&
        <MergedRequestForm
          onClose={handleCloseForm}
          type="new"
          user={userData}
          formData={{
            Intitulé: '',
            Description: '',
            Robot: selectedRobot ? selectedRobot.nom_robot : '',
            Temps_consommé: '',
            Nb_operations_mensuelles: '',
            Statut: '1', // Par défaut "En attente de validation"
            Date: new Date().toISOString(),
            type: 'new'
          }}
        />}

      <div className="container mx-auto min-h-screen bg-x-100">
        {selectedRobot && (
          <div className="p-4 bg-x-200">
            <div className="grid grid-cols-4 gap-4 bg-x-100">
              <div className="col-span-4 pb-8">
                {selectedRobot?.nom_robot === 'TOUT' && (
                  selectedService ? (
                    <Chart4Service
                      key={`service-${selectedAgency?.idAgence}-${selectedService}`}
                      service={selectedService}
                      data={robotData1}
                    />
                  ) : (
                    <Chart4All
                      key={`all-${selectedAgency?.idAgence}-${selectedRobot?.type_gain}`}
                      robotType={selectedRobot?.type_gain}
                      data1={robotData1}
                      data2={robotData2}
                    />
                  )
                )}
                {selectedRobot?.nom_robot !== 'TOUT' && robotData && (
                  <Chart robotType={selectedRobot?.type_gain} data={robotData} />
                )}
              </div>
            </div>

            <div className="grid grid-cols-4 gap-4 bg-x-300 mt-5" >
              <div className="col-span-4 w-full">
                <ProgramTable robot={selectedRobot?.nom_robot || ''} data={historiqueData} typeGain={selectedRobot?.type_gain} useChart4All={useChart4All} user={userData} />
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
