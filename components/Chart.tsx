'use client'

import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, ReferenceLine } from "recharts"
import React, { useState, useEffect } from 'react';
import { formatDuration } from '../lib/utils'
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
//import { fetchDataReportingByRobot } from '../utils/dataFetcher'
import { Program, cachedRobots4Agencies } from '../utils/dataStore';

interface ChartProps {
  robotType: string
  data: any
  selectedAgency: string
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

export default function Chart({ robotType, data, selectedAgency }: ChartProps) {

    console.log("Chart.tsx - data:", data);
    //console.log("Chart.tsx - selectedAgency:", selectedAgency);
    //console.log("Chart.tsx - robots:", robots);
    const [robots, setRobots] = useState<Program[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const currentDate = new Date();
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth() + 1;
    let displayMonth = month;
    let displayYear = year;
    if(currentDate.getDate() === 1) {
      if(month === 1) {
        displayMonth = 12;
        displayYear = year - 1;
      } else {
        displayMonth = month - 1;
      }
    }

  // Generate chart data for the current month
  const chartData = Array.from({ length: 31 }, (_, i) => {
    const day = (i + 1).toString().padStart(2, '0');
    const dateKey = `${day}/${displayMonth.toString().padStart(2, '0')}/${displayYear}`;
    let value = 0;
    // Check if data exists for the given dateKey and assign it to value
    if (data && data[dateKey]) {
      value = Number(data[dateKey]);
    }

    return {
      date: dateKey,
      valeur: value
    };
  });

  return (
    <>
    <div className="w-full flex justify- gap-4 items-center ">

      <div className="w-2/3 pt-4 pb-12 bg-white rounded-lg shadow ml-2">
          <div className="h-[300px] relative ">
            {/* Histogram */}
            {data ? (
              <>
                <div className="ml-[10%] text-left text-xl font-bold mb-4">
                  {robotType?.toLowerCase() === 'temps' ? 'Gain de temps  ('+data.temps_par_unite+' min / traitement)' : 'Sécurisation des processus'} {/*data['AGENCE'] + '_' + data['NOM PROGRAMME']*/}
                </div>
                <div className="absolute top-2 right-2 text-black px-2 py-1 ">
                  {robotType?.toLowerCase() === "autre" && (
                    "Nombre d'execution"
                  )}
                </div>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={chartData}
                    width={600}
                    height={500}
                    barSize={40}
                    barGap={15}
                    title=""
                    margin={{ top: 30, right: 10, left: 5, bottom: 1 }}
                  >
                    <XAxis
                      dataKey="date"
                      stroke="#888888"
                      tickLine={false}
                      axisLine={false}
                      tick={<CustomizedAxisTick x={0} y={0} payload={{
                        value: "--"
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
                      tickFormatter={(value: number) => (robotType?.toLowerCase() === "temps" ? formatDuration(value) : `${value}`)}
                      fontSize={10} />
                    <Tooltip
                      labelFormatter={(label: string) => label}
                      // Customize the tooltip content based on the payload and label
                      content={({ payload, label }) => {
                        if (!payload || payload.length === 0) return null;
                        const { valeur, date } = payload[0].payload;
                        if (valeur === undefined || valeur === 0) return null;

                        if (robotType?.toLowerCase() === "temps") {
                          // Calculate gain and number of treatments for 'temps' robotType
                          const gain = 'Gain : ' + formatDuration(valeur);
                          const nbTraitement = 'Nb traitement : ' + (data.temps_par_unite ? Math.round(valeur / data.temps_par_unite) : 'N/A');
                          // Format the date for display
                          const dateFormatted = new Date(date.split('/').reverse().join('-')).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
                          return (
                            <div className="bg-white shadow-md p-2 border border-gray-200 rounded text-sm">
                              <p className="font-bold">{dateFormatted}</p>
                              <p className="text-gray-600">{gain}</p>
                              <p className="text-gray-600">{nbTraitement}</p>  
                            </div>
                          );
                        }

                        // Default tooltip content for other robotTypes
                        return (
                          <div className="bg-white shadow-md p-2 border border-gray-200 rounded text-sm">
                            {valeur > 1 ? `${valeur} éxecutions` : `${valeur} éxecution`}
                          </div>
                        );
                      }} />
                    <Bar
                      dataKey="valeur"
                      fill={robotType?.toLowerCase() === "temps" ? "#3498db" : "#EA580C"}
                      radius={[4, 4, 0, 0]}
                      name="Quantité"
                      label={{
                        position: 'top',
                        fill: '#000',
                        fontSize: 10,
                        formatter: (value: number) => value === 0 ? '' : (robotType?.toLowerCase() === "temps" ? formatDuration(value) : `${value}`)
                      }}
                      activeBar={{ fill: robotType?.toLowerCase() === "temps" ? '#3333db' : '#c24a0a' }}
                      />
                  </BarChart>
                </ResponsiveContainer>
              </>
            ) : (
              <div className="flex justify-center items-center h-[400px] text-gray-500">
                Aucune donnée disponible
              </div>
            )}
            {/* // fin histogramme */}
          </div>
          <div className="flex justify-around mt-10">
            {/* // Indicateurs mensuels */}
            {data ? (
              <>
              <div className="w-1/4 mr-5 ml-5 ">
                <div className={robotType?.toLowerCase() === 'temps' ? ('bg-[#3498db] hover:bg-[#3333db] text-white shadow-md rounded-lg py-2' ) : ( 'bg-[#EA580C] hover:bg-[#c24a0a] text-white shadow-md rounded-lg py-2')}>
                    <div className="ml-4 text-xs ">Total du mois</div>
                    <div className="ml-4 text-xl" title={data['NB UNITES DEPUIS DEBUT DU MOIS'] ? data['NB UNITES DEPUIS DEBUT DU MOIS']+' minutes' : 'N/A'}>
                    {data['NB UNITES DEPUIS DEBUT DU MOIS'] ? (  
                      (robotType?.toLowerCase() === 'temps' ? formatDuration(data['NB UNITES DEPUIS DEBUT DU MOIS']) : `${data['NB UNITES DEPUIS DEBUT DU MOIS']}`)
                      ) : ('N/A') }
                    </div>
                </div>
              </div>
              <div className=" w-1/4 mr-5 ml-5">
                <div className={robotType?.toLowerCase() === 'temps' ? ('bg-[#3498db] hover:bg-[#3333db] text-white shadow-md rounded-lg py-2' ) : ( 'bg-[#EA580C] hover:bg-[#c24a0a] text-white shadow-md rounded-lg py-2')}>
                  <div className="ml-4 text-xs ">M-1</div>
                  <div className="ml-4 text-xl" title={data['NB UNITES MOIS N-1'] ? data['NB UNITES MOIS N-1'] +' minutes' : 'N/A'}>
                    {data['NB UNITES MOIS N-1'] ? (  
                    (robotType?.toLowerCase() === 'temps' ? formatDuration(data['NB UNITES MOIS N-1']) : `${data['NB UNITES MOIS N-1']}`)
                    ) : ('N/A') }
                  </div>
                </div>
              </div>
              <div className=" w-1/4 mr-5 ml-5">
                <div className={robotType?.toLowerCase() === 'temps' ? ('bg-[#3498db] hover:bg-[#3333db] text-white shadow-md rounded-lg py-2' ) : ( 'bg-[#EA580C] hover:bg-[#c24a0a] text-white shadow-md rounded-lg py-2')}>
                    <div className="ml-4 text-xs ">M-2</div>
                    <div className="ml-4 text-xl" title={data['NB UNITES MOIS N-2'] ? data['NB UNITES MOIS N-2'] +' minutes' : 'N/A'}>
                    {data['NB UNITES MOIS N-2'] ? (
                      (robotType?.toLowerCase() === 'temps' ? formatDuration(data['NB UNITES MOIS N-2']) : `${data['NB UNITES MOIS N-2']}`)) : ('N/A') }
                    </div>
                </div>
              </div>
              <div className="w-1/4 mr-5 ml-5">
                <div className={robotType?.toLowerCase() === 'temps' ? ('bg-[#3498db] hover:bg-[#3333db] text-white shadow-md rounded-lg py-2' ) : ( 'bg-[#EA580C] hover:bg-[#c24a0a] text-white shadow-md rounded-lg py-2')}>
                  <div className="ml-4 text-xs ">M-3</div>
                  <div className="ml-4 text-xl" title={data['NB UNITES MOIS N-3'] ? data['NB UNITES MOIS N-3'] +' minutes' : 'N/A'}>
                  {data['NB UNITES MOIS N-3'] ? (  
                    (robotType?.toLowerCase() === 'temps' ? formatDuration(data['NB UNITES MOIS N-3']) : `${data['NB UNITES MOIS N-3']}`)
                    ) : ('N/A') }
                  </div>
                </div>
              </div>
              </>
            ) : (
            <div className="flex justify-center  h-[60px] text-gray-500">
            </div>
            )}
            {/* // fin Indicateurs mensuels */}
          </div>

      </div>

      <div className="w-1/3 p-4 pb-12 bg-white rounded-lg shadow ml-2">
          <div className="h-[400px] relative">
            {data ? (
              <>
                <div className="flex justify-center items-center mt-0 bg-x-100">
                  <span className="text-red-700 text-3xl font-bold">Description</span>
                </div>
             
                <div className="mt-5  px-4 pt-6" >
                  Robot : <span className="font-bold">{data.robot}</span>
                </div>         
                <div className="mt-2 ml-4" >
                  Agence : <span className="_font-bold">{data.agenceLbl}</span>
                </div>   
                <div className="mt-2 ml-4" >
                  Service : <span className="font-">{data.service}</span>
                </div>
                <div className="mt-4 px-4 pt-2" >
                {data.description_long}
                </div>      
                <div className="mt-4 px-4 pt-2" >
                Problème : {data.probleme}
                </div>   
                <div className="mt-4 px-4 pt-2" >
                Solution apportée : {data.resultat}
                </div>   
                </>
              ) : (
                <div className="flex justify-center items-center text-center h-[400px] ">
                  <span className="text-gray-500">Aucune donnée disponible</span>
                </div>
              )}
          
          </div>
      </div>

     </div>

    </>
  );
}
