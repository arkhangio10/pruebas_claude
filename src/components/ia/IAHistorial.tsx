"use client";
import React, { useState } from 'react';
import { useIA } from '@/context/IAContext';

export const IAHistorial: React.FC = () => {
  const { history, clearHistory } = useIA();
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  if (history.length === 0) {
    return null;
  }

  return (
    <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200 space-y-4 mt-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Historial de Consultas</h3>
        <button 
          onClick={clearHistory}
          className="text-sm text-red-600 hover:text-red-800"
        >
          Borrar historial
        </button>
      </div>
      
      <div className="space-y-3">
        {history.map((item, index) => (
          <div key={index} className="border border-gray-100 rounded-md overflow-hidden">
            <div 
              className="flex justify-between items-center p-3 bg-gray-50 cursor-pointer"
              onClick={() => setExpandedIndex(expandedIndex === index ? null : index)}
            >
              <div>
                <span className="font-medium capitalize">{item.query.tipo}</span>
                {item.query.prompt && (
                  <span className="ml-2 text-sm text-gray-500">
                    {item.query.prompt.substring(0, 40)}
                    {item.query.prompt.length > 40 ? '...' : ''}
                  </span>
                )}
              </div>
              <div className="flex items-center">
                <span className="text-xs text-gray-400 mr-2">
                  {new Date(item.result.timestamp).toLocaleString()}
                </span>
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  className={`h-5 w-5 transition-transform ${expandedIndex === index ? 'transform rotate-180' : ''}`} 
                  viewBox="0 0 20 20" 
                  fill="currentColor"
                >
                  <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </div>
            </div>
            
            {expandedIndex === index && (
              <div className="p-3 border-t border-gray-100">
                {item.result.insights.length > 0 && (
                  <div className="mb-3">
                    <h4 className="text-sm font-medium mb-1">Insights:</h4>
                    <ul className="list-disc pl-5 text-sm space-y-1">
                      {item.result.insights.slice(0, 2).map((insight, i) => (
                        <li key={i} className="text-gray-700">{insight}</li>
                      ))}
                      {item.result.insights.length > 2 && (
                        <li className="text-gray-500 italic">
                          (+{item.result.insights.length - 2} más)
                        </li>
                      )}
                    </ul>
                  </div>
                )}
                
                {item.result.recommendations.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium mb-1">Recomendaciones principales:</h4>
                    <ul className="list-disc pl-5 text-sm">
                      {item.result.recommendations.slice(0, 1).map((rec, i) => (
                        <li key={i} className="text-gray-700">{rec}</li>
                      ))}
                      {item.result.recommendations.length > 1 && (
                        <li className="text-gray-500 italic">
                          (+{item.result.recommendations.length - 1} más)
                        </li>
                      )}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
