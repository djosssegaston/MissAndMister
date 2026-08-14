import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Cropper from 'cropperjs';
import 'cropperjs/dist/cropper.css';
import { jseraiAPI } from '../services/api';
import './JSerai.css';

const POSTER_W = 1080;
const POSTER_H = 1260;
const STORAGE_KEY = 'jserai_session';

const loadSession = () => {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
};

const saveSession = (data) => {
  try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch {}
};

const clearSession = () => {
  try { sessionStorage.removeItem(STORAGE_KEY); } catch {}
};

/* ──────────────────────────── STEP 1: Photo + Poster ──────────────────────────── */
const loadHTMLImage = (url) => new Promise((resolve, reject) => {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => resolve(img);
  img.onerror = () => reject(new Error('Impossible de charger l\'image.'));
  img.src = url;
});

const Step3Photo = ({ data, onNext }) => {
  const fileInputRef = useRef(null);
  const cropperImageRef = useRef(null);
  const previewCanvasRef = useRef(null);

  const [templateImg, setTemplateImg] = useState(null);
  const [maskImg, setMaskImg] = useState(null);
  const [templateConfig, setTemplateConfig] = useState(null);

  const [selectedFile, setSelectedFile] = useState(null);
  const [userPhotoUrl, setUserPhotoUrl] = useState(null);
  const [userPhotoImg, setUserPhotoImg] = useState(null);
  const [cropperInstance, setCropperInstance] = useState(null);
  const [showCropper, setShowCropper] = useState(false);

  const [zoom, setZoom] = useState(1);

  const [posterReady, setPosterReady] = useState(false);
  const [error, setError] = useState('');
  const [generating, setGenerating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [templateError, setTemplateError] = useState('');

  const aspectRatio = templateConfig?.photo
    ? templateConfig.photo.width / templateConfig.photo.height
    : 4 / 5;

  // Load template + mask on mount
  useEffect(() => {
    jseraiAPI.init().then((res) => {
      const tpl = res?.template;
      if (!tpl) {
        setTemplateError('Aucun template disponible pour le moment.');
        return;
      }
      setTemplateConfig(tpl.overlay_config || {});

      loadHTMLImage(tpl.preview_url).then(setTemplateImg).catch(() => {});

      if (tpl.mask_url) {
        loadHTMLImage(tpl.mask_url).then(setMaskImg).catch(() => {});
      }
    }).catch(() => {
      setTemplateError('Impossible de charger le template. Vérifiez votre connexion.');
    });
  }, []);

  // Preload user photo as HTMLImageElement when URL changes
  useEffect(() => {
    if (!userPhotoUrl) {
      setUserPhotoImg(null);
      setPosterReady(false);
      return;
    }
    let cancelled = false;
    loadHTMLImage(userPhotoUrl).then((img) => {
      if (!cancelled) {
        setUserPhotoImg(img);
        setPosterReady(true);
      }
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [userPhotoUrl]);

  // Render preview
  useEffect(() => {
    const canvas = previewCanvasRef.current;
    if (!canvas || !templateImg) return;
    const ctx = canvas.getContext('2d');

    const pw = 420;
    const ph = Math.round(pw * (POSTER_H / POSTER_W));
    canvas.width = pw;
    canvas.height = ph;

    ctx.clearRect(0, 0, pw, ph);

    const scaleX = pw / POSTER_W;
    const scaleY = ph / POSTER_H;

    ctx.drawImage(templateImg, 0, 0, pw, ph);

    if (userPhotoImg) {
      const pc = templateConfig?.photo || { x: 100, y: 250, width: 400, height: 500 };
      const dx = pc.x * scaleX;
      const dy = pc.y * scaleY;
      const dw = pc.width * scaleX;
      const dh = pc.height * scaleY;

      ctx.save();
      ctx.beginPath();
      const brPreview = ((pc.border_radius || 0) / POSTER_W) * pw;
      ctx.roundRect(dx, dy, dw, dh, brPreview);
      ctx.clip();
      ctx.translate(dx + dw / 2, dy + dh / 2);

      const naturalW = userPhotoImg.naturalWidth;
      const naturalH = userPhotoImg.naturalHeight;
      const cropAspect = dw / dh;
      const imgAspect = naturalW / naturalH;

      let sx, sy, sw, sh;
      if (imgAspect > cropAspect) {
        sh = naturalH;
        sw = naturalH * cropAspect;
        sx = (naturalW - sw) / 2;
        sy = 0;
      } else {
        sw = naturalW;
        sh = naturalW / cropAspect;
        sx = 0;
        sy = (naturalH - sh) / 2;
      }

      const drawW = dw * zoom;
      const drawH = dh * zoom;
      ctx.drawImage(userPhotoImg, sx, sy, sw, sh, -drawW / 2, -drawH / 2, drawW, drawH);
      ctx.restore();
    }

    if (maskImg) {
      ctx.drawImage(maskImg, 0, 0, pw, ph);
    }
  }, [templateImg, maskImg, userPhotoImg, templateConfig, zoom]);

  // Handle file select → open cropper
  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Format non supporté. Utilisez JPG, PNG ou WebP.'); return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setError('La photo ne doit pas dépasser 20 Mo.'); return;
    }

    setError('');
    setSelectedFile(file);
    setZoom(1);
    setPosterReady(false);

    const url = URL.createObjectURL(file);
    setUserPhotoUrl(url);
    setShowCropper(true);
  };

  // Initialize CropperJS when cropper becomes visible
  useEffect(() => {
    if (!showCropper || !cropperImageRef.current || !userPhotoUrl) return;

    let cropper;
    const timer = setTimeout(() => {
      cropper = new Cropper(cropperImageRef.current, {
        aspectRatio,
        viewMode: 1,
        dragMode: 'move',
        autoCropArea: 1,
        responsive: true,
        background: false,
        ready() {
          setCropperInstance(cropper);
        },
      });
    }, 100);

    return () => {
      clearTimeout(timer);
      if (cropper) {
        try { cropper.destroy(); } catch {}
      }
    };
  }, [showCropper, userPhotoUrl, aspectRatio]);

  const handleCropConfirm = () => {
    if (!cropperInstance) return;
    const canvasData = cropperInstance.getCroppedCanvas({ imageSmoothingQuality: 'high' });
    if (!canvasData) return;

    const croppedUrl = canvasData.toDataURL('image/jpeg', 0.95);
    if (userPhotoUrl && userPhotoUrl.startsWith('blob:')) {
      URL.revokeObjectURL(userPhotoUrl);
    }
    setUserPhotoUrl(croppedUrl);
    setShowCropper(false);
    setCropperInstance(null);
  };

  const handleCancelCrop = () => {
    if (cropperInstance) {
      try { cropperInstance.destroy(); } catch {}
    }
    setCropperInstance(null);
    setShowCropper(false);
    if (selectedFile) {
      if (userPhotoUrl && userPhotoUrl.startsWith('blob:')) {
        URL.revokeObjectURL(userPhotoUrl);
      }
      const url = URL.createObjectURL(selectedFile);
      setUserPhotoUrl(url);
    }
  };

  const handleResetPhoto = () => {
    if (userPhotoUrl && userPhotoUrl.startsWith('blob:')) URL.revokeObjectURL(userPhotoUrl);
    setUserPhotoUrl(null);
    setUserPhotoImg(null);
    setSelectedFile(null);
    setZoom(1);
    setPosterReady(false);
    setShowCropper(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Full-res HD export
  const generateHDPoster = useCallback((format = 'png') => {
    return new Promise((resolve) => {
      if (!templateImg || !userPhotoImg) { resolve(null); return; }

      const canvas = document.createElement('canvas');
      canvas.width = POSTER_W;
      canvas.height = POSTER_H;
      const ctx = canvas.getContext('2d');

      ctx.drawImage(templateImg, 0, 0, POSTER_W, POSTER_H);

      const pc = templateConfig?.photo || { x: 100, y: 250, width: 400, height: 500 };

      ctx.save();
      ctx.beginPath();
      ctx.roundRect(pc.x, pc.y, pc.width, pc.height, pc.border_radius || 0);
      ctx.clip();
      ctx.translate(pc.x + pc.width / 2, pc.y + pc.height / 2);

      const naturalW = userPhotoImg.naturalWidth;
      const naturalH = userPhotoImg.naturalHeight;
      const cropAspect = pc.width / pc.height;
      const imgAspect = naturalW / naturalH;

      let sx, sy, sw, sh;
      if (imgAspect > cropAspect) {
        sh = naturalH;
        sw = naturalH * cropAspect;
        sx = (naturalW - sw) / 2;
        sy = 0;
      } else {
        sw = naturalW;
        sh = naturalW / cropAspect;
        sx = 0;
        sy = (naturalH - sh) / 2;
      }

      const drawW = pc.width * zoom;
      const drawH = pc.height * zoom;
      ctx.drawImage(userPhotoImg, sx, sy, sw, sh, -drawW / 2, -drawH / 2, drawW, drawH);
      ctx.restore();

      if (maskImg) {
        ctx.drawImage(maskImg, 0, 0, POSTER_W, POSTER_H);
      }

      const mimeType = format === 'jpg' ? 'image/jpeg' : 'image/png';
      const quality = format === 'jpg' ? 0.95 : undefined;
      canvas.toBlob((blob) => resolve(blob), mimeType, quality);
    });
  }, [templateImg, maskImg, userPhotoImg, templateConfig, zoom]);

  const handleDownload = async (format = 'png') => {
    setGenerating(true);
    setError('');
    try {
      const blob = await generateHDPoster(format);
      if (!blob) { setError('Erreur lors de la génération.'); return false; }

      if (data.uuid && selectedFile) {
        setUploading(true);
        try {
          await jseraiAPI.uploadPhoto(data.uuid, selectedFile, data.editToken);
        } catch {
          // Server save is best-effort; poster still downloads locally
        }
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const nameParts = [data.firstName, data.lastName].filter(Boolean);
      const baseName = nameParts.length > 0 ? `j-y-serai-${nameParts.join('-')}` : 'j-y-serai-affiche';
      a.download = `${baseName}.${format === 'jpg' ? 'jpg' : 'png'}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      saveSession({ ...loadSession(), status: 'completed' });
      return true;
    } catch (err) {
      setError(err.message || 'Erreur lors du téléchargement.');
      return false;
    } finally {
      setGenerating(false);
      setUploading(false);
    }
  };

  const handleFinish = async () => {
    const success = await handleDownload('png');
    if (success) {
      onNext({ ...data });
    }
  };

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
      <div className="jserai-step3">
        <h2>Votre affiche</h2>
        <p className="jserai-subtitle">Importez votre photo, ajustez-la, puis téléchargez en HD</p>

        {error && <p className="jserai-error">{error}</p>}
        {templateError && !error && <p className="jserai-error">{templateError}</p>}

        <div className="jserai-workspace">
          {/* Left: Cropper or Controls */}
          <div className="jserai-editor">
            {showCropper ? (
              <div className="jserai-cropper-box">
                <div className="jserai-cropper-view">
                  <img ref={cropperImageRef} src={userPhotoUrl} alt="Crop" />
                </div>
                <div className="jserai-cropper-controls">
                  <button className="jserai-btn jserai-btn-ghost jserai-btn-sm" onClick={handleCancelCrop} disabled={generating}>Annuler</button>
                  <button className="jserai-btn jserai-btn-primary jserai-btn-sm" onClick={handleCropConfirm} disabled={!cropperInstance}>Valider le cadrage</button>
                </div>
              </div>
            ) : (
              <>
                {!userPhotoUrl ? (
                  <div className="jserai-dropzone" onClick={() => fileInputRef.current?.click()}>
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
                      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" stroke="#D4AF37" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <p>Cliquez pour importer votre photo</p>
                    <span>JPG, PNG ou WebP (max 20 Mo)</span>
                  </div>
                ) : (
                  <div className="jserai-photo-controls">
                    <div className="jserai-photo-thumb-wrap">
                      <img src={userPhotoUrl} alt="Votre photo" className="jserai-photo-thumb" />
                    </div>

                    <div className="jserai-control-group">
                      <label>Zoom</label>
                      <div className="jserai-slider-row">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/><path d="M8 11h6"/></svg>
                        <input type="range" min={0.5} max={2} step={0.01} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} className="jserai-slider" />
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/><path d="M8 11h6"/></svg>
                      </div>
                    </div>

                    <div className="jserai-photo-actions">
                      <button className="jserai-btn jserai-btn-ghost jserai-btn-sm" onClick={() => { setShowCropper(true); setZoom(1); }} disabled={generating}>Rogner</button>
                      <button className="jserai-btn jserai-btn-ghost jserai-btn-sm" onClick={() => fileInputRef.current?.click()} disabled={generating}>Changer</button>
                      <button className="jserai-btn jserai-btn-ghost jserai-btn-sm jserai-btn-danger" onClick={handleResetPhoto} disabled={generating}>Supprimer</button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Right: Preview */}
          <div className="jserai-preview">
            <div className="jserai-preview-label">Aperçu</div>
            <div className="jserai-preview-frame">
              <canvas ref={previewCanvasRef} className="jserai-preview-canvas" />
              {!userPhotoImg && (
                <div className="jserai-preview-placeholder">
                  <span>Votre photo apparaîtra ici</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="jserai-actions">
          {posterReady && userPhotoUrl && (
            <button type="button" className="jserai-btn jserai-btn-primary" onClick={handleFinish} disabled={generating}>
              {generating ? 'Génération...' : 'Terminer'}
            </button>
          )}
        </div>

        {uploading && <p className="jserai-info">Sauvegarde en cours sur le serveur...</p>}

        <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleFileSelect} style={{ display: 'none' }} />
      </div>
    </motion.div>
  );
};

/* ──────────────────────────── STEP 4: Done ──────────────────────────── */
const PosterFinal = ({ data, onReset }) => {
  useEffect(() => {
    const timer = setTimeout(() => { onReset(); }, 2500);
    return () => clearTimeout(timer);
  }, [onReset]);

  return (
    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="jserai-final">
      <div className="jserai-success">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="#D4AF37" strokeWidth="2"/>
          <path d="M8 12l3 3 5-5" stroke="#D4AF37" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <h2>Téléchargement effectué !</h2>
        <p>Votre affiche a été téléchargée avec succès.</p>
      </div>
    </motion.div>
  );
};

/* ──────────────────────────── MAIN ──────────────────────────── */
const JSerai = () => {
  const [step, setStep] = useState(3);
  const [data, setData] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    uuid: null,
    editToken: null,
    photoUrl: null,
    posterUrl: null,
  });

  useEffect(() => {
    const session = loadSession();
    if (session) {
      if (session.status === 'completed') {
        setData((prev) => ({ ...prev, ...session }));
        setStep(4);
      } else if (session.uuid) {
        setData((prev) => ({ ...prev, ...session }));
        setStep(3);
      }
    }
  }, []);

  const handleNext = useCallback((newData) => {
    setData((prev) => ({ ...prev, ...newData }));
    setStep((s) => Math.min(s + 1, 4));
  }, []);

  const handleReset = useCallback(() => {
    clearSession();
    setData({ firstName: '', lastName: '', phone: '', uuid: null, editToken: null, photoUrl: null, posterUrl: null });
    setStep(3);
  }, []);

  return (
    <div className="jserai-page">
      <div className="jserai-container">
        <div className="jserai-header">
          <h1>J'y serai</h1>
          <p>Créez votre affiche personnalisée et confirmez votre présence</p>
        </div>
        <div className="jserai-content">
          <AnimatePresence mode="wait">
            {step === 3 && <Step3Photo key="step3" data={data} onNext={handleNext} />}
            {step === 4 && <PosterFinal key="final" data={data} onReset={handleReset} />}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default JSerai;
