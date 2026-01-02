import { useEffect, useState } from 'react';

// Helper para convertir la clave VAPID
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// ¡IMPORTANTE! Debes generar tus propias claves VAPID.
// Puedes hacerlo en https://web-push-codelab.glitch.me/ o usando web-push en node.
const VAPID_PUBLIC_KEY = 'BPTfpD9gH1O5yAHkPV6KEsO5mrhGONsF0Oh1VNmfiT3QAjDPlAtihCX94YX4Uyn4k-ps4RBO14h9gl9yrqo3lRA'; 

export function useJobAlerts(supabase, session) {
  const [alerts, setAlerts] = useState([]);
  const [isPushEnabled, setIsPushEnabled] = useState(false);

  // 1. Cargar alertas (LocalStorage + Supabase)
  useEffect(() => {
    // Cargar de LocalStorage primero (para inmediatez)
    const saved = localStorage.getItem('job_alerts');
    if (saved) {
      try {
        setAlerts(JSON.parse(saved));
      } catch (e) {
        console.error("Error parsing local alerts", e);
      }
    }

    // Si hay sesión, cargar de Supabase
    if (session?.user) {
      loadRemoteAlerts();
      checkPushSubscription();
    }
  }, [session]);

  const loadRemoteAlerts = async () => {
    const { data, error } = await supabase
      .from('user_alerts')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (!error && data) {
      // Mapeamos para mantener formato compatible
      const remoteAlerts = data.map(a => ({
        id: a.id,
        createdAt: a.created_at,
        filters: a.filters,
        isRemote: true // Flag para saber que viene de DB
      }));
      setAlerts(remoteAlerts);
      // Sincronizar con local
      localStorage.setItem('job_alerts', JSON.stringify(remoteAlerts));
    }
  };

  const checkPushSubscription = async () => {
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      setIsPushEnabled(!!subscription);
    }
  };

  // 2. Guardar Alerta
  const addAlert = async (filters) => {
    // Primero pedimos permiso de notificación si no lo tenemos
    if (Notification.permission !== 'granted') {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        alert("Necesitas activar las notificaciones para recibir alertas.");
        return;
      }
    }

    // Intentamos activar Push si es posible
    await enablePushNotifications();

    const newAlertLocal = {
      id: Date.now(),
      createdAt: new Date().toISOString(),
      filters
    };

    // Optimistic update
    const updatedAlerts = [...alerts, newAlertLocal];
    setAlerts(updatedAlerts);
    localStorage.setItem('job_alerts', JSON.stringify(updatedAlerts));

    // Guardar en Supabase si hay sesión
    if (session?.user) {
      const { error } = await supabase
        .from('user_alerts')
        .insert([{
          user_id: session.user.id,
          filters: filters
        }]);
      
      if (error) {
        console.error("Error saving alert to Supabase:", error);
        alert("Error guardando alerta en la nube. Se guardó solo localmente.");
      } else {
        alert('✅ Alerta guardada y sincronizada.');
        loadRemoteAlerts(); // Recargar para tener los IDs reales
      }
    } else {
      alert('✅ Alerta guardada localmente (inicia sesión para sincronizar).');
    }
  };

  const removeAlert = async (id) => {
    // Optimistic delete
    const updatedAlerts = alerts.filter(a => a.id !== id);
    setAlerts(updatedAlerts);
    localStorage.setItem('job_alerts', JSON.stringify(updatedAlerts));

    if (session?.user) {
      await supabase.from('user_alerts').delete().eq('id', id);
    }
  };

  // 3. Activar Web Push
  const enablePushNotifications = async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.log("Push messaging not supported");
      return;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      
      // Suscribirse al Push Manager del navegador
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      });

      console.log("Push Subscription:", subscription);

      // Guardar suscripción en Supabase
      if (session?.user) {
        // Convertir a JSON puro para evitar problemas de serialización
        const subscriptionJSON = JSON.parse(JSON.stringify(subscription));

        const { error } = await supabase
          .from('push_subscriptions')
          .upsert({
            user_id: session.user.id,
            subscription: subscriptionJSON
          }, { onConflict: 'user_id, subscription' });

        if (error) {
            console.error("Error saving push subscription:", error);
            alert("Error guardando suscripción en servidor: " + error.message);
        } else {
            setIsPushEnabled(true);
            alert("✅ Notificaciones Push activadas correctamente en servidor.");
        }
      } else {
          alert("No hay sesión de usuario activa. No se puede guardar la suscripción.");
      }

    } catch (error) {
      console.error("Error enabling push notifications:", error);
    }
  };

  // Lógica de coincidencia (Mantenemos la local para feedback inmediato en PC)
  const matchesFilters = (job, filters) => {
    try {
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
                               (filterWorkplace || []).includes(job.workplace_type) || 
                               !job.workplace_type;

      const matchesEmployment = (filterEmployment || []).length === 0 || 
                                (filterEmployment || []).some(type => (job.employment_type || '').includes(type)) ||
                                !job.employment_type;

      const matchesLocation = (filterLocation || "") === "" || 
                              (job.location || '').toLowerCase().includes((filterLocation || "").toLowerCase());
      
      const matchesSalary = (job.salary_max || job.salary_min || 0) >= (filterSalary || 0) || 
                            (!job.salary_min && !job.salary_max);

      // Handle skills (Array or null)
      const jobSkills = Array.isArray(job.required_skills) ? job.required_skills : [];
      const matchesSkills = (filterSkills || []).length === 0 || 
                            (filterSkills || []).every(skill => jobSkills.includes(skill));

      const exp = job.required_experience_years;
      const matchesExperience = (exp === null || exp === undefined) || 
                                (exp >= (filterExperience?.[0] || 0) && exp <= (filterExperience?.[1] || 100));

      // Handle languages (Array, Object, or null)
      let jobLanguages = [];
      if (Array.isArray(job.required_languages)) {
        jobLanguages = job.required_languages;
      } else if (typeof job.required_languages === 'object' && job.required_languages !== null) {
        jobLanguages = Object.keys(job.required_languages);
      }

      const matchesLanguages = (filterLanguages || []).length === 0 || 
                               (jobLanguages.length === 0) || // Match if no languages required
                               (filterLanguages || []).every(filterLang => {
                                  // Check if filterLang is in jobLanguages (handling string or object keys)
                                  return jobLanguages.some(lang => {
                                     if (typeof lang === 'string') return lang === filterLang;
                                     if (typeof lang === 'object' && lang !== null) return Object.keys(lang)[0] === filterLang;
                                     return false;
                                  });
                               });
      
      return matchesSearch && matchesStatus && matchesWorkplace && matchesEmployment && matchesLocation && matchesSalary && matchesSkills && matchesExperience && matchesLanguages;
    } catch (error) {
      console.error("Error in matchesFilters", error, job);
      return false;
    }
  };

  // Suscripción a Realtime (Solo para PC/App abierta)
  useEffect(() => {
    if (alerts.length === 0) return;
    // Si requerimos sesión para recibir eventos (RLS), esperamos a tener sesión.
    // Si la app permite acceso público, esto no es necesario, pero dado el problema,
    // es mejor asegurar que la suscripción se refresque con la sesión.
    
    console.log("Subscribing to job alerts. Session present:", !!session);

    const channel = supabase
      .channel('jobs-alerts')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'jobs' }, (payload) => {
        console.log("New job received via Realtime:", payload.new);
        const newJob = payload.new;
        
        alerts.forEach(alert => {
          const isMatch = matchesFilters(newJob, alert.filters);
          console.log(`Checking alert ${alert.id}: Match = ${isMatch}`);
          
          if (isMatch) {
            console.log("Triggering notification for job:", newJob.title);
            new Notification(`🔔 Nueva oferta: ${newJob.title}`, {
              body: `${newJob.company} - ${newJob.location}\nHaz clic para ver más.`,
              icon: '/icon-dark.png',
              tag: newJob.job_id // Evita duplicados
            });
          }
        });
      })
      .subscribe((status) => {
        console.log("Realtime subscription status:", status);
      });

    return () => {
      console.log("Unsubscribing from job alerts");
      supabase.removeChannel(channel);
    };
  }, [alerts, supabase, session]);

  return { alerts, addAlert, removeAlert, enablePushNotifications, isPushEnabled };
}
