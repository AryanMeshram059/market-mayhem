'use client';

import { useState } from 'react';
import { apiFetch } from '@/lib/client';
import { Button } from '@/components/ui/button';

export function ScheduleUploader() {
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleUpload = async () => {
    if (!file) return;
    setMessage('');
    setError('');

    const formData = new FormData();
    formData.append('file', file);

    try {
      const token = localStorage.getItem('mm_admin_token');
      const response = await fetch('/api/admin/schedule/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error?.message ?? 'Upload failed');
      } else {
        setMessage(data.message ?? 'Schedule uploaded successfully');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    }
  };

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <h3 className="font-semibold">Upload NAV Schedule (CSV)</h3>
      <p className="text-sm text-muted-foreground">11 funds × 15 rounds. Header row required.</p>
      <input type="file" accept=".csv" onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        className="text-sm" />
      <Button onClick={handleUpload} disabled={!file}>Upload</Button>
      {message && <p className="text-sm text-green-600">{message}</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
