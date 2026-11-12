import Image from 'next/image';
import { useEffect, useId, useState } from 'react';
import type { ReactNode } from 'react';
import { apiRequest, getPrivateImage } from '../auth-client';

type Endpoint = '/api/v1/candidates/me/avatar' | '/api/v1/companies/me/logo';
export function ManagedImage({ endpoint, url, alt, fallback = null }: { endpoint: Endpoint; url: string | null; alt: string; fallback?: ReactNode }) {
  const [preview, setPreview] = useState<{ url: string; blob: string }>();
  useEffect(() => {
    if (!url) return;
    let active = true;
    let objectUrl: string | undefined;
    const path = (() => { try { return new URL(url).pathname; } catch { return ''; } })();
    if (path !== '/api/v1/candidates/me/avatar' && !/^\/api\/v1\/media\/companies\/[1-9][0-9]*\/logos\/[a-f0-9]{32}\.png$/.test(path)) return;
    getPrivateImage(endpoint).then(blob => {
      if (!active) return;
      objectUrl = URL.createObjectURL(blob);
      setPreview({ url, blob: objectUrl });
    }).catch(() => { /* Keep initials/empty preview; uploading remains available. */ });
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [endpoint, url]);
  return preview && preview.url === url ? <Image unoptimized src={preview.blob} alt={alt} width={104} height={104} style={{ objectFit: 'cover', maxWidth: '100%' }} /> : fallback;
}

export default function ImageUpload({ endpoint, url, label, disabled, onUploaded, onBusy }: { endpoint: Endpoint; url: string | null; label: string; disabled?: boolean; onUploaded: (url: string) => void; onBusy: (busy: boolean) => void }) {
  const inputId = useId();
  const [file, setFile] = useState<File>();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  async function upload() {
    if (!file || busy || disabled) return;
    setError(''); setMessage('');
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
      setError('Chọn ảnh JPEG, PNG hoặc WebP tối đa 5 MiB.'); return;
    }
    setBusy(true); onBusy(true);
    try {
      const body = new FormData(); body.set('file', file);
      const result = await apiRequest<{ url: string }>(endpoint, { method: 'POST', body });
      onUploaded(result.url); setFile(undefined); setMessage('Đã tải và lưu ảnh.');
      const input = document.getElementById(inputId) as HTMLInputElement | null;
      if (input) input.value = '';
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Không thể tải ảnh.'); }
    finally { setBusy(false); onBusy(false); }
  }
  return <div className="ui-stack" aria-busy={busy}>
    <ManagedImage endpoint={endpoint} url={url} alt={label} />
    <label htmlFor={inputId}>{label}</label>
    <input id={inputId} type="file" accept="image/jpeg,image/png,image/webp" disabled={busy || disabled} onChange={event => { setFile(event.target.files?.[0]); setError(''); setMessage(''); }} />
    <p className="ui-small ui-muted">JPEG, PNG, WebP · Tối đa 5 MiB/16 megapixel · Ảnh được chuẩn hóa tối đa 1024px.</p>
    <button type="button" className="ui-btn" disabled={!file || busy || disabled} onClick={upload}>{busy ? 'Đang tải ảnh…' : 'Tải và lưu ảnh'}</button>
    {message && <p role="status">{message}</p>}{error && <p role="alert">{error}</p>}
  </div>;
}
