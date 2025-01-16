import { collection, getDocs, query, where } from 'firebase/firestore';
//import { formatNumber } from '../components/Dashboard';
import { db } from '../lib/firebase';

// Variable globale pour stocker tous les programmes
export let allRobotsByAgency: Program[] = [];

interface UserData {
  userId: string;
  userName: string;
  userAgenceIds: string[];
}

/**
 * Fetches the user data for the given username from Firestore.
 * @param {string} username - The username to search for.
 * @returns {Promise<UserData | null>} - The user data if found, or null if not found.
 */
export async function fetchUserIdByUsername(username: string): Promise<UserData | null> {
  console.log('Fetching user data for username:', username);
  try {
    const usersRef = collection(db, 'utilisateurs');
    const q = query(usersRef, where('userName', '==', username));
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      console.log('No user found with username:', username);
      return null;
    }

    const userData = querySnapshot.docs[0].data();
    console.log('User data found:', userData);
    console.log('userAgenceIds:', userData.userAgenceIds);
    
    const userDataFormatted = {
      userId: userData.userId,
      userName: userData.userName,
      userAgenceIds: userData.userAgenceIds || []
    };
    console.log('Formatted user data:', userDataFormatted);
    return userDataFormatted;
  } catch (error) {
    console.log('Error fetching user data:', error);
    return null;
  }
}

interface Agency {
  idAgence: string;
  nomAgence: string;
}

  /**
   * Fetches all agencies for a given list of IDs.
   * Returns an array of agency objects with idAgence and nomAgence properties.
   * If no agency is found with a given ID, it is skipped.
   * If an error occurs, an empty array is returned.
   * @param agencyIds the list of agency IDs to fetch
   * @returns an array of agency objects
   */
export async function fetchAgenciesByIds(agencyIds: string[]): Promise<Agency[]> {
  console.log('Fetching agencies for IDs:', agencyIds);
  try {
    const agenciesRef = collection(db, 'agences');
    const agencies: Agency[] = [];

    for (const agencyId of agencyIds) {
      if (agencyId!="-") {
          console.log('Fetching agency with ID:', agencyId);
          const q = query(agenciesRef, where('idAgence', '==', agencyId));
          const querySnapshot = await getDocs(q);
          
          if (!querySnapshot.empty) {
            const agencyData = querySnapshot.docs[0].data();
            //console.log('Agency data found:', agencyData);
            agencies.push({
              idAgence: agencyData.idAgence,
              nomAgence: agencyData.nomAgence
            });
          } else {
            console.log('No agency found with ID:', agencyId);
          }
        }
    }

    //console.log('All agencies fetched:', agencies);
    return agencies;
  } catch (error) {
    console.log('Error fetching agencies:', error);
    return [];
  }
}

interface Program {
  id_programme: string;
  nom_programme: string;
  id_agence: string;
  type_gain: string;
  bareme: string;
}

  /**
   * Fetches all programs for a given agency ID.
   * If the agency ID is "ALL", fetches all programs.
   * @param agencyId The ID of the agency
   * @returns An array of programs
   */
export async function fetchProgramsByAgencyId(agencyId: string): Promise<Program[]> {
  console.log('fetchProgramsByAgencyId for agency ID:', agencyId);
  try {
    const programsRef = collection(db, 'programmes');
    let q;
    if (agencyId === "1") {
      // l'agence est "ALL", on récupérer tous les programmes
      //console.log('All agency -> Fetching ALL programs');
      q = query(programsRef);
    } else {
      // filtrer par id_agence
      //console.log('Fetching programs for agency ID:', agencyId);
      q = query(programsRef, where('id_agence', '==', agencyId));
    }

    const querySnapshot = await getDocs(q);
    
    const programs = querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id_programme: data.id_programme,
        nom_programme: data.nom_programme,
        id_agence: data.id_agence,
        type_gain: data.type_gain,
        bareme: data.bareme
      };
    });
    
    console.log('fetchProgramsByAgencyId(): ', programs);
    return programs;
  } catch (error) {
    console.log('Error fetching programs:', error);
    return [];
  }
}

/**
 * Fetches all robots from Firestore without agency filter
 * @returns An array of all programs
 */
export async function fetchAllRobotsByAgency(agencyId: string): Promise<Program[]> {
  console.log('-- fetchAllRobotsByAgency: id_agence= ', agencyId);
  try {
    const programsRef = collection(db, 'programmes');
    let q;
    if (agencyId === "1") {
      // l'agence est "ALL", on récupérer tous les programmes
      console.log('All agency -> Fetching ALL programs');
      q = query(programsRef);
    } else {
      // filtrer par id_agence
      console.log('Fetching programs for agency ID:', agencyId);
      q = query(programsRef, where('id_agence', '==', agencyId));
    }
    const querySnapshot = await getDocs(q);
    
    let robots = querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id_programme: data.id_programme,
        nom_programme: data.nom_programme,
        id_agence: data.id_agence,
        type_gain: data.type_gain,
        bareme: data.bareme
      };
    });
    
    // Trier les robots : "TOUT" en premier, puis par nom
    robots.sort((a, b) => {
      if (a.nom_programme === "TOUT") return -1;
      if (b.nom_programme === "TOUT") return 1;
      return a.nom_programme.localeCompare(b.nom_programme);
    });

    function removeDuplicates(robots: Program[]) {
      const uniqueRobots = [];
      const seenProgramNames = new Set();

      for (const robot of robots) {
        if (!seenProgramNames.has(robot.nom_programme)) {
          seenProgramNames.add(robot.nom_programme);
          uniqueRobots.push(robot);
        }
      }

      return uniqueRobots;
    }

    const uniqueRobots = removeDuplicates(robots);
    robots = uniqueRobots;
    
    // Mettre à jour la variable globale
    allRobotsByAgency = robots;
    console.log('All programs fetched and stored globally:', allRobotsByAgency);
    return robots;
  } catch (error) {
    console.log('Error fetching all programs:', error);
    return [];
  }
}

export async function fetchDataReportingByRobot(robotName: string, bareme: string, type_gain: string) {
  bareme = bareme.replace(',', '.');
  //console.log('Fetching DataReportingMoisCourant for the robot:', robotName, "bareme:", bareme, 'type_gain:', type_gain);
  try {
    const querySnapshot = await getDocs(collection(db, 'DataReportingMoisCourant'));
    //console.log('(fetchDataReportingByProgram) Nb robots:', querySnapshot.size);
    
    const documents = querySnapshot.docs.map(doc => doc.data());
    //console.log('All documents:', JSON.stringify(documents, null, 2));

    const data = querySnapshot.docs
      .map(doc => {
        const docData = doc.data();
        // Créer un objet avec toutes les dates du mois et leurs valeurs
        const dateData: { [key: string]: string } = {};
        const currentDate = new Date();
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth() + 1;
        
        // Pour chaque jour du mois
        for (let i = 1; i <= 31; i++) {
          const day = i.toString().padStart(2, '0');
          const dateKey = `${day}/${month.toString().padStart(2, '0')}/${year}`;
          dateData[dateKey] = '';
          dateData[dateKey] = '';
          if (docData[dateKey] && docData[dateKey] !== '') {
            //console.log('dateKey:', dateKey, 'docData[dateKey]:', docData[dateKey], ' Robot: ', docData['AGENCE'] +"_"+docData['NOM PROGRAMME']);
            dateData[dateKey] = bareme !== '0' && (Number(docData[dateKey])) ? (Number(docData[dateKey]) * Number(bareme)) : docData[dateKey].replace(',', '.');
          }
        }

        return {
          ...dateData,
          AGENCE: docData.AGENCE || 'N/A',
          'NOM PROGRAMME': docData['NOM PROGRAMME'] || 'N/A',
          
          'NB UNITES DEPUIS DEBUT DU MOIS': bareme === '0' || isNaN(Number(docData['NB UNITES DEPUIS DEBUT DU MOIS'])) ? docData['NB UNITES DEPUIS DEBUT DU MOIS'] : (Number(docData['NB UNITES DEPUIS DEBUT DU MOIS']) * Number(bareme)) || '0',
          'NB UNITES MOIS N-1': bareme === '0' || isNaN(Number(docData['NB UNITES MOIS N-1'])) ? docData['NB UNITES MOIS N-1'] : (Number(docData['NB UNITES MOIS N-1']) * Number(bareme)) || '0',
          'NB UNITES MOIS N-2': bareme === '0' || isNaN(Number(docData['NB UNITES MOIS N-2'])) ? docData['NB UNITES MOIS N-2'] : (Number(docData['NB UNITES MOIS N-2']) * Number(bareme)) || '0',
          'NB UNITES MOIS N-3': bareme === '0' || isNaN(Number(docData['NB UNITES MOIS N-3'])) ? docData['NB UNITES MOIS N-3'] : (Number(docData['NB UNITES MOIS N-3'].replace(',', '.')) * Number(bareme)) || '0',
        };
      })
      .filter(item => {
        //console.log('Comparing:', {'Item AGENCE + NOM PROGRAMME': item['AGENCE'] +"_"+item['NOM PROGRAMME'], });
        return item['AGENCE'] +"_"+item['NOM PROGRAMME'] === robotName;
      });

    //console.log('return  data :', data);
    return data;
  } catch (error) {
    console.log('Error fetching data:', error);
    return [];
  }
}

export async function fetchAllEvolutions() {
  console.log('fetchAllEvolutions');
  try {
    const evolutionsRef = collection(db, 'evolutions');
    const q = query(evolutionsRef);
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => doc.data());
  } catch (error) {
    console.log('Error fetching evolutions:', error);
    return [];
  }
}


export async function fetchEvolutionsByProgram(programId: string) {
  console.log('Fetching evolutions for Programme with name:', programId);
  try {
    const evolutionsRef = collection(db, 'evolutions');
    const q = query(evolutionsRef, where('Robot', '==', programId));
    const querySnapshot = await getDocs(q);
    
    //console.log('Raw evolutions documents fetched:', querySnapshot.size);
    
    const data = querySnapshot.docs.map(doc => {
      const docData = doc.data();
      //console.log('Evolution document data:', docData);
      return {
        id: doc.id,
        ...docData,
        'Date de la demande': docData['Date'] ? new Date(docData['Date']).toLocaleDateString('fr-FR') : ''
      };
    });

    //console.log('Processed evolutions data:', data);
    return data;
  } catch (error) {
    console.log('Error fetching evolutions:', error);
    return [];
  }
}


export async function fetchRandomQuote(): Promise<string | null> {
  //console.log('Fetching a random quote...');
  try {
    const quotesRef = collection(db, 'citations');
    const querySnapshot = await getDocs(quotesRef);
    //console.log('Quotes fetched:', querySnapshot.docs);
    if (querySnapshot.empty) {
      console.log('No quotes found.');
      return null;
    }

    const quotes = querySnapshot.docs.map(doc => doc.data().phrase); // Le champ de la citation s'appelle "phrase"
    const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];
    //console.log('Random quote fetched:', randomQuote);
    return randomQuote;
  } catch (error) {
    console.log('Error fetching random quote:', error);
    return null;
  }
}

export async function fetchStatuts() {
  //console.log('Fetching statuts...');
  try {
    const querySnapshot = await getDocs(collection(db, 'statut')); 
    const data = querySnapshot.docs.map(doc => {
      const docData = doc.data();
      //console.log('Statut document data:', docData);
      return {
        numero: docData.numero,
        label: docData.name || docData.label || ''
      };
    });
    // Trier les statuts par ordre ascendant selon le champ "numero"
    data.sort((a, b) => a.numero - b.numero);

    console.log('Statuts fetched:', data);
    return data;
  } catch (error) {
    console.log('Error fetching statuts:', error);
    return [];
  }
}
