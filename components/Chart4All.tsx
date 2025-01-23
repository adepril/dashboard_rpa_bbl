'use client'

import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, ReferenceLine} from "recharts"
import React, { useState, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { formatDuration } from '../lib/utils'

interface ChartProps {
  robotType: string
  data1: any,data2: any
}

interface CustomizedAxisTickProps {
  x: number;
  y: number;
  payload: {
    value: string;
  };
}

const CustomizedAxisTick: React.FC<CustomizedAxisTickProps> = (props) => {
  const { x, y, payload } = props;
  return (
    <g transform={`translate(${x},${y})`}>
      <text 
        x={0} 
        y={0} 
        dy={16} 
        textAnchor="end" 
        fill="#666" 
        transform="rotate(-35)" 
        fontSize={10}
      >
        {payload.value}
      </text>
    </g>
  );
}

export default function Chart({ robotType,data1,data2 }: ChartProps) {
  interface Robot {
    id_robot: string;
    nom_robot: string;
    service: string;
    id_agence: string;
    type_gain: string;
    description: string;
    bareme: string;
  }

  const [robots, setRobots] = useState<Robot[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchRobots = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, 'robots'));
        const robotsData = querySnapshot.docs
          .map(doc => ({
            id_robot: doc.id,
            nom_robot: doc.data().nom_robot,
            type_gain: doc.data().type_gain,
            description: doc.data().description,
            id_agence: doc.data().id_agence,
            service: doc.data().service,
            bareme: doc.data().bareme
          } as Robot))
          .filter(robot => robot.type_gain === 'autre');
          
        if (robotsData.length === 0) {
          setError('Aucun robot trouvé avec type_gain = "autre"');
        } else {
          setRobots(robotsData);
          setError(null);
        }
      } catch (err) {
        setError('Erreur lors du chargement des données');
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchRobots();
  }, []);

  useEffect(() => {
    if (robots.length > 0 && !isPaused) {
      const interval = setInterval(() => {
        setCurrentIndex(prevIndex => (prevIndex + 1) % robots.length);
      }, 30000);

      return () => clearInterval(interval);
    }
  }, [robots, isPaused]);

  const handlePauseResume = () => {
    setIsPaused(prev => !prev);
  };

  //console.log("Chart4All.tsx",data1);
  if (!data1) {
    return (
      <div className="flex justify-center items-center h-[400px] text-gray-500">
        L'histogramme ne peut être généré car aucune donnée disponible pour ce programme
      </div>
    );
  }

  const currentDate = new Date();
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth() + 1;
  
  // Chart 1
  const chartData1 = Array.from({ length: 31 }, (_, i) => {
    const day = (i + 1).toString().padStart(2, '0');
    const dateKey = `${day}/${month.toString().padStart(2, '0')}/${year}`;
    let value = 0;
    //console.log("Chart.tsx",data[dateKey]);
    if (data1 && data1[dateKey]) {
      value = Number(data1[dateKey]);
    } else {
      //console.log('data[dateKey] is undefined');
    }
    return {
      date: dateKey,
      valeur: value
    };
  }); // Chart 1

  // Chart 2
  // const chartData2 = Array.from({ length: 31 }, (_, i) => {
  //   const day = (i + 1).toString().padStart(2, '0');
  //   const dateKey = `${day}/${month.toString().padStart(2, '0')}/${year}`;
  //   let value = 0;
  //   //console.log("Chart.tsx",data[dateKey]);
  //   if (data2 && data2[dateKey]) {
  //     value = Number(data2[dateKey]);
  //   } else {
  //     //console.log('data[dateKey] is undefined');
  //   }
  //   return {
  //     date: dateKey,
  //     valeur: value
  //   };
  // }); // Chart 2

  // if (chartData1.every(item => item.valeur === 0)) {
  //   return (
  //     <div className="flex justify-center items-center h-[400px] text-gray-500">
  //       L'histogramme ne peut être généré car aucune donnée disponible pour ce programme
  //     </div>
  //   );
  // }

  return (
    <>
    <div className="w-full flex justify- gap-4 items-center ">

    <div className="w-2/3 pt-4 pb-12 bg-white rounded-lg shadow ml-2"> 
    
        <div className="h-[300px] relative">
        <div className="ml-[10%] text-left text-xl font-bold mb-4">Gain de temps</div>
          {/* <div className="absolute top-2 right-2 text-black px-2 py-1 ">Échelle de temps en heures:minutes</div> */}

          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData1}
              width={600}
              height={600}
              barSize={40}
              barGap={15}
              title=""
              margin={{ top: 20, right: 10, left: 5, bottom: 1 }}
            >
              <XAxis
                dataKey="date"
                stroke="#888888"
                tickLine={false}
                axisLine={false}
                tick={<CustomizedAxisTick x={0} y={0} payload={{
                  value: ""
                }} />}
                height={60}
                tickFormatter={(t) => `${t}`} />
              <ReferenceLine 
                y={0} 
                stroke="#888888" 
                strokeWidth={1} />
              <YAxis
                stroke="#888888"
                tickLine={false}
                axisLine={false}
                tickFormatter={(value: number) => formatDuration(value)}
                fontSize={10} />
              <Tooltip
                labelFormatter={(label: string) => label}
                formatter={(value: any, name: string, props: any) => {
                  const valeur  = props.payload;
                  if ((valeur === undefined || valeur === 0) ) {
                    return [''];
                  }
                  const gain = `Gain : ${formatDuration(valeur.valeur)}`;
                  return [gain];
                } } />
              <Bar
                dataKey="valeur"
                fill="#3498db" 
                radius={[4, 4, 0, 0]}
                name="Quantité"
                label={{
                  position: 'top',
                  fill: '#000',
                  fontSize: 12,
                  formatter: (value: number) => value === 0 ? '' : formatDuration(value)
                }}
                activeBar={{ fill: robotType?.toLowerCase() === "temps" ? '#3498db' : '#3333db' }}
                />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="flex justify-around mt-10">
            <div className="w-1/4 mr-5 ml-5 ">
              <div className='bg-[#3498db] hover:bg-[#3333db] text-white shadow-md rounded-lg py-2'>
                <div className="ml-4 text-xs ">Total du mois</div>
                <div className="ml-4 text-xl " title={data1['NB UNITES DEPUIS DEBUT DU MOIS'] ? data1['NB UNITES DEPUIS DEBUT DU MOIS'] +' minutes' : 'N/A'}>
                {data1['NB UNITES DEPUIS DEBUT DU MOIS'] ? ( formatDuration(data1['NB UNITES DEPUIS DEBUT DU MOIS'])) : ('N/A') }
                </div>
              </div>
            </div>
            <div className=" w-1/4 mr-5 ml-5">
            <div className='bg-[#3498db] hover:bg-[#3333db] text-white shadow-md rounded-lg py-2'>
                <div className="ml-4 text-xs ">M-1</div>
                <div className="ml-4 text-xl" title={data1['NB UNITES MOIS N-1'] ? data1['NB UNITES MOIS N-1'] +' minutes' : 'N/A'}>{data1['NB UNITES MOIS N-1'] ? ( formatDuration(data1['NB UNITES MOIS N-1'])) : ('N/A') }</div>
              </div>
            </div>
            <div className=" w-1/4 mr-5 ml-5">
              <div className='bg-[#3498db] hover:bg-[#3333db] text-white shadow-md rounded-lg py-2'>
                <div className="ml-4 text-xs">M-2</div>
                <div className="ml-4 text-xl" title={data1['NB UNITES MOIS N-2'] ? data1['NB UNITES MOIS N-2'] +' minutes' : 'N/A'}>{data1['NB UNITES MOIS N-2'] ? ( formatDuration(data1['NB UNITES MOIS N-2'])) : ('N/A') }</div>
              </div>
            </div>
            <div className="w-1/4 mr-5 ml-5">
            <div className='bg-[#3498db] hover:bg-[#3333db] text-white shadow-md rounded-lg py-2'>
                <div className="ml-4 text-xs ">M-3</div>
                <div className="ml-4 text-xl" title={data1['NB UNITES MOIS N-3'] ? data1['NB UNITES MOIS N-3'] +' minutes' : 'N/A'}>{data1['NB UNITES MOIS N-3'] ? ( formatDuration(data1['NB UNITES MOIS N-3'])) : ('N/A') }</div>
              </div>
            </div>
        </div> 
      </div>

      <div className="w-1/3 p-4 pb-12 bg-white rounded-lg shadow ml-2">
          <div className="h-[400px] relative">
  
            <div className="flex flex-col justify-center items-center text-gray-500">
              <span className="text-red-800 text-xl font-bold ml-10">Le saviez-vous ?</span>
            </div>
            <div className="h-[50px] bg-x-200"></div>
              {isLoading ? (
                <div className="mt-4 text-gray-500">Chargement en cours...</div>
              ) : error ? (
                <div className="mt-4 text-red-500">{error}</div>
              ) : robots.length > 0 ? (
                <>
                  <div className="mt-4 px-4 pt-10" >
                    Robot <span className="font-bold">"{robots[currentIndex]?.nom_robot.split('_')[1]}"</span> :
                  </div>
                  <div className="mt-4 px-4 r">
                    {robots[currentIndex]?.description}
                  </div>
                  <div className="h-[80px] bg-x-200"></div>
                  <div className="absolute bottom-1 left-0 right-0 flex gap-2 items-center justify-center">
                    <button
                      onClick={() => setCurrentIndex(prev => prev > 0 ? prev - 1 : robots.length - 1)}
                      className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
                    >
                      ←
                    </button>
                    <button
                      onClick={handlePauseResume} 
                      className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
                    >
                      {isPaused ? '▶' : '||'}
                    </button>
                    <button
                      onClick={() => setCurrentIndex(prev => (prev + 1) % robots.length)}
                      className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
                    >
                      →
                    </button>
                  </div>
                </>
              ) : (
                <div className="mt-4 text-gray-500">Aucune information disponible</div>
              )}
            </div>

      </div> 
          
    </div>
    </>
  );
}
