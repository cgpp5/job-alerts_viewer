import { useEffect, useState } from 'react';

export function useJobAlerts(supabase) {
  const [alerts, setAlerts] = useState([]);

  // Cargar alertas guardadas al iniciar
  useEffect(() => {
    const saved = localStorage.getItem('job_alerts');
    if (saved) {
      try {
        setAlerts(JSON.parse(saved));
      } catch (e) {
        console.error("Error parsing alerts", e);
      }
    }
  }, []);

  // Guardar alertas cuando cambian
  useEffect(() => {
    localStorage.setItem('job_alerts', JSON.stringify(alerts));
  }, [alerts]);

  const addAlert = (filters) => {
    if (!("Notification" in window)) {
      alert("Este navegador no soporta notificaciones de escritorio");
      return;
    }

    if (Notification.permission !== 'granted') {
      Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
          saveAlert(filters);
        }
      });
    } else {
      saveAlert(filters);
    }
  };

  const saveAlert = (filters) => {
    const newAlert = {
      id: Date.now(),
      createdAt: new Date().toISOString(),
      filters
    };
    setAlerts(prev => [...prev, newAlert]);
    alert('✅ Alerta creada. Recibirás una notificación cuando llegue una oferta que coincida.');
  };

  const removeAlert = (id) => {
    setAlerts(prev => prev.filter(a => a.id !== id));
  };

  // Lógica de coincidencia (replicada de App.jsx)
  const matchesFilters = (job, filters) => {
    const {
      searchTerm,
      filterStatus,
      filterWorkplace,
      filterEmployment,
      filterLocation,
      filterSalary,
      filterSkills,
      filterExperience,
      filterLanguages
    } = filters;

    const matchesSearch = (job.title || '').toLowerCase().includes((searchTerm || '').toLowerCase()) || 
                          (job.company || '').toLowerCase().includes((searchTerm || '').toLowerCase());
    
    const matchesStatus = filterStatus === 'all' || job.status === filterStatus;
    
    const matchesWorkplace = (filterWorkplace || []).length === 0 || 
                             (filterWorkplace || []).includes(job.workplace_type);

    const matchesEmployment = (filterEmployment || []).length === 0 || 
                              (filterEmployment || []).some(type => (job.employment_type || '').includes(type));

    const matchesLocation = (filterLocation || "") === "" || 
                            (job.location || '').toLowerCase().includes((filterLocation || "").toLowerCase());
    
    const matchesSalary = (job.salary_max || job.salary_min || 0) >= (filterSalary || 0);

    const matchesSkills = (filterSkills || []).length === 0 || 
                          (filterSkills || []).every(skill => (job.required_skills || []).includes(skill));

    const exp = job.required_experience_years || 0;
    const matchesExperience = exp >= (filterExperience?.[0] || 0) && exp <= (filterExperience?.[1] || 100);

    const matchesLanguages = (filterLanguages || []).length === 0 || 
                             (filterLanguages || []).every(filterLang => 
                               (job.required_languages || []).some(lang => {
                                 if (typeof lang === 'string') return lang === filterLang;
                                 if (typeof lang === 'object' && lang !== null) return Object.keys(lang)[0] === filterLang;
                                 return false;
                               })
                             );
    
    return matchesSearch && matchesStatus && matchesWorkplace && matchesEmployment && matchesLocation && matchesSalary && matchesSkills && matchesExperience && matchesLanguages;
  };

  // Suscripción a Realtime
  useEffect(() => {
    if (alerts.length === 0) return;

    const channel = supabase
      .channel('jobs-alerts')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'jobs' }, (payload) => {
        const newJob = payload.new;
        
        alerts.forEach(alert => {
          if (matchesFilters(newJob, alert.filters)) {
            new Notification(`🔔 Nueva oferta: ${newJob.title}`, {
              body: `${newJob.company} - ${newJob.location}\nHaz clic para ver más.`,
              icon: '/icon-dark.png',
              tag: newJob.job_id // Evita duplicados
            });
          }
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [alerts, supabase]);

  return { alerts, addAlert, removeAlert };
}
