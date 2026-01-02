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
  AlertCircle,
  Bell,
  BellRing
} from 'lucide-react';

import Login from './Login';
import { useJobAlerts } from './hooks/useJobAlerts';
import { useReadJobs } from './hooks/useReadJobs';
import { useDebounce } from './hooks/useDebounce';

// --- CONFIGURACIÓN DE SUPABASE ---
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const getUniqueValues = (data, key) => {
  const allValues = data.flatMap(item => item[key] || []);
  return [...new Set(allValues)].sort();
};

const LANGUAGES_LIST = ["Inglés", "Español", "Catalán", "Francés", "Italiano", "Alemán"];

const LANGUAGE_MAP = {
  "Inglés": "English",
  "Español": "Spanish",
  "Catalán": "Catalan",
  "Francés": "French",
  "Italiano": "Italian",
  "Alemán": "German"
};

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

  // --- ALERTAS ---
  const { alerts, addAlert, removeAlert, enablePushNotifications, isPushEnabled } = useJobAlerts(supabase, session);
  
  // --- LEÍDOS ---
  const { isRead, markAsRead } = useReadJobs();

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
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const listRef = useRef(null);

  const [view, setView] = useState('list');
  const [selectedJob, setSelectedJob] = useState(null);
  
  // --- ESTADOS DE FILTROS ---
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearchTerm = useDebounce(searchTerm, 1000);

  const [filterStatus, setFilterStatus] = useState('all');
  const [filterWorkplace, setFilterWorkplace] = useState([]); 
  const [filterEmployment, setFilterEmployment] = useState([]);
  const [filterLocation, setFilterLocation] = useState("");
  const debouncedFilterLocation = useDebounce(filterLocation, 1000);

  const [filterSalary, setFilterSalary] = useState(0);
  const debouncedFilterSalary = useDebounce(filterSalary, 1000);

  const [filterSkills, setFilterSkills] = useState([]);
  const [filterExperience, setFilterExperience] = useState([0, 30]);
  const debouncedFilterExperience = useDebounce(filterExperience, 1000);

  const [filterLanguages, setFilterLanguages] = useState([]);
  
  // Estado para la lista completa de skills (para los filtros)
  const [allAvailableSkills, setAllAvailableSkills] = useState([]);

  // --- PAGINACIÓN ---
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 25;

  // --- CARGA INICIAL DE SKILLS ---
  useEffect(() => {
    async function loadAllSkills() {
      // Descargamos solo la columna de skills de todas las ofertas para poblar el filtro
      // Esto es mucho más ligero que descargar toda la tabla con descripciones
      const { data, error } = await supabase
        .from('jobs')
        .select('required_skills')
        .range(0, 9999); // Traemos un número alto para cubrir todas

      if (!error && data) {
        const uniqueSkills = getUniqueValues(data, 'required_skills');
        setAllAvailableSkills(uniqueSkills);
      }
    }
    
    loadAllSkills();
  }, []);

  // --- EFECTO PARA CARGAR DATOS DE SUPABASE (BACKEND FILTERING) ---
  useEffect(() => {
    if (!session) return;

    async function fetchJobs() {
      setLoading(true);
      setError(null);

      try {
        let query = supabase
          .from('jobs')
          .select('*', { count: 'exact' });

        // 1. Búsqueda (Search Term)
        if (debouncedSearchTerm) {
          query = query.or(`title.ilike.%${debouncedSearchTerm}%,company.ilike.%${debouncedSearchTerm}%`);
        }

        // 2. Estado
        if (filterStatus !== 'all') {
          query = query.eq('status', filterStatus);
        }

        // 3. Workplace (Array -> IN)
        if (filterWorkplace.length > 0) {
          // Match si está en la lista O si es NULL
          const values = filterWorkplace.map(v => `"${v}"`).join(',');
          query = query.or(`workplace_type.in.(${values}),workplace_type.is.null`);
        }

        // 4. Employment (Array -> IN)
        if (filterEmployment.length > 0) {
          // Match si está en la lista O si es NULL
          const values = filterEmployment.map(v => `"${v}"`).join(',');
          query = query.or(`employment_type.in.(${values}),employment_type.is.null`);
        }

        // 5. Location
        if (debouncedFilterLocation) {
          // Usamos ilike con comodines para búsqueda parcial insensible a mayúsculas
          query = query.ilike('location', `%${debouncedFilterLocation}%`);
        }

        // 6. Salario
        if (debouncedFilterSalary > 0) {
          // Match si cumple el rango O si no tiene salario especificado (NULL)
          query = query.or(`salary_min.gte.${debouncedFilterSalary},salary_max.gte.${debouncedFilterSalary},salary_min.is.null`);
        }

        // 7. Skills (Array contains) - Lógica OR
        if (filterSkills.length > 0) {
          // Queremos que la oferta tenga AL MENOS UNA de las skills seleccionadas (OR)
          // Sintaxis Supabase: .or('col.cs.{"A"},col.cs.{"B"}')
          const orConditions = filterSkills.map(skill => 
             `required_skills.cs.${JSON.stringify([skill])}`
          ).join(',');
          
          query = query.or(orConditions);
        }

        // 8. Experiencia
        // Solo aplicamos filtro si el rango es diferente al por defecto [0, 30]
        if (debouncedFilterExperience[0] > 0) {
           // Match si es mayor al mínimo O si es NULL (no especificado)
           query = query.or(`required_experience_years.gte.${debouncedFilterExperience[0]},required_experience_years.is.null`);
        }
        if (debouncedFilterExperience[1] < 30) {
           // Match si es menor al máximo O si es NULL (no especificado)
           query = query.or(`required_experience_years.lte.${debouncedFilterExperience[1]},required_experience_years.is.null`);
        }

        // 9. Idiomas (Backend con JSON arrow operators)
        if (filterLanguages.length > 0) {
          const conditions = filterLanguages.map(lang => {
             const dbLang = LANGUAGE_MAP[lang] || lang;
             // Usamos el operador -> para acceder a la clave del JSON.
             return `required_languages->${dbLang}.not.is.null`;
          });

          // Incluimos ofertas con JSON vacío {} (sin requisitos de idioma) O si es NULL
          conditions.push('required_languages.eq.{}');
          conditions.push('required_languages.is.null');

          query = query.or(conditions.join(','));
        }

        // Paginación
        const from = (currentPage - 1) * ITEMS_PER_PAGE;
        const to = from + ITEMS_PER_PAGE - 1;
        
        query = query
          .order('posted_on', { ascending: false, nullsFirst: false })
          .range(from, to);

        const { data, error, count } = await query;

        if (error) throw error;

        // Procesamos los datos para asegurar que skills y languages sean Arrays.
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
        setTotalCount(count);
      } catch (err) {
        console.error("Error fetching jobs:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchJobs();
  }, [
    session,
    currentPage, 
    debouncedSearchTerm, 
    filterStatus, 
    filterWorkplace, 
    filterEmployment, 
    debouncedFilterLocation, 
    debouncedFilterSalary, 
    filterSkills, 
    debouncedFilterExperience,
    filterLanguages
  ]);



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

  const currentJobIndex = useMemo(() => {
    if (!selectedJob) return -1;
    return jobs.findIndex(j => j.job_id === selectedJob.job_id);
  }, [selectedJob, jobs]);

  const loadAlertFilters = (filters) => {
    setSearchTerm(filters.searchTerm || "");
    setFilterStatus(filters.filterStatus || 'all');
    setFilterWorkplace(filters.filterWorkplace || []);
    setFilterEmployment(filters.filterEmployment || []);
    setFilterLocation(filters.filterLocation || "");
    setFilterSalary(filters.filterSalary || 0);
    setFilterSkills(filters.filterSkills || []);
    setFilterExperience(filters.filterExperience || [0, 30]);
    setFilterLanguages(filters.filterLanguages || []);
    // Feedback visual opcional o simplemente cerrar filtros si se desea
    // setView('list'); // Descomentar si se quiere ir directo a la lista
  };

  const handlePrevJob = () => {
    if (currentJobIndex > 0) setSelectedJob(jobs[currentJobIndex - 1]);
  };

  const handleNextJob = () => {
    if (currentJobIndex < jobs.length - 1) setSelectedJob(jobs[currentJobIndex + 1]);
  };

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  // --- TECLADO DE NAVEGACIÓN ---
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (view === 'detail') {
        if (e.key === 'ArrowLeft') {
          if (currentJobIndex > 0) setSelectedJob(jobs[currentJobIndex - 1]);
        } else if (e.key === 'ArrowRight') {
          if (currentJobIndex < jobs.length - 1) setSelectedJob(jobs[currentJobIndex + 1]);
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
  }, [view, currentJobIndex, jobs, totalPages]);

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

  const paginatedJobs = jobs;

  // --- COMPONENTE: TARJETA DE TRABAJO ---
  const JobCard = ({ job }) => {
    const isClosed = job.status === 'Closed';
    const isOpen = job.status === 'Open';
    const read = isRead(job.job_id);

    return (
    <div 
      onClick={() => { 
        markAsRead(job.job_id);
        setSelectedJob(job); 
        setView('detail'); 
      }}
      className={`group relative p-5 border-b border-gray-200 transition-colors cursor-pointer ${
        isClosed ? 'bg-gray-50' : 'bg-white active:bg-gray-50'
      }`}
    >
      <div className="flex justify-between items-start mb-2">
        <h3 className={`text-lg font-bold leading-tight pr-8 ${isClosed ? 'text-black opacity-50 grayscale' : 'text-black'}`}>
          {job.title}
        </h3>
        
        <div className="relative mt-1.5 flex-shrink-0">
          {!read && !isClosed && (
            <div className="w-2.5 h-2.5 bg-blue-600 rounded-full shadow-sm" title="Nueva oferta" />
          )}
        </div>
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

        <div 
          className="p-6 pb-4 border-b border-gray-100 flex justify-between items-center sticky top-0 bg-white z-10"
          style={{ paddingTop: 'max(1.5rem, calc(env(safe-area-inset-top) + 1.5rem))' }}
        >
          <h2 className="text-2xl font-bold tracking-tight">filtros</h2>
          <button onClick={() => setView('list')} className="p-2 border border-gray-200 rounded-full hover:bg-gray-50">
            <X size={20} />
          </button>
        </div>

        {/* --- SECCIÓN DE ALERTAS --- */}
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-100">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-sm font-bold uppercase tracking-widest text-gray-500 flex items-center gap-2">
              <Bell size={14} /> Alertas Activas
            </h3>
            <div className="flex gap-2">
              {/* Botón para forzar activación de Push */}
              <button 
                onClick={() => enablePushNotifications()}
                className="text-xs bg-gray-200 text-gray-700 px-3 py-2 rounded-full font-medium hover:bg-gray-300 transition-colors"
                title="Activar notificaciones Push en este dispositivo"
              >
                {isPushEnabled ? '🔔 Push Activo' : '🔕 Activar Push'}
              </button>

              <button 
                onClick={() => addAlert({
                  searchTerm,
                  filterStatus,
                  filterWorkplace,
                  filterEmployment,
                  filterLocation,
                  filterSalary,
                  filterSkills,
                  filterExperience,
                  filterLanguages
                })}
                className="text-sm bg-black text-white px-4 py-2 rounded-full font-medium hover:bg-gray-800 transition-colors flex items-center gap-2"
              >
                <BellRing size={14} />
                Crear Alerta
              </button>
            </div>
          </div>
          
          {alerts.length === 0 ? (
            <p className="text-xs text-gray-400 italic">No tienes alertas activas.</p>
          ) : (
            <div className="space-y-2">
              {alerts.map(alert => (
                <div 
                  key={alert.id} 
                  onClick={() => loadAlertFilters(alert.filters)}
                  className="bg-white p-3 rounded-lg border border-gray-200 flex justify-between items-center shadow-sm cursor-pointer hover:border-black hover:shadow-md transition-all group"
                  title="Haz clic para cargar estos filtros"
                >
                  <div className="text-xs text-gray-600">
                    <span className="font-bold block mb-1 text-gray-800 group-hover:text-black">
                      Alerta del {new Date(alert.createdAt).toLocaleDateString()}
                    </span>
                    <span className="line-clamp-1">
                      {alert.filters.searchTerm ? `"${alert.filters.searchTerm}"` : 'Cualquier texto'} • {alert.filters.filterLocation || 'Cualquier lugar'}
                    </span>
                  </div>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      removeAlert(alert.id);
                    }} 
                    className="text-gray-400 hover:text-red-600 p-1.5 hover:bg-red-50 rounded-full transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-6 space-y-8 flex-1 overflow-y-auto pb-24">
          
          {/* 1. ESTADO */}
          <div>
            <label className="text-xs font-bold uppercase tracking-widest text-black mb-3 block">estado</label>
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
            <label className="text-xs font-bold uppercase tracking-widest text-black mb-3 block">tipo</label>
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
            <label className="text-xs font-bold uppercase tracking-widest text-black mb-3 block">contrato</label>
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
            <label className="text-xs font-bold uppercase tracking-widest text-black mb-3 block">localización</label>
            <div className="relative">
              <MapPin className="absolute left-3 top-3 text-gray-400" size={16} />
              <input 
                type="text" 
                placeholder="Ej. Madrid, Barcelona..." 
                value={filterLocation}
                onChange={(e) => setFilterLocation(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-lg py-2.5 pl-10 pr-4 text-base focus:border-black focus:ring-0 outline-none transition-colors font-sans"
              />
            </div>
          </div>

          {/* 5. SALARIO */}
          <div>
            <div className="flex justify-between items-center mb-3">
              <label className="text-xs font-bold uppercase tracking-widest text-black block">salario mínimo</label>
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
            <label className="text-xs font-bold uppercase tracking-widest text-black mb-3 flex items-center justify-between">
              <span>habilidades</span>
              {filterSkills.length > 0 && <span className="text-black text-[10px] font-mono">{filterSkills.length} sel</span>}
            </label>
            <div className="flex flex-wrap gap-2">
              {allAvailableSkills.map(skill => (
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
              <label className="text-xs font-bold uppercase tracking-widest text-black block">experiencia</label>
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
            <label className="text-xs font-bold uppercase tracking-widest text-black mb-3 flex items-center justify-between">
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
            Ver {totalCount} Resultados
          </button>
        </div>
      </div>
    );
  }

  // --- RESTO DE VISTAS (DETAIL) ---
  if (view === 'detail' && selectedJob) {
    return (
      <div className="min-h-screen bg-white flex flex-col animate-in slide-in-from-right duration-300 font-sans">
        <div 
          className="sticky top-0 z-10 bg-white/95 backdrop-blur-md border-b border-gray-200 p-4 flex justify-between items-center"
          style={{ paddingTop: 'max(1rem, calc(env(safe-area-inset-top) + 1rem))' }}
        >
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
              disabled={currentJobIndex === -1 || currentJobIndex >= jobs.length - 1}
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
             {Array.isArray(selectedJob.required_skills) && selectedJob.required_skills.map(skill => (
               <span key={skill} className="px-3 py-1 bg-white border border-gray-200 rounded-full text-xs font-medium text-gray-700">
                 {skill}
               </span>
             ))}
             {Array.isArray(selectedJob.required_languages) && selectedJob.required_languages.map((langItem, idx) => {
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
                {selectedJob.status === 'Open' ? 'Abierta' : 'Cerrada'}
              </button>
            </div>
          </div>

          <div className="prose prose-sm prose-gray max-w-none pb-10">
            <h3 className="text-xs font-bold uppercase tracking-widest text-black mb-3">Descripción del puesto</h3>
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
      <header 
        className="bg-white border-b border-gray-200 p-4 sticky top-0 z-10"
        style={{ paddingTop: 'max(1rem, calc(env(safe-area-inset-top) + 1rem))' }}
      >
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-xl font-mono font-bold tracking-tighter text-black flex items-center">
            <img src="/icon-dark.png" className="h-5 w-auto mr-2" alt="Logo" />job-alerts<span className="animate-pulse">_</span>
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
            className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2 pl-9 pr-4 text-base font-medium focus:border-black focus:bg-white focus:ring-0 transition-all outline-none placeholder:text-gray-400"
          />
        </div>
      </header>

      {/* Stats Bar */}
      <div className="px-5 py-2 bg-white border-b border-gray-100 flex justify-between items-center">
        <span className="font-bold text-[10px] text-gray-400 uppercase tracking-wider">
          {totalCount} Resultados
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