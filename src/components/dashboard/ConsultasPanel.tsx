"use client";
import React, { useState } from 'react';

const ConsultasPanel: React.FC = () => {
  const [consulta, setConsulta] = useState('');
  const [historial, setHistorial] = useState<string[]>([]);

  function enviar() {
    if(!consulta.trim()) return;
    setHistorial(h => [consulta.trim(), ...h].slice(0,20));
    setConsulta('');
  }

  return (
    <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200 flex flex-col gap-3">
      <h3 className="font-semibold text-sm">Consultas</h3>
      <textarea className="border rounded-md p-2 text-sm resize-none h-24" placeholder="Escribe una consulta rápida..." value={consulta} onChange={e=>setConsulta(e.target.value)} />
      <div className="flex justify-end">
        <button onClick={enviar} className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-md text-sm">Enviar</button>
      </div>
      {historial.length>0 && (
        <div className="border-t pt-2">
          <div className="text-xs text-gray-500 mb-1">Historial</div>
          <ul className="space-y-1 max-h-40 overflow-auto text-xs">
            {historial.map((q,i)=>(<li key={i} className="truncate">• {q}</li>))}
          </ul>
        </div>
      )}
    </div>
  );
};
export default ConsultasPanel;
