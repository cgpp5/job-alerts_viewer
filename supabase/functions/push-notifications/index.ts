import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import webpush from "npm:web-push@3.6.7"

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
)

const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY')
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')
const VAPID_SUBJECT = 'mailto:admin@job-alerts.com'

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    VAPID_SUBJECT,
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
  )
}

serve(async (req) => {
  try {
    const payload = await req.json()
    const newJob = payload.record

    if (!newJob) {
        return new Response("No record found", { status: 400 })
    }

    console.log("New job received:", newJob.title)

    // 1. Obtener todas las alertas
    const { data: allAlerts, error: alertsError } = await supabase
      .from('user_alerts')
      .select('user_id, filters')

    if (alertsError) {
      console.error("Error fetching alerts", alertsError)
      return new Response(JSON.stringify({ error: alertsError }), { status: 500 })
    }

    const usersToNotify = new Set()

    // 2. Filtrar
    for (const alert of allAlerts) {
      if (matchesFilters(newJob, alert.filters)) {
        usersToNotify.add(alert.user_id)
      }
    }

    console.log(`Sending notifications to ${usersToNotify.size} users`)

    // 3. Enviar
    const results = []
    for (const userId of usersToNotify) {
      const { data: subscriptions } = await supabase
        .from('push_subscriptions')
        .select('subscription')
        .eq('user_id', userId)

      if (subscriptions) {
        for (const sub of subscriptions) {
          try {
            // Parsear si viene como string, o usar directo si es objeto
            const pushSubscription = typeof sub.subscription === 'string' 
                ? JSON.parse(sub.subscription) 
                : sub.subscription

            const pushPayload = JSON.stringify({
              title: `Nueva oferta: ${newJob.title}`,
              body: `${newJob.company} - ${newJob.location}`,
              url: `/?jobId=${newJob.job_id}` 
            })

            await webpush.sendNotification(pushSubscription, pushPayload)
            results.push({ userId, status: 'sent' })
          } catch (error) {
            console.error(`Error sending push to user ${userId}:`, error)
            if (error.statusCode === 410) {
                // Subscription gone, delete it
                await supabase.from('push_subscriptions')
                    .delete()
                    .match({ user_id: userId, subscription: sub.subscription })
            }
            results.push({ userId, status: 'failed', error: error.message })
          }
        }
      }
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { "Content-Type": "application/json" },
    })
  } catch (err) {
      console.error(err)
      return new Response(JSON.stringify({ error: err.message }), { status: 500 })
  }
})

// Lógica de coincidencia COMPLETA
function matchesFilters(job, filters) {
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
                               (jobLanguages.length === 0) || 
                               (filterLanguages || []).every(filterLang => {
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
}
