import { useState, useEffect } from 'react';

export function useReadJobs() {
  const [readJobs, setReadJobs] = useState(new Set());

  useEffect(() => {
    const saved = localStorage.getItem('read_jobs');
    if (saved) {
      try {
        setReadJobs(new Set(JSON.parse(saved)));
      } catch (e) {
        console.error("Error parsing read jobs", e);
      }
    }
  }, []);

  const markAsRead = (jobId) => {
    if (!readJobs.has(jobId)) {
      const newSet = new Set(readJobs);
      newSet.add(jobId);
      setReadJobs(newSet);
      localStorage.setItem('read_jobs', JSON.stringify([...newSet]));
    }
  };

  const isRead = (jobId) => readJobs.has(jobId);

  return { isRead, markAsRead };
}
