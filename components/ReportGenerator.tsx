import React, { useState, useMemo } from 'react';
import { Incident, User, IncidentStatus, IncidentType } from '../types';
import { X, FileText, Download, Loader2, Calendar, Shield, MapPin, BarChart3, Printer, CheckCircle2, AlertTriangle } from 'lucide-react';
import { format, isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import { fr } from 'date-fns/locale';

interface ReportGeneratorProps {
  isOpen: boolean;
  onClose: () => void;
  incidents: Incident[];
  users: User[];
  currentUser: User;
}

export const ReportGenerator: React.FC<ReportGeneratorProps> = ({
  isOpen,
  onClose,
  incidents,
  users,
  currentUser
}) => {
  const [startDate, setStartDate] = useState<string>(() => format(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState<string>(() => format(new Date(), 'yyyy-MM-dd'));
  const [isGenerating, setIsGenerating] = useState(false);

  // --- STATS CALCULATION ---
  const reportData = useMemo(() => {
    const start = startOfDay(new Date(startDate));
    const end = endOfDay(new Date(endDate));

    const filtered = incidents.filter(inc => 
      isWithinInterval(inc.timestamp, { start, end })
    );

    const total = filtered.length;
    const byType: Record<string, number> = {};
    const byStatus: Record<string, number> = {};
    let highSeverityCount = 0;

    filtered.forEach(inc => {
      byType[inc.type] = (byType[inc.type] || 0) + 1;
      byStatus[inc.status] = (byStatus[inc.status] || 0) + 1;
      if (inc.type === IncidentType.SOS || inc.type === IncidentType.AGRESSION || inc.type === IncidentType.ENLEVEMENT) {
        highSeverityCount++;
      }
    });

    // Sort types by frequency
    const sortedTypes = Object.entries(byType)
      .sort((a, b) => {
        const valA = Number(a[1]);
        const valB = Number(b[1]);
        return valB - valA;
      })
      .map(([type, count]) => {
        const numCount = Number(count);
        return { 
          type, 
          count: numCount, 
          pct: total > 0 ? (numCount / total) * 100 : 0 
        };
      });

    return { filtered, total, byType: sortedTypes, byStatus, highSeverityCount, start, end };
  }, [incidents, startDate, endDate]);

  if (!isOpen) return null;

  const generatePDF = async () => {
    if (!(window as any).html2pdf) {
      alert("Module d'exportation introuvable.");
      return;
    }

    setIsGenerating(true);
    // Wait for render
    await new Promise(resolve => setTimeout(resolve, 800));
    
    const element = document.getElementById('official-report-template');
    if (!element) {
        setIsGenerating(false);
        return;
    }

    const opt = {
      margin: [10, 10, 10, 10], // top, left, bottom, right
      filename: `GomaSecure_Rapport_${startDate}_${endDate}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, logging: false },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
    };

    try {
        await (window as any).html2pdf().set(opt).from(element).save();
    } catch (e) {
        console.error(e);
        alert("Erreur lors de la génération du rapport.");
    } finally {
        setIsGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
            <div>
              <h2 className="text-xl font-black text-gray-900 flex items-center">
                <FileText className="mr-2 text-blue-600" /> 
                Générateur de Rapport
              </h2>
              <p className="text-xs text-gray-500 mt-1">Exportation des données sécuritaires</p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors"><X className="w-5 h-5 text-gray-500" /></button>
        </div>
        
        {/* Modal Body */}
        <div className="p-6 space-y-6">
             <div className="space-y-4">
                <label className="flex items-center text-sm font-bold uppercase text-gray-500 mb-2">
                  <Calendar className="w-4 h-4 mr-2" /> Période d'analyse
                </label>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-xs text-gray-400 block mb-1">Du</span>
                      <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full border-2 border-gray-200 rounded-xl p-3 text-sm font-bold focus:border-blue-500 outline-none transition-colors" />
                    </div>
                    <div>
                      <span className="text-xs text-gray-400 block mb-1">Au</span>
                      <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full border-2 border-gray-200 rounded-xl p-3 text-sm font-bold focus:border-blue-500 outline-none transition-colors" />
                    </div>
                </div>
             </div>

             <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                <div className="flex justify-between items-center mb-2">
                   <span className="text-sm font-bold text-blue-800">Aperçu rapide</span>
                   <BarChart3 className="w-4 h-4 text-blue-600" />
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-white p-2 rounded-lg shadow-sm">
                       <div className="text-lg font-black text-gray-900">{reportData.total}</div>
                       <div className="text-[10px] text-gray-500 uppercase">Incidents</div>
                    </div>
                    <div className="bg-white p-2 rounded-lg shadow-sm">
                       <div className="text-lg font-black text-red-600">{reportData.highSeverityCount}</div>
                       <div className="text-[10px] text-gray-500 uppercase">Critiques</div>
                    </div>
                    <div className="bg-white p-2 rounded-lg shadow-sm">
                       <div className="text-lg font-black text-green-600">
                         {reportData.byStatus[IncidentStatus.RESOLU] || 0}
                       </div>
                       <div className="text-[10px] text-gray-500 uppercase">Résolus</div>
                    </div>
                </div>
             </div>
        </div>

        {/* Modal Footer */}
        <div className="p-6 border-t border-gray-100 bg-gray-50 flex justify-end space-x-3">
             <button onClick={onClose} className="px-5 py-3 text-gray-600 font-bold hover:text-gray-900 transition-colors text-sm">Annuler</button>
             <button 
                onClick={generatePDF} 
                disabled={isGenerating || reportData.total === 0} 
                className="px-6 py-3 bg-blue-900 text-white rounded-xl font-bold flex items-center shadow-lg hover:bg-blue-800 disabled:opacity-50 disabled:shadow-none transition-all active:scale-95 text-sm"
             >
                {isGenerating ? (
                  <>
                    <Loader2 className="animate-spin mr-2 w-4 h-4" /> Traitement...
                  </>
                ) : (
                  <>
                    <Printer className="mr-2 w-4 h-4" /> Générer PDF Officiel
                  </>
                )}
             </button>
        </div>
      </div>

      {/* --- HIDDEN PDF TEMPLATE (A4 Styled) --- */}
      {/* Changed from opacity-0 to off-screen positioning to ensure html2canvas renders it correctly */}
      <div className="fixed top-0 left-[-10000px] z-[-100] w-[210mm] font-serif text-gray-900 pointer-events-none">
        <div id="official-report-template" className="bg-white min-h-[297mm] relative p-[15mm]">
            
            {/* Watermark */}
            <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] pointer-events-none overflow-hidden">
               <Shield className="w-[150mm] h-[150mm]" />
            </div>

            {/* Header */}
            <div className="flex justify-between items-start border-b-4 border-double border-gray-800 pb-6 mb-8">
                <div className="flex flex-col items-center w-1/3">
                    <div className="font-bold text-xs uppercase tracking-widest text-center">République Démocratique du Congo</div>
                    <div className="font-bold text-xs uppercase tracking-widest text-center">Province du Nord-Kivu</div>
                    <div className="font-black text-sm uppercase tracking-widest text-center mt-1">Ville de Goma</div>
                    <div className="mt-2 w-16 h-16 border-2 border-gray-900 rounded-full flex items-center justify-center">
                        <Shield className="w-10 h-10" />
                    </div>
                </div>
                <div className="w-2/3 text-right">
                    <h1 className="text-3xl font-black uppercase tracking-tight text-blue-900">Rapport de Situation</h1>
                    <div className="text-sm font-bold text-gray-500 mt-1 uppercase">Vigilance Communautaire & Sécurité</div>
                    <div className="mt-4 text-xs font-mono">
                        <div>RÉF: GS-REP-{format(new Date(), 'yyyyMMdd-HHmm')}</div>
                        <div>DATE: {format(new Date(), 'dd MMMM yyyy', { locale: fr })}</div>
                    </div>
                </div>
            </div>

            {/* Context */}
            <div className="mb-8 bg-gray-50 p-4 border-l-4 border-blue-900">
                <h3 className="text-sm font-bold uppercase text-blue-900 mb-2">Contexte du rapport</h3>
                <div className="flex justify-between text-sm">
                    <div>
                        <span className="font-bold text-gray-600">Période analysée :</span>
                        <span className="ml-2">{format(reportData.start, 'dd/MM/yyyy')} au {format(reportData.end, 'dd/MM/yyyy')}</span>
                    </div>
                    <div>
                        <span className="font-bold text-gray-600">Généré par :</span>
                        <span className="ml-2 uppercase">{currentUser.displayName} ({currentUser.role})</span>
                    </div>
                </div>
            </div>

            {/* Key Metrics Grid */}
            <div className="grid grid-cols-4 gap-4 mb-10">
                <div className="border border-gray-200 p-4 text-center">
                    <div className="text-3xl font-black text-gray-900">{reportData.total}</div>
                    <div className="text-[10px] uppercase font-bold text-gray-500 mt-1">Total Incidents</div>
                </div>
                <div className="border border-gray-200 p-4 text-center bg-red-50/50">
                    <div className="text-3xl font-black text-red-600">{reportData.highSeverityCount}</div>
                    <div className="text-[10px] uppercase font-bold text-red-800 mt-1">Gravité Haute</div>
                </div>
                <div className="border border-gray-200 p-4 text-center">
                    <div className="text-3xl font-black text-green-600">{reportData.byStatus[IncidentStatus.RESOLU] || 0}</div>
                    <div className="text-[10px] uppercase font-bold text-gray-500 mt-1">Résolus</div>
                </div>
                <div className="border border-gray-200 p-4 text-center">
                    <div className="text-3xl font-black text-orange-500">{reportData.byStatus[IncidentStatus.EN_ATTENTE] || 0}</div>
                    <div className="text-[10px] uppercase font-bold text-gray-500 mt-1">En Attente</div>
                </div>
            </div>

            {/* Analysis Section */}
            <div className="flex space-x-8 mb-10">
                {/* Type Distribution Chart (CSS) */}
                <div className="w-1/2">
                    <h3 className="text-sm font-bold uppercase border-b border-gray-300 pb-2 mb-4 flex items-center">
                        <BarChart3 className="w-4 h-4 mr-2" /> Typologie des Incidents
                    </h3>
                    <div className="space-y-3">
                        {reportData.byType.slice(0, 6).map((item, idx) => (
                            <div key={idx}>
                                <div className="flex justify-between text-xs mb-1 font-bold">
                                    <span>{item.type}</span>
                                    <span>{item.count} ({item.pct.toFixed(1)}%)</span>
                                </div>
                                <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                                    <div 
                                        className="h-full bg-gray-800 print:bg-gray-800" 
                                        style={{ width: `${item.pct}%`, backgroundColor: '#1f2937' }} // Inline style for PDF
                                    ></div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Status Summary */}
                <div className="w-1/2">
                    <h3 className="text-sm font-bold uppercase border-b border-gray-300 pb-2 mb-4 flex items-center">
                        <CheckCircle2 className="w-4 h-4 mr-2" /> État de Traitement
                    </h3>
                    <table className="w-full text-xs">
                        <thead className="bg-gray-100 font-bold">
                            <tr>
                                <td className="p-2">Statut</td>
                                <td className="p-2 text-right">Volume</td>
                                <td className="p-2 text-right">Impact</td>
                            </tr>
                        </thead>
                        <tbody>
                            {Object.entries(reportData.byStatus).map(([status, count], idx) => (
                                <tr key={status} className="border-b border-gray-100">
                                    <td className="p-2 font-bold text-gray-700">{status}</td>
                                    <td className="p-2 text-right">{count}</td>
                                    <td className="p-2 text-right">
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                            status === IncidentStatus.VALIDE ? 'bg-green-100 text-green-800' :
                                            status === IncidentStatus.REJETE ? 'bg-red-100 text-red-800' :
                                            'bg-gray-100 text-gray-800'
                                        }`}>
                                            {((Number(count) / reportData.total) * 100).toFixed(0)}%
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Detailed Table */}
            <div>
                <h3 className="text-sm font-bold uppercase border-b border-gray-300 pb-2 mb-4 flex items-center">
                    <MapPin className="w-4 h-4 mr-2" /> Journal des Incidents (Extrait)
                </h3>
                <table className="w-full text-[10px] border-collapse">
                    <thead>
                        <tr className="bg-gray-800 text-white font-bold uppercase">
                            <th className="p-2 text-left">Date / Heure</th>
                            <th className="p-2 text-left">Type</th>
                            <th className="p-2 text-left w-1/3">Description</th>
                            <th className="p-2 text-center">Fiabilité</th>
                            <th className="p-2 text-right">Statut</th>
                        </tr>
                    </thead>
                    <tbody>
                        {reportData.filtered.slice(0, 15).map((inc, i) => (
                            <tr key={inc.id} className={i % 2 === 0 ? 'bg-gray-50' : ''}>
                                <td className="p-2 border-b border-gray-200">{format(inc.timestamp, 'dd/MM/yyyy HH:mm')}</td>
                                <td className="p-2 border-b border-gray-200 font-bold">
                                    {inc.type === IncidentType.SOS && <span className="text-red-600 mr-1">⚠️</span>}
                                    {inc.type}
                                </td>
                                <td className="p-2 border-b border-gray-200 truncate max-w-xs text-gray-600 italic">
                                    {inc.description || "Aucune description"}
                                </td>
                                <td className="p-2 border-b border-gray-200 text-center font-mono">
                                    {inc.reliabilityScore}%
                                </td>
                                <td className="p-2 border-b border-gray-200 text-right font-bold text-gray-700">
                                    {inc.status}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {reportData.filtered.length > 15 && (
                    <div className="text-center text-xs text-gray-400 italic mt-2">
                        ... et {reportData.filtered.length - 15} autres incidents non listés dans cet extrait.
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="absolute bottom-[15mm] left-[15mm] right-[15mm] border-t border-gray-300 pt-4 flex justify-between items-end">
                <div className="text-[10px] text-gray-500">
                    <p className="font-bold">GomaSecure Command Center</p>
                    <p>Système de Vigilance Communautaire</p>
                    <p>Document généré électroniquement - Valide sans signature</p>
                </div>
                <div className="text-right">
                    <div className="h-10 w-32 border-b border-gray-400 mb-1"></div>
                    <p className="text-[10px] font-bold uppercase text-gray-600">Visa / Signature</p>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};