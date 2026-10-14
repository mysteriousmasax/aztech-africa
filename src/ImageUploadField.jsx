import { useState } from 'react';

const maxUploadBytes = 4 * 1024 * 1024;

function readAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
    reader.onerror = () => reject(new Error('Could not read this image file.'));
    reader.readAsDataURL(file);
  });
}

export default function ImageUploadField({ label, value = '', onChange, alt = '', disabled = false }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function uploadImage(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.size > maxUploadBytes) {
      setMessage('Choose an image smaller than 4 MB.');
      return;
    }

    setBusy(true);
    setMessage('');
    try {
      const response = await fetch('/api/media', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ mimeType: file.type, dataBase64: await readAsBase64(file) }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Image upload failed.');
      onChange(result.url);
      setMessage('Image uploaded.');
    } catch (error) {
      setMessage(error.message || 'Image upload failed.');
    } finally {
      setBusy(false);
    }
  }

  return <div className="image-upload-field">
    <label>{label}<input type="text" value={value} onChange={(event) => { setMessage(''); onChange(event.target.value); }} disabled={disabled || busy} placeholder="https://... or upload an image" /></label>
    <div className="image-upload-actions">
      <label className="image-upload-control"><input className="image-upload-input" type="file" accept="image/jpeg,image/png,image/webp" onChange={uploadImage} disabled={disabled || busy} /><span>{busy ? 'Uploading image...' : 'Choose image from device'}</span></label>
      {value && <button className="studio-secondary" type="button" onClick={() => { onChange(''); setMessage('Image removed.'); }} disabled={disabled || busy}>Remove image</button>}
    </div>
    {value && <img className="image-upload-preview" src={value} alt={alt} loading="lazy" />}
    {message && <p className="image-upload-message" aria-live="polite">{message}</p>}
  </div>;
}