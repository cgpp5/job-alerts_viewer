import React, { useState, useMemo, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js'; 
import { 
  Search, 
  Filter, 
  Trash2, 
  X, 
  ExternalLink, 
  MapPin, 
  Briefcase, 
  Calendar, 
  ChevronLeft, 
  ChevronRight,
  Linkedin,
  Globe,
  Languages,
  Banknote,
  Building2,
  Users,
  LogOut,
  Loader2, 
  AlertCircle
} from 'lucide-react';

import Login from './Login';

// --- CONFIGURACIÓN DE SUPABASE ---
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const getUniqueValues = (data, key) => {
  const allValues = data.flatMap(item => item[key] || []);
  return [...new Set(allValues)].sort();
};

const LANGUAGES_LIST = ["Inglés", "Español", "Catalán", "Francés", "Italiano", "Alemán"];

const WORKPLACE_TRANSLATIONS = {
  'On-site': 'Presencial',
  'Hybrid': 'Híbrido',
  'Remote': 'Remoto'
};

const EMPLOYMENT_TRANSLATIONS = {
  'Full-time': 'Tiempo completo',
  'Part-time': 'Tiempo parcial',
  'Contract': 'Temporal',
  'Internship': 'Prácticas',
  'Temporary': 'Temporal'
};

export default function App() {
  const [session, setSession] = useState(null);
  const [loadingSession, setLoadingSession] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoadingSession(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoadingSession(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Estado para los trabajos, carga y errores
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const listRef = useRef(null);

  const [view, setView] = useState('list');
  const [selectedJob, setSelectedJob] = useState(null);
  
  // --- ESTADOS DE FILTROS ---
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterWorkplace, setFilterWorkplace] = useState([]); 
  const [filterEmployment, setFilterEmployment] = useState([]);
  const [filterLocation, setFilterLocation] = useState("");
  const [filterSalary, setFilterSalary] = useState(0);
  const [filterSkills, setFilterSkills] = useState([]);
  const [filterExperience, setFilterExperience] = useState([0, 30]);
  const [filterLanguages, setFilterLanguages] = useState([]);

  // --- PAGINACIÓN ---
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 25;

  // --- EFECTO PARA CARGAR DATOS DE SUPABASE ---
  useEffect(() => {
    if (session) fetchJobs();
  }, [session]);

  const fetchJobs = async () => {
    try {
      setLoading(true);
      // Hacemos la consulta a la tabla 'jobs'
      // Supabase limita por defecto a 1000 filas. Aumentamos el rango para traer más.
      const { data, error } = await supabase
        .from('jobs')
        .select('*')
        .order('posted_on', { ascending: false, nullsFirst: false })
        .range(0, 9999);

      if (error) throw error;

      // Procesamos los datos para asegurar que skills y languages sean Arrays.
      // Supabase devuelve JSONb como objetos/arrays automáticamente, pero mantenemos compatibilidad.
      const formattedData = data.map(job => ({
        ...job,
        required_skills: Array.isArray(job.required_skills) 
          ? job.required_skills 
          : (typeof job.required_skills === 'string' ? JSON.parse(job.required_skills || '[]') : []),
        
        required_languages: Array.isArray(job.required_languages)
          ? job.required_languages
          : (typeof job.required_languages === 'string' ? JSON.parse(job.required_languages || '[]') : [])
      }));

      setJobs(formattedData);
    } catch (err) {
      console.error("Error cargando ofertas:", err);
      setError("No se pudieron cargar las ofertas. Revisa tu conexión a Supabase.");
    } finally {
      setLoading(false);
    }
  };

  const allSkills = useMemo(() => getUniqueValues(jobs, 'required_skills'), [jobs]);

  const formatDate = (dateStr) => {
    if (!dateStr) return 'Sin fecha';
    const date = new Date(dateStr);
    // Ajustamos la zona horaria para evitar desfases si viene solo como YYYY-MM-DD
    const userTimezoneOffset = date.getTimezoneOffset() * 60000;
    const adjustedDate = new Date(date.getTime() + userTimezoneOffset);
    
    return isNaN(date.getTime()) 
      ? dateStr 
      : date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  // --- LÓGICA DE CONTROL ---
  
  const toggleStatus = async (jobId, currentStatus) => {
    const newStatus = currentStatus === 'Open' ? 'Closed' : 'Open';
    
    // 1. Actualización Optimista (UI primero)
    const updatedJobs = jobs.map(job => job.job_id === jobId ? { ...job, status: newStatus } : job);
    setJobs(updatedJobs);
    if (selectedJob && selectedJob.job_id === jobId) {
      setSelectedJob({ ...selectedJob, status: newStatus });
    }

    // 2. Actualización en Supabase
    const { error } = await supabase
      .from('jobs')
      .update({ status: newStatus })
      .eq('job_id', jobId);

    if (error) {
      console.error("Error actualizando estado:", error);
      alert("Error al guardar en base de datos (Simulado)");
    }
  };

  const deleteJob = async (jobId) => {
    if(!confirm("¿Estás seguro de que quieres borrar esta oferta?")) return;

    // 1. UI update
    setJobs(jobs.filter(job => job.job_id !== jobId));
    if (selectedJob?.job_id === jobId) {
      setView('list');
      setSelectedJob(null);
    }

    // 2. Supabase delete
    const { error } = await supabase
      .from('jobs')
      .delete()
      .eq('job_id', jobId);

    if (error) console.error("Error eliminando:", error);
  };

  const toggleSelection = (item, list, setList) => {
    if (list.includes(item)) {
      setList(list.filter(i => i !== item));
    } else {
      setList([...list, item]);
    }
  };

  const handleExperienceChange = (e, index) => {
    const value = Math.min(Math.max(Number(e.target.value), 0), 30);
    const newRange = [...filterExperience];
    newRange[index] = value;
    
    if (index === 0 && value > newRange[1]) {
        newRange[0] = newRange[1];
    } else if (index === 1 && value < newRange[0]) {
        newRange[1] = newRange[0];
    } else {
        newRange[index] = value;
    }
    setFilterExperience(newRange);
  };

  const filteredJobs = useMemo(() => {
    return jobs.filter(job => {
      const matchesSearch = (job.title || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                            (job.company || '').toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = filterStatus === 'all' || job.status === filterStatus;
      
      const matchesWorkplace = filterWorkplace.length === 0 || 
                               filterWorkplace.includes(job.workplace_type);

      const matchesEmployment = filterEmployment.length === 0 || 
                                filterEmployment.some(type => (job.employment_type || '').includes(type));

      const matchesLocation = filterLocation === "" || 
                              (job.location || '').toLowerCase().includes(filterLocation.toLowerCase());
      
      // El filtro comprueba si el rango salarial de la oferta alcanza o supera el filtro seleccionado.
      // Si la oferta es 30k-60k y el filtro es 40k, entra (60 >= 40).
      const matchesSalary = (job.salary_max || job.salary_min || 0) >= filterSalary;

      const matchesSkills = filterSkills.length === 0 || 
                            filterSkills.every(skill => (job.required_skills || []).includes(skill));

      const exp = job.required_experience_years || 0;
      const matchesExperience = exp >= filterExperience[0] && exp <= filterExperience[1];

      const matchesLanguages = filterLanguages.length === 0 || 
                               filterLanguages.every(filterLang => 
                                 (job.required_languages || []).some(lang => {
                                   if (typeof lang === 'string') return lang === filterLang;
                                   if (typeof lang === 'object' && lang !== null) return Object.keys(lang)[0] === filterLang;
                                   return false;
                                 })
                               );
      
      return matchesSearch && matchesStatus && matchesWorkplace && matchesEmployment && matchesLocation && matchesSalary && matchesSkills && matchesExperience && matchesLanguages;
    });
  }, [jobs, searchTerm, filterStatus, filterWorkplace, filterEmployment, filterLocation, filterSalary, filterSkills, filterExperience, filterLanguages]);

  const currentJobIndex = useMemo(() => {
    if (!selectedJob) return -1;
    return filteredJobs.findIndex(j => j.job_id === selectedJob.job_id);
  }, [selectedJob, filteredJobs]);

  const handlePrevJob = () => {
    if (currentJobIndex > 0) setSelectedJob(filteredJobs[currentJobIndex - 1]);
  };

  const handleNextJob = () => {
    if (currentJobIndex < filteredJobs.length - 1) setSelectedJob(filteredJobs[currentJobIndex + 1]);
  };

  const totalPages = Math.ceil(filteredJobs.length / ITEMS_PER_PAGE);

  // --- TECLADO DE NAVEGACIÓN ---
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (view === 'detail') {
        if (e.key === 'ArrowLeft') {
          if (currentJobIndex > 0) setSelectedJob(filteredJobs[currentJobIndex - 1]);
        } else if (e.key === 'ArrowRight') {
          if (currentJobIndex < filteredJobs.length - 1) setSelectedJob(filteredJobs[currentJobIndex + 1]);
        }
      } else if (view === 'list') {
        if (e.key === 'ArrowLeft') {
          setCurrentPage(p => Math.max(1, p - 1));
        } else if (e.key === 'ArrowRight') {
          setCurrentPage(p => Math.min(totalPages, p + 1));
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [view, currentJobIndex, filteredJobs, totalPages]);

  // --- PAGINACIÓN LÓGICA ---
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterStatus, filterWorkplace, filterEmployment, filterLocation, filterSalary, filterSkills, filterExperience, filterLanguages]);

  useEffect(() => {
    if (listRef.current) {
      // Usamos setTimeout para asegurar que el DOM se ha actualizado
      // y eliminamos 'smooth' para evitar conflictos si el usuario está interactuando
      setTimeout(() => {
        if (listRef.current) listRef.current.scrollTop = 0;
      }, 0);
    }
  }, [currentPage]);

  const paginatedJobs = filteredJobs.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  // --- COMPONENTE: TARJETA DE TRABAJO ---
  const JobCard = ({ job }) => {
    const isClosed = job.status === 'Closed';
    const isOpen = job.status === 'Open';

    return (
    <div 
      onClick={() => { setSelectedJob(job); setView('detail'); }}
      className={`group relative p-5 border-b border-gray-200 transition-colors cursor-pointer ${
        isClosed ? 'bg-gray-50' : 'bg-white active:bg-gray-50'
      }`}
    >
      <div className="flex justify-between items-start mb-2">
        <h3 className={`text-lg font-bold leading-tight pr-8 ${isClosed ? 'line-through text-gray-400 opacity-60' : 'text-black'}`}>
          {job.title}
        </h3>
        <div 
          className={`w-3 h-3 rounded-full mt-1.5 flex-shrink-0 border border-black/5 shadow-sm ${
            isOpen ? 'bg-green-500' : 'bg-red-500'
          }`}
        />
      </div>
      
      <div className={isClosed ? 'opacity-50 grayscale' : ''}>
        <div className="flex items-center text-sm text-gray-600 mb-3 space-x-3">
          <span className="font-medium text-black">{job.company}</span>
          <span className="text-gray-300">•</span>
          <span className="flex items-center gap-1">
            <Globe size={12} />
            <span>{job.origin}</span>
          </span>
        </div>

        <div className="flex flex-wrap gap-1 mb-3">
          {job.required_skills?.slice(0, 3).map(skill => (
            <span key={skill} className="text-[10px] px-2 py-1 bg-gray-100 text-gray-600 rounded-full font-medium">
              {skill}
            </span>
          ))}
          {(job.required_skills?.length || 0) > 3 && <span className="text-[10px] text-gray-400 py-1">+ {job.required_skills.length - 3}</span>}
        </div>

        <div className="flex justify-between items-center text-xs text-gray-500 font-mono">
          <span className="flex items-center gap-1" title={job.location}>
            <MapPin size={10} />
            {(job.location || '').length > 42 ? (job.location || '').substring(0, 42) + '...' : job.location}
          </span>
          <span className="flex items-center gap-1">
            <Calendar size={10} />
            {formatDate(job.posted_on)}
          </span>
        </div>
      </div>
    </div>
  );
  };

  // --- PANTALLA DE CARGA / ERROR ---
  if (loadingSession) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white text-black">
      <Loader2 className="animate-spin mb-4" size={32} />
      <p className="font-mono text-sm">Cargando sesión...</p>
    </div>
  );

  if (!session) {
    return <Login supabase={supabase} />;
  }

  if (loading) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white text-black">
      <Loader2 className="animate-spin mb-4" size={32} />
      <p className="font-mono text-sm">Cargando ofertas</p>
    </div>
  );

  if (error) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white text-red-600 p-6 text-center">
      <AlertCircle size={48} className="mb-4" />
      <p className="font-bold mb-2">Error de Conexión</p>
      <p className="text-sm text-gray-600">{error}</p>
      <p className="text-xs text-gray-400 mt-4">Verifica tus credenciales en el código (SUPABASE_URL y KEY)</p>
    </div>
  );

  // --- VISTA FILTROS ---
  if (view === 'filters') {
    const salaryPercentage = (filterSalary / 60000) * 100;

    return (
      <div className="min-h-screen bg-white text-black flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-300 font-sans">
        
        <style>{`
          .range-slider-thumb::-webkit-slider-thumb {
            pointer-events: auto;
            appearance: none;
            height: 16px;
            width: 16px;
            border-radius: 50%;
            background: #e5e7eb;
            border: 2px solid #9ca3af;
            box-shadow: 0 1px 2px rgba(0,0,0,0.1);
            cursor: pointer;
            margin-top: -4px;
            position: relative;
            z-index: 10;
          }
          .range-slider-thumb::-moz-range-thumb {
            pointer-events: auto;
            height: 16px;
            width: 16px;
            border-radius: 50%;
            background: #e5e7eb;
            border: 2px solid #9ca3af;
            cursor: pointer;
          }
        `}</style>

        <div className="p-6 pb-4 border-b border-gray-100 flex justify-between items-center sticky top-0 bg-white z-10">
          <h2 className="text-2xl font-bold tracking-tight">filtros</h2>
          <button onClick={() => setView('list')} className="p-2 border border-gray-200 rounded-full hover:bg-gray-50">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-8 flex-1 overflow-y-auto pb-24">
          
          {/* 1. ESTADO */}
          <div>
            <label className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3 block">estado</label>
            <div className="flex flex-wrap gap-2">
              {['Open', 'Closed'].map(status => (
                <button
                  key={status}
                  onClick={() => setFilterStatus(filterStatus === status ? 'all' : status)}
                  className={`px-3 py-2 rounded-full text-sm font-medium border transition-all ${
                    filterStatus === status 
                      ? 'border-black bg-white text-black ring-1 ring-black' 
                      : 'border-gray-200 text-gray-500 hover:border-gray-400'
                  }`}
                >
                  {status === 'Open' ? 'Abiertas' : 'Cerradas'}
                </button>
              ))}
            </div>
          </div>

          {/* 2. TIPO */}
          <div>
            <label className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3 block">tipo</label>
            <div className="flex flex-wrap gap-2">
              {[
                { value: 'On-site', label: 'Presencial' },
                { value: 'Hybrid', label: 'Híbrido' },
                { value: 'Remote', label: 'Remoto' }
              ].map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => toggleSelection(value, filterWorkplace, setFilterWorkplace)}
                  className={`px-3 py-2 rounded-full text-sm font-medium border transition-all ${
                    filterWorkplace.includes(value)
                      ? 'border-black bg-white text-black ring-1 ring-black' 
                      : 'border-gray-200 text-gray-500 hover:border-gray-400'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* 3. CONTRATO */}
          <div>
            <label className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3 block">contrato</label>
            <div className="flex flex-wrap gap-2">
              {[
                { value: 'Full-time', label: 'Tiempo completo' },
                { value: 'Part-time', label: 'Tiempo parcial' },
                { value: 'Contract', label: 'Temporal' },
                { value: 'Internship', label: 'Prácticas' }
              ].map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => toggleSelection(value, filterEmployment, setFilterEmployment)}
                  className={`px-3 py-2 rounded-full text-sm font-medium border transition-all ${
                    filterEmployment.includes(value)
                      ? 'border-black bg-white text-black ring-1 ring-black' 
                      : 'border-gray-200 text-gray-500 hover:border-gray-400'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* 4. LOCALIZACIÓN */}
          <div>
            <label className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3 block">localización</label>
            <div className="relative">
              <MapPin className="absolute left-3 top-3 text-gray-400" size={16} />
              <input 
                type="text" 
                placeholder="Ej. Madrid, Barcelona..." 
                value={filterLocation}
                onChange={(e) => setFilterLocation(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-lg py-2.5 pl-10 pr-4 text-sm focus:border-black focus:ring-0 outline-none transition-colors font-sans"
              />
            </div>
          </div>

          {/* 5. SALARIO */}
          <div>
            <div className="flex justify-between items-center mb-3">
              <label className="text-xs font-bold uppercase tracking-widest text-gray-400 block">salario mínimo</label>
              <span className="text-xs font-bold font-mono">
                {filterSalary > 0 ? `${(filterSalary/1000)}k €` : 'Cualquiera'}
              </span>
            </div>
            <input 
              type="range" 
              min="0" 
              max="60000" 
              step="1000" 
              value={filterSalary}
              onChange={(e) => setFilterSalary(Number(e.target.value))}
              style={{ 
                background: `linear-gradient(to right, #e5e7eb ${salaryPercentage}%, #9ca3af ${salaryPercentage}%)` 
              }} 
              className="range-slider-thumb w-full h-2 rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-1 font-mono">
              <span>0€</span>
              <span>60k€+</span>
            </div>
          </div>

          {/* 6. HABILIDADES */}
          <div>
            <label className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3 flex items-center justify-between">
              <span>habilidades</span>
              {filterSkills.length > 0 && <span className="text-black text-[10px] font-mono">{filterSkills.length} sel</span>}
            </label>
            <div className="flex flex-wrap gap-2">
              {allSkills.map(skill => (
                <button
                  key={skill}
                  onClick={() => toggleSelection(skill, filterSkills, setFilterSkills)}
                  className={`text-sm px-3 py-1.5 rounded-full border transition-all ${
                    filterSkills.includes(skill)
                      ? 'bg-black text-white border-black'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                  }`}
                >
                  {skill}
                </button>
              ))}
            </div>
          </div>

          {/* 7. EXPERIENCIA */}
          <div>
            <div className="flex justify-between items-center mb-3">
              <label className="text-xs font-bold uppercase tracking-widest text-gray-400 block">experiencia</label>
              <span className="text-xs font-bold font-mono">
                {filterExperience[0] === 0 && filterExperience[1] === 30 ? 'Cualquiera' : `${filterExperience[0]} - ${filterExperience[1]}`}
              </span>
            </div>
            
            <div className="relative h-8 w-full flex items-center">
                <div className="absolute w-full h-2 bg-gray-200 rounded-lg"></div>
                <div 
                    className="absolute h-2 bg-gray-400 rounded-lg"
                    style={{
                        left: `${(filterExperience[0] / 30) * 100}%`,
                        right: `${100 - (filterExperience[1] / 30) * 100}%`
                    }}
                ></div>

                <input 
                  type="range" 
                  min="0" 
                  max="30" 
                  step="1" 
                  value={filterExperience[0]}
                  onChange={(e) => handleExperienceChange(e, 0)}
                  className="range-slider-thumb absolute w-full h-2 appearance-none bg-transparent pointer-events-none z-20"
                />

                <input 
                  type="range" 
                  min="0" 
                  max="30" 
                  step="1" 
                  value={filterExperience[1]}
                  onChange={(e) => handleExperienceChange(e, 1)}
                  className="range-slider-thumb absolute w-full h-2 appearance-none bg-transparent pointer-events-none z-20"
                />
            </div>
            
            <div className="flex justify-between text-xs text-gray-400 font-mono -mt-1">
              <span>0</span>
              <span>30</span>
            </div>
          </div>

          {/* 8. IDIOMAS */}
          <div>
            <label className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3 flex items-center justify-between">
              <span>idiomas</span>
              {filterLanguages.length > 0 && <span className="text-black text-[10px] font-mono">{filterLanguages.length} sel</span>}
            </label>
            <div className="flex flex-wrap gap-2">
              {LANGUAGES_LIST.map(lang => (
                <button
                  key={lang}
                  onClick={() => toggleSelection(lang, filterLanguages, setFilterLanguages)}
                  className={`text-sm px-3 py-1.5 rounded-full border transition-all ${
                    filterLanguages.includes(lang)
                      ? 'bg-black text-white border-black'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                  }`}
                >
                  {lang}
                </button>
              ))}
            </div>
          </div>

        </div>

        <div className="p-6 pt-2 border-t border-gray-100 bg-white safe-area-bottom fixed bottom-0 left-0 right-0 max-w-md mx-auto">
          <button 
            onClick={() => setView('list')}
            className="w-full bg-white text-black border-2 border-black py-4 rounded-xl font-bold text-sm tracking-wide uppercase hover:bg-gray-50 transition-colors"
          >
            Ver {filteredJobs.length} Resultados
          </button>
        </div>
      </div>
    );
  }

  // --- RESTO DE VISTAS (DETAIL) ---
  if (view === 'detail' && selectedJob) {
    return (
      <div className="min-h-screen bg-white flex flex-col animate-in slide-in-from-right duration-300 font-sans">
        <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-md border-b border-gray-200 p-4 flex justify-between items-center">
          <div className="flex items-center gap-1 -ml-2">
            <button 
              onClick={handlePrevJob} 
              disabled={currentJobIndex <= 0}
              className="p-2 hover:bg-gray-100 rounded-full disabled:opacity-30 disabled:hover:bg-transparent transition-all text-black"
            >
              <ChevronLeft size={24} />
            </button>
            <button 
              onClick={handleNextJob} 
              disabled={currentJobIndex === -1 || currentJobIndex >= filteredJobs.length - 1}
              className="p-2 hover:bg-gray-100 rounded-full disabled:opacity-30 disabled:hover:bg-transparent transition-all text-black"
            >
              <ChevronRight size={24} />
            </button>
          </div>

          <div className="flex gap-2">
            <button 
               onClick={() => deleteJob(selectedJob.job_id)}
               className="p-2 text-gray-400 hover:text-red-600 border border-transparent hover:border-red-100 hover:bg-red-50 rounded-full transition-all"
            >
              <Trash2 size={20} />
            </button>
            <button 
               onClick={() => setView('list')}
               className="p-2 text-gray-400 hover:text-black border border-transparent hover:bg-gray-100 rounded-full transition-all"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="flex-1 p-6 overflow-y-auto">
          <div className="mb-6">
            <div className="flex justify-between items-start mb-2">
               <h1 className="text-2xl font-bold leading-tight">{selectedJob.title}</h1>
            </div>
            <div className="flex flex-col gap-1 text-gray-500">
              <span className="text-lg text-black font-medium flex items-center gap-2">
                <Building2 size={18} className="text-gray-400"/>
                {selectedJob.company}
              </span>
              <span className="flex items-center gap-2 text-sm font-mono">
                <MapPin size={16} className="text-gray-400"/> {selectedJob.location}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-6 font-mono">
            <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
               <div className="flex items-center gap-2 mb-1 text-gray-400">
                  <Briefcase size={14}/>
                  <span className="text-[10px] font-bold uppercase tracking-wider">Tipo Empleo</span>
               </div>
               <span className="text-sm font-medium text-black block truncate">
                 {EMPLOYMENT_TRANSLATIONS[selectedJob.employment_type] || selectedJob.employment_type || "N/A"}
               </span>
            </div>
            
            <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
               <div className="flex items-center gap-2 mb-1 text-gray-400">
                  <Globe size={14}/>
                  <span className="text-[10px] font-bold uppercase tracking-wider">Modalidad</span>
               </div>
               <span className="text-sm font-medium text-black block truncate">
                 {WORKPLACE_TRANSLATIONS[selectedJob.workplace_type] || selectedJob.workplace_type || "N/A"}
               </span>
            </div>

            <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
               <div className="flex items-center gap-2 mb-1 text-gray-400">
                  <Banknote size={14}/>
                  <span className="text-[10px] font-bold uppercase tracking-wider">Salario</span>
               </div>
               <span className="text-sm font-medium text-black block truncate">
                 {selectedJob.salary_text || (selectedJob.salary_min && selectedJob.salary_max ? `${Number(selectedJob.salary_min).toLocaleString()} ${selectedJob.salary_currency || '€'} - ${Number(selectedJob.salary_max).toLocaleString()} ${selectedJob.salary_currency || '€'}` : (selectedJob.salary_min ? `Desde ${Number(selectedJob.salary_min).toLocaleString()} ${selectedJob.salary_currency || '€'}` : "N/A"))}
               </span>
            </div>

            <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
               <div className="flex items-center gap-2 mb-1 text-gray-400">
                  <Users size={14}/>
                  <span className="text-[10px] font-bold uppercase tracking-wider">Experiencia</span>
               </div>
               <span className="text-sm font-medium text-black block truncate">
                 {selectedJob.required_experience_years !== null && selectedJob.required_experience_years !== undefined ? `${selectedJob.required_experience_years} años` : "N/A"}
               </span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 mb-6">
             {selectedJob.required_skills?.map(skill => (
               <span key={skill} className="px-3 py-1 bg-white border border-gray-200 rounded-full text-xs font-medium text-gray-700">
                 {skill}
               </span>
             ))}
             {selectedJob.required_languages?.map((langItem, idx) => {
               let langName, langLevel;
               if (typeof langItem === 'string') {
                 langName = langItem;
                 langLevel = null;
               } else if (typeof langItem === 'object' && langItem !== null) {
                 langName = Object.keys(langItem)[0];
                 langLevel = langItem[langName];
               } else {
                 return null;
               }

               return (
                 <span key={idx} className="px-3 py-1 bg-black text-white border border-black rounded-full text-xs font-medium flex items-center gap-1 font-mono">
                   <Languages size={10} /> 
                   {langName} {langLevel && <span className="opacity-70 font-light text-[10px]">({langLevel})</span>}
                 </span>
               );
             })}
          </div>

          <div className="flex gap-4 mb-8 py-4 border-y border-gray-100">
            <div className="flex-1 border-r border-gray-100">
              <span className="block text-[10px] text-gray-400 uppercase tracking-wider mb-2">Fuente</span>
              <span className="flex items-center gap-2 font-medium text-sm">
                <Globe size={14}/>
                <span>{selectedJob.origin}</span>
              </span>
            </div>
            <div className="flex-1 border-r border-gray-100 pl-4">
              <span className="block text-[10px] text-gray-400 uppercase tracking-wider mb-2">Publicado</span>
              <span className="flex items-center gap-2 font-medium text-sm">
                <Calendar size={14}/>
                {formatDate(selectedJob.posted_on)}
              </span>
            </div>
            <div className="flex-1 pl-4">
              <span className="block text-[10px] text-gray-400 uppercase tracking-wider mb-2">Estado</span>
              <button
                onClick={() => toggleStatus(selectedJob.job_id, selectedJob.status)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide border transition-all ${
                  selectedJob.status === 'Open' 
                    ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100' 
                    : 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
                }`}
              >
                <div 
                  className={`w-3 h-3 rounded-full shadow-sm ${
                    selectedJob.status === 'Open' ? 'bg-green-500' : 'bg-red-500'
                  }`}
                />
                {selectedJob.status === 'Open' ? 'Abierta' : 'Cerrada'}
              </button>
            </div>
          </div>

          <div className="prose prose-sm prose-gray max-w-none pb-10">
            <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Descripción del puesto</h3>
            <p className="whitespace-pre-line text-gray-800 leading-relaxed font-light text-base">
              {selectedJob.description_text}
            </p>
          </div>
        </div>

        <div className="p-4 border-t border-gray-100 bg-white safe-area-bottom">
           <a 
            href={selectedJob.url} 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full bg-white text-black border-2 border-black py-4 rounded-xl font-bold text-sm uppercase tracking-wide hover:bg-gray-50 transition-colors"
          >
            Ver oferta original <ExternalLink size={16} />
          </a>
        </div>
      </div>
    );
  }

  // --- VISTA LISTADO PRINCIPAL ---
  const activeFiltersCount = 
    (filterStatus !== 'all' ? 1 : 0) + 
    filterWorkplace.length +
    filterEmployment.length +
    (filterLocation !== '' ? 1 : 0) + 
    (filterSalary > 0 ? 1 : 0) +
    filterSkills.length + 
    (filterExperience[0] > 0 || filterExperience[1] < 30 ? 1 : 0) +
    filterLanguages.length;

  return (
    <div className="h-screen bg-gray-50 text-black max-w-md mx-auto shadow-2xl overflow-hidden flex flex-col border-x border-gray-200 font-sans">
      
      <style>{`
        ::-webkit-scrollbar {
          display: none;
        }
        * {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>

      {/* Header */}
      <header className="bg-white border-b border-gray-200 p-4 sticky top-0 z-10">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-xl font-mono font-bold tracking-tighter text-black flex items-center">
            <img src="/icon-dark.svg" className="h-5 w-auto mr-2" alt="Logo" />job-alerts<span className="animate-pulse">_</span>
          </h1>
          
          <div className="flex items-center gap-2">
            <button 
              onClick={() => supabase.auth.signOut()}
              className="p-2.5 rounded-full bg-white text-black border border-gray-200 hover:border-red-500 hover:text-red-500 transition-all duration-300"
              title="Cerrar sesión"
            >
              <LogOut size={18} />
            </button>

            <button 
              onClick={() => setView('filters')}
              className={`relative p-2.5 rounded-full transition-all duration-300 ${
                activeFiltersCount > 0 
                  ? 'bg-black text-white shadow-lg shadow-gray-300' 
                  : 'bg-white text-black border border-gray-200 hover:border-black'
              }`}
            >
              <Filter size={18} />
              {activeFiltersCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] flex items-center justify-center rounded-full font-bold border-2 border-white">
                  {activeFiltersCount}
                </span>
              )}
            </button>
          </div>
        </div>
        
        <div className="relative group">
          <Search className="absolute left-3 top-2.5 text-gray-400 group-focus-within:text-black transition-colors" size={16} />
          <input 
            type="text" 
            placeholder="Buscar..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2 pl-9 pr-4 text-sm font-medium focus:border-black focus:bg-white focus:ring-0 transition-all outline-none placeholder:text-gray-400"
          />
        </div>
      </header>

      {/* Stats Bar */}
      <div className="px-5 py-2 bg-white border-b border-gray-100 flex justify-between items-center">
        <span className="font-bold text-[10px] text-gray-400 uppercase tracking-wider">
          {filteredJobs.length} Resultados
        </span>
        
        {activeFiltersCount > 0 && (
           <div className="flex gap-2 overflow-x-auto max-w-[60%] no-scrollbar justify-end">
             {filterLocation && <span className="px-2 py-0.5 bg-gray-100 rounded text-[10px] text-gray-600 whitespace-nowrap">{filterLocation}</span>}
             {filterSalary > 0 && <span className="px-2 py-0.5 bg-gray-100 rounded text-[10px] text-gray-600 whitespace-nowrap">+{filterSalary/1000}k€</span>}
           </div>
        )}
      </div>

      {/* List */}
      <div ref={listRef} className="flex-1 overflow-y-auto bg-gray-50">
        {paginatedJobs.length > 0 ? (
          <>
            {paginatedJobs.map(job => (
              <JobCard key={job.job_id} job={job} />
            ))}
            
            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="p-4 flex justify-center items-center gap-4 bg-white border-t border-gray-200">
                <button 
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-2 rounded-full hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent transition-all"
                >
                  <ChevronLeft size={20} />
                </button>
                <span className="text-xs font-mono font-medium text-gray-500">
                  Página {currentPage} de {totalPages}
                </span>
                <button 
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="p-2 rounded-full hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent transition-all"
                >
                  <ChevronRight size={20} />
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-64 text-gray-400 px-10 text-center">
            <Briefcase size={48} className="mb-4 opacity-10" />
            <p className="text-sm font-medium text-gray-500">No se encontraron ofertas.</p>
            <button onClick={() => {
              setSearchTerm('');
              setFilterStatus('all');
              setFilterWorkplace([]);
              setFilterEmployment([]);
              setFilterLocation('');
              setFilterSalary(0);
              setFilterSkills([]);
              setFilterExperience([0, 30]);
              setFilterLanguages([]);
            }} className="mt-4 text-xs font-bold uppercase tracking-wider text-black underline">
              Limpiar filtros
            </button>
          </div>
        )}
      </div>
    </div>
  );
}