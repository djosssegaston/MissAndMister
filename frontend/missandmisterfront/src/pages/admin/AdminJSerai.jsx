import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { adminJSeraiAPI } from '../../services/api';
import './admin-theme.css';
import './AdminJSerai.css';

const ConfirmModal = ({ message, onConfirm, onCancel }) => (
  <motion.div className="ajserai-confirm-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onCancel}>
    <motion.div className="ajserai-confirm-modal" initial={{ scale: 0.94, y: 18 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.94, y: 18 }} onClick={(e) => e.stopPropagation()}>
      <p>{message}</p>
      <div className="ajserai-confirm-actions">
        <button className="ag-btn ag-btn-ghost" onClick={onCancel}>Annuler</button>
        <button className="ag-btn ag-btn-danger" onClick={onConfirm}>Confirmer</button>
      </div>
    </motion.div>
  </motion.div>
);

const POSTER_W = 1080;
const POSTER_H = 1260;

const HANDLE_SIZE = 8;
const ZONE_COLORS = {
  photo: { stroke: '#ff4444', fill: 'rgba(255,68,68,0.15)', label: 'Photo' },
};

const loadImg = (url) => new Promise((resolve) => {
  if (!url) { resolve(null); return; }
  const img = new Image();
  img.onload = () => resolve(img);
  img.onerror = () => resolve(null);
  img.src = url;
});

const OverlayEditor = ({ templateUrl, maskUrl, overlayConfig, onChange }) => {
  const canvasRef = useRef(null);
  const templateImgRef = useRef(null);
  const maskImgRef = useRef(null);
  const [selected, setSelected] = useState(null);
  const dragRef = useRef(null);

  const getScale = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return { sx: 1, sy: 1 };
    return { sx: POSTER_W / canvas.width, sy: POSTER_H / canvas.height };
  }, []);

  const parseConfig = useCallback(() => {
    if (!overlayConfig?.trim()) return null;
    try { return JSON.parse(overlayConfig); } catch { return null; }
  }, [overlayConfig]);

  const getHandles = useCallback((zone) => {
    if (!zone) return [];
    const { x, y, width: w, height: h } = zone;
    return [
      { key: 'nw', cx: x, cy: y },
      { key: 'n', cx: x + w / 2, cy: y },
      { key: 'ne', cx: x + w, cy: y },
      { key: 'e', cx: x + w, cy: y + h / 2 },
      { key: 'se', cx: x + w, cy: y + h },
      { key: 's', cx: x + w / 2, cy: y + h },
      { key: 'sw', cx: x, cy: y + h },
      { key: 'w', cx: x, cy: y + h / 2 },
    ];
  }, []);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const pw = canvas.width;
    const ph = canvas.height;
    ctx.clearRect(0, 0, pw, ph);

    const sx = pw / POSTER_W;
    const sy = ph / POSTER_H;

    const config = parseConfig();

    if (templateImgRef.current) {
      ctx.drawImage(templateImgRef.current, 0, 0, pw, ph);
    } else {
      ctx.fillStyle = '#1a1a2e';
      ctx.fillRect(0, 0, pw, ph);
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.font = '13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Chargement du template...', pw / 2, ph / 2);
    }

    if (config) {
      const zones = ['photo'];
      for (const key of zones) {
        const z = config[key];
        if (!z || z.x == null || z.y == null) continue;

        const rx = z.x * sx;
        const ry = z.y * sy;
        const rw = (z.width || 200) * sx;
        const rh = (z.height || 40) * sy;
        const br = ((z.border_radius || 0) / POSTER_W) * pw;
        const colors = ZONE_COLORS[key] || ZONE_COLORS.photo;
        const isSelected = selected === key;

        ctx.save();
        ctx.beginPath();
        ctx.roundRect(rx, ry, rw, rh, br);
        ctx.fillStyle = colors.fill;
        ctx.fill();

        ctx.strokeStyle = colors.stroke;
        ctx.lineWidth = isSelected ? 2.5 : 1.5;
        ctx.setLineDash(isSelected ? [] : [5, 3]);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = colors.stroke;
        ctx.font = `bold ${Math.max(10, Math.min(13, rw / 6))}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(colors.label, rx + rw / 2, ry + rh / 2);

        if (isSelected) {
          const handles = getHandles(z);
          for (const h of handles) {
            const hx = h.cx * sx;
            const hy = h.cy * sy;
            ctx.fillStyle = '#fff';
            ctx.strokeStyle = colors.stroke;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(hx, hy, HANDLE_SIZE / 2 + 1, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
          }
        }
        ctx.restore();
      }
    }

    if (maskImgRef.current) {
      ctx.globalAlpha = 0.5;
      ctx.drawImage(maskImgRef.current, 0, 0, pw, ph);
      ctx.globalAlpha = 1;
    }
  }, [templateUrl, maskUrl, overlayConfig, selected, parseConfig, getHandles]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const [t, m] = await Promise.all([loadImg(templateUrl), loadImg(maskUrl)]);
      if (cancelled) return;
      templateImgRef.current = t;
      maskImgRef.current = m;
      draw();
    };
    load();
    return () => { cancelled = true; };
  }, [templateUrl, maskUrl]);

  useEffect(() => { draw(); }, [draw]);

  const findZoneAt = useCallback((canvasX, canvasY) => {
    const config = parseConfig();
    if (!config) return null;
    const { sx, sy } = { sx: POSTER_W / canvasRef.current.width, sy: POSTER_H / canvasRef.current.height };
    const px = canvasX * sx;
    const py = canvasY * sy;

    const zones = ['photo'];
    for (const key of zones) {
      const z = config[key];
      if (!z || z.x == null || z.y == null) continue;
      const w = z.width || 200;
      const h = z.height || 40;
      if (px >= z.x && px <= z.x + w && py >= z.y && py <= z.y + h) {
        return key;
      }
    }
    return null;
  }, [parseConfig]);

  const findHandleAt = useCallback((canvasX, canvasY) => {
    if (!selected) return null;
    const config = parseConfig();
    if (!config?.[selected]) return null;
    const { sx, sy } = { sx: POSTER_W / canvasRef.current.width, sy: POSTER_H / canvasRef.current.height };
    const px = canvasX * sx;
    const py = canvasY * sy;
    const handles = getHandles(config[selected]);
    const hitRadius = 10;
    for (const h of handles) {
      const dx = px - h.cx;
      const dy = py - h.cy;
      if (Math.sqrt(dx * dx + dy * dy) < hitRadius) {
        return h.key;
      }
    }
    return null;
  }, [selected, parseConfig, getHandles]);

  const updateConfig = useCallback((key, newZone) => {
    const config = parseConfig() || {};
    const updated = { ...config, [key]: { ...config[key], ...newZone } };
    onChange(JSON.stringify(updated, null, 2));
  }, [parseConfig, onChange]);

  const handleMouseDown = useCallback((e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const cx = ((e.clientX - rect.left) / rect.width) * canvas.width;
    const cy = ((e.clientY - rect.top) / rect.height) * canvas.height;

    const handle = findHandleAt(cx, cy);
    if (handle) {
      const config = parseConfig();
      const z = config[selected];
      const { sx, sy } = { sx: POSTER_W / canvas.width, sy: POSTER_H / canvas.height };
      dragRef.current = { type: 'resize', handle, startPx: cx * sx, startPy: cy * sy, orig: { ...z } };
      e.preventDefault();
      return;
    }

    const zone = findZoneAt(cx, cy);
    if (zone) {
      setSelected(zone);
      const config = parseConfig();
      const z = config[zone];
      const { sx, sy } = { sx: POSTER_W / canvas.width, sy: POSTER_H / canvas.height };
      dragRef.current = { type: 'move', startPx: cx * sx, startPy: cy * sy, orig: { ...z } };
      e.preventDefault();
    } else {
      setSelected(null);
    }
  }, [selected, findZoneAt, findHandleAt, parseConfig]);

  const handleMouseMove = useCallback((e) => {
    const drag = dragRef.current;
    if (!drag) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const cx = ((e.clientX - rect.left) / rect.width) * canvas.width;
    const cy = ((e.clientY - rect.top) / rect.height) * canvas.height;
    const { sx, sy } = { sx: POSTER_W / canvas.width, sy: POSTER_H / canvas.height };
    const px = cx * sx;
    const py = cy * sy;
    const dx = px - drag.startPx;
    const dy = py - drag.startPy;
    const o = drag.orig;

    if (drag.type === 'move') {
      updateConfig(selected, {
        x: Math.round(Math.max(0, Math.min(POSTER_W - (o.width || 200), o.x + dx))),
        y: Math.round(Math.max(0, Math.min(POSTER_H - (o.height || 40), o.y + dy))),
      });
    } else if (drag.type === 'resize') {
      let { x, y, width: w, height: h } = o;
      const hKey = drag.handle;
      if (hKey.includes('e')) { w = Math.max(40, o.width + dx); }
      if (hKey.includes('w')) { w = Math.max(40, o.width - dx); x = o.x + o.width - w; }
      if (hKey.includes('s')) { h = Math.max(20, o.height + dy); }
      if (hKey.includes('n')) { h = Math.max(20, o.height - dy); y = o.y + o.height - h; }
      updateConfig(selected, {
        x: Math.round(Math.max(0, x)),
        y: Math.round(Math.max(0, y)),
        width: Math.round(Math.min(POSTER_W, w)),
        height: Math.round(Math.min(POSTER_H, h)),
      });
    }
  }, [selected, updateConfig]);

  const handleMouseUp = useCallback(() => {
    dragRef.current = null;
  }, []);

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  const cursorForHandle = (h) => {
    if (!h) return 'default';
    const map = { nw: 'nw-resize', n: 'n-resize', ne: 'ne-resize', e: 'e-resize', se: 'se-resize', s: 's-resize', sw: 'sw-resize', w: 'w-resize' };
    return map[h] || 'default';
  };

  return (
    <div className="ag-form-group">
      <label className="ag-label">Éditeur d'overlay (cliquez pour sélectionner, glissez pour déplacer, utilisez les poignées pour redimensionner)</label>
      <div
        style={{
          borderRadius: 8,
          overflow: 'hidden',
          border: '1px solid var(--ag-border, rgba(212,175,55,0.12))',
          background: '#000',
          cursor: dragRef.current
            ? (dragRef.current.type === 'move' ? 'grabbing' : cursorForHandle(dragRef.current.handle))
            : (selected ? 'grab' : 'crosshair'),
        }}
      >
        <canvas
          ref={canvasRef}
          width={420}
          height={Math.round(420 * (POSTER_H / POSTER_W))}
          onMouseDown={handleMouseDown}
          style={{ width: '100%', height: 'auto', display: 'block' }}
        />
      </div>
      <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => setSelected(selected === 'photo' ? null : 'photo')}
          style={{
            fontSize: '0.7rem',
            padding: '3px 8px',
            borderRadius: 4,
            border: `1.5px solid ${ZONE_COLORS.photo.stroke}`,
            background: selected === 'photo' ? ZONE_COLORS.photo.fill : 'transparent',
            color: ZONE_COLORS.photo.stroke,
            cursor: 'pointer',
            fontWeight: selected === 'photo' ? 700 : 400,
          }}
        >
          Zone photo
        </button>
      </div>
      {selected === 'photo' && (() => {
        const config = parseConfig();
        const br = config?.photo?.border_radius ?? 0;
        return (
          <div style={{ marginTop: '0.6rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <label style={{ fontSize: '0.75rem', color: 'var(--ag-text-2)', whiteSpace: 'nowrap' }}>Arrondi bordure</label>
            <input
              type="range"
              min={0}
              max={Math.round(Math.min(config?.photo?.width || 400, config?.photo?.height || 500) / 2)}
              value={br}
              onChange={(e) => {
                const updated = { ...(config || {}), photo: { ...(config?.photo || {}), border_radius: Number(e.target.value) } };
                onChange(JSON.stringify(updated, null, 2));
              }}
              style={{ flex: 1, accentColor: '#ff4444' }}
            />
            <span style={{ fontSize: '0.7rem', color: ZONE_COLORS.photo.stroke, minWidth: 30, textAlign: 'right' }}>{br}px</span>
          </div>
        );
      })()}
      <small style={{ color: 'var(--ag-text-3)', fontSize: '0.75rem', marginTop: '0.3rem', display: 'block' }}>
        Sélectionnez une zone puis glissez-déplacez ou redimensionnez avec les poignées. Le JSON se met à jour automatiquement.
      </small>
    </div>
  );
};

const emptyForm = { name: '', overlayConfig: '', isActive: false, template: null, mask: null };

const AdminJSerai = () => {
  const [templates, setTemplates] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [maskPreviewUrl, setMaskPreviewUrl] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [tab, setTab] = useState('templates');
  const fileInputRef = useRef(null);
  const maskInputRef = useRef(null);
  const hasLoaded = useRef(false);

  useEffect(() => {
    if (!hasLoaded.current) {
      hasLoaded.current = true;
      loadData();
    }
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [templatesData, statsData] = await Promise.all([
        adminJSeraiAPI.getTemplates(),
        adminJSeraiAPI.getStats(),
      ]);
      setTemplates(Array.isArray(templatesData) ? templatesData : []);
      setStats(statsData || null);
    } catch (err) {
      if (!err?.isSessionExpired) {
        setFeedback({ type: 'error', message: err.message || 'Erreur de chargement' });
      }
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setPreviewUrl(null);
    setMaskPreviewUrl(null);
    setPanelOpen(true);
  };

  const openEdit = (template) => {
    setEditing(template);
    setForm({
      name: template.name || '',
      overlayConfig: template.overlay_config ? JSON.stringify(template.overlay_config, null, 2) : '',
      isActive: template.is_active,
      template: null,
      mask: null,
    });
    setPreviewUrl(template.file_url || null);
    setMaskPreviewUrl(template.mask_url || null);
    setPanelOpen(true);
  };

  const closePanel = () => {
    setPanelOpen(false);
    setEditing(null);
    setForm(emptyForm);
    if (previewUrl && previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }
    if (maskPreviewUrl && maskPreviewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(maskPreviewUrl);
    }
    setPreviewUrl(null);
    setMaskPreviewUrl(null);
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (previewUrl && previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }
    setForm((f) => ({ ...f, template: file }));
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleMaskChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (maskPreviewUrl && maskPreviewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(maskPreviewUrl);
    }
    setForm((f) => ({ ...f, mask: file }));
    setMaskPreviewUrl(URL.createObjectURL(file));
  };

  const validateConfig = (json) => {
    if (!json.trim()) return null;
    try {
      return JSON.parse(json);
    } catch {
      throw new Error('Le format JSON de la configuration est invalide.');
    }
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      setFeedback({ type: 'error', message: 'Le nom est obligatoire.' });
      return;
    }

    let overlayConfig = null;
    if (form.overlayConfig.trim()) {
      try {
        overlayConfig = validateConfig(form.overlayConfig);
      } catch (err) {
        setFeedback({ type: 'error', message: err.message });
        return;
      }
    }

    setSaving(true);
    setFeedback(null);

    try {
      const fd = new FormData();
      fd.append('name', form.name.trim());
      if (overlayConfig) fd.append('overlay_config', JSON.stringify(overlayConfig));
      fd.append('is_active', form.isActive ? '1' : '0');
      if (form.template) fd.append('template', form.template);
      if (form.mask) fd.append('mask', form.mask);

      if (editing) {
        fd.append('_method', 'PUT');
        await adminJSeraiAPI.updateTemplate(editing.id, fd);
      } else {
        await adminJSeraiAPI.createTemplate(fd);
      }

      setFeedback({ type: 'success', message: editing ? 'Template mis à jour.' : 'Template créé.' });
      closePanel();
      loadData();
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || 'Erreur lors de la sauvegarde.' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    setConfirm(null);
    try {
      await adminJSeraiAPI.deleteTemplate(id);
      setFeedback({ type: 'success', message: 'Template supprimé.' });
      loadData();
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || 'Erreur lors de la suppression.' });
    }
  };

  const handleActivate = async (id) => {
    try {
      await adminJSeraiAPI.activateTemplate(id);
      setFeedback({ type: 'success', message: 'Template activé.' });
      loadData();
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || 'Erreur lors de l\'activation.' });
    }
  };

  return (
    <div className="admin-page ajserai">
      {feedback && (
        <div className={`ajserai-banner ajserai-banner-${feedback.type}`}>
          <span>{feedback.message}</span>
          <button onClick={() => setFeedback(null)}>×</button>
        </div>
      )}

      <div className="ajserai-header">
        <div>
          <h1>J'y serai</h1>
          <p>Gestion des templates et des tickets</p>
        </div>
        <button className="ag-btn ag-btn-primary" onClick={openCreate}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/></svg>
          Nouveau template
        </button>
      </div>

      {stats && (
        <div className="ajserai-stats">
          <div className="ajserai-stat"><strong>{stats.total}</strong>Total</div>
          <div className="ajserai-stat"><strong>{stats.draft}</strong>Brouillons</div>
          <div className="ajserai-stat"><strong>{stats.completed}</strong>Terminés</div>
          <div className="ajserai-stat"><strong>{stats.downloaded}</strong>Téléchargés</div>
        </div>
      )}

      <div className="ajserai-tabs">
        <button className={`ajserai-tab ${tab === 'templates' ? 'active' : ''}`} onClick={() => setTab('templates')}>Templates</button>
        <button className={`ajserai-tab ${tab === 'tickets' ? 'active' : ''}`} onClick={() => setTab('tickets')}>Tickets</button>
      </div>

      <AnimatePresence mode="wait">
        {tab === 'templates' ? (
          <motion.div key="templates" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {loading ? (
              <div className="loading-container"><span className="ag-spinner" /> Chargement...</div>
            ) : templates.length === 0 ? (
              <div className="ajserai-empty">
                <p>Aucun template. Créez-en un pour commencer.</p>
              </div>
            ) : (
              <div className="ajserai-grid">
                {templates.map((t) => (
                  <div key={t.id} className={`ajserai-card ${t.is_active ? 'active' : ''}`}>
                    {t.file_url && (
                      <div className="ajserai-card-img">
                        <img src={t.file_url} alt={t.name} />
                      </div>
                    )}
                    <div className="ajserai-card-body">
                      <h3>{t.name}</h3>
                      {t.is_active && <span className="ajserai-badge">Actif</span>}
                    </div>
                    <div className="ajserai-card-actions">
                      {!t.is_active && (
                        <button className="ag-btn ag-btn-sm ag-btn-primary" onClick={() => handleActivate(t.id)}>Activer</button>
                      )}
                      <button className="ag-btn ag-btn-sm ag-btn-ghost" onClick={() => openEdit(t)}>Modifier</button>
                      <button className="ag-btn ag-btn-sm ag-btn-danger" onClick={() => setConfirm({ id: t.id, message: 'Supprimer ce template ?' })}>Supprimer</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        ) : (
          <TicketsTab key="tickets" />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {confirm && (
          <ConfirmModal message={confirm.message} onConfirm={() => handleDelete(confirm.id)} onCancel={() => setConfirm(null)} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {panelOpen && (
          <motion.div className="ajserai-panel-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={closePanel}>
            <motion.div className="ajserai-panel" initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 200 }} onClick={(e) => e.stopPropagation()}>
              <div className="ajserai-panel-header">
                <h2>{editing ? 'Modifier le template' : 'Nouveau template'}</h2>
                <button className="ajserai-panel-close" onClick={closePanel}>×</button>
              </div>

              <div className="ajserai-panel-body">
                <div className="ag-form-group">
                  <label className="ag-label">Nom</label>
                  <input className="ag-input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Nom du template" />
                </div>

                <div className="ag-form-group">
                  <label className="ag-label">Image du template</label>
                  <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleFileChange} style={{ display: 'none' }} />
                  <button className="ag-btn ag-btn-ghost" onClick={() => fileInputRef.current?.click()}>
                    {form.template ? 'Fichier sélectionné' : 'Choisir un fichier'}
                  </button>
                  {previewUrl && (
                    <div className="ajserai-preview-img">
                      <img src={previewUrl} alt="Aperçu" />
                    </div>
                  )}
                </div>

                <div className="ag-form-group">
                  <label className="ag-label">Image du masque (optionnel)</label>
                  <input ref={maskInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleMaskChange} style={{ display: 'none' }} />
                  <button className="ag-btn ag-btn-ghost" onClick={() => maskInputRef.current?.click()}>
                    {form.mask ? 'Fichier sélectionné' : 'Choisir un masque'}
                  </button>
                  <small style={{ color: 'var(--ag-text-3)', fontSize: '0.75rem', marginTop: '0.3rem', display: 'block' }}>
                    Le masque est superposé par-dessus la photo pour créer l'effet de cadre.
                  </small>
                  {maskPreviewUrl && (
                    <div className="ajserai-preview-img">
                      <img src={maskPreviewUrl} alt="Aperçu masque" />
                    </div>
                  )}
                </div>

                <OverlayEditor
                  templateUrl={previewUrl}
                  maskUrl={maskPreviewUrl}
                  overlayConfig={form.overlayConfig}
                  onChange={(json) => setForm((f) => ({ ...f, overlayConfig: json }))}
                />

                <div className="ag-form-group">
                  <label className="ag-label">Configuration des overlays (JSON)</label>
                  <textarea className="ag-input ag-textarea" value={form.overlayConfig} onChange={(e) => setForm((f) => ({ ...f, overlayConfig: e.target.value }))} rows={12} placeholder='{"photo":{"x":100,"y":250,"width":400,"height":500},"first_name":{"x":300,"y":100,"font_size":48,"font_color":"d4af37","align":"center","valign":"middle"},"phone":{"x":100,"y":800,"font_size":24,"font_color":"ffffff"},"email":{"x":100,"y":840,"font_size":20,"font_color":"cccccc"}}' />
                  <small style={{ color: 'var(--ag-text-3)', fontSize: '0.75rem', marginTop: '0.3rem', display: 'block' }}>
                    x, y, width, height pour la photo. x, y, font_size, font_color, align, valign pour le texte.
                  </small>
                </div>

                <div className="ajserai-toggle-row">
                  <label>Template actif</label>
                  <button className={`ajserai-toggle ${form.isActive ? 'on' : ''}`} onClick={() => setForm((f) => ({ ...f, isActive: !f.isActive }))}>
                    <span className="ajserai-toggle-knob" />
                  </button>
                </div>
              </div>

              <div className="ajserai-panel-footer">
                <button className="ag-btn ag-btn-ghost" onClick={closePanel}>Annuler</button>
                <button className="ag-btn ag-btn-primary" onClick={handleSave} disabled={saving}>
                  {saving ? 'Sauvegarde...' : editing ? 'Mettre à jour' : 'Créer'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const TicketsTab = () => {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [confirm, setConfirm] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [posterModal, setPosterModal] = useState(null);
  const [downloadingUuid, setDownloadingUuid] = useState(null);

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput), 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    loadTickets();
  }, [statusFilter, search]);

  const loadTickets = async () => {
    setLoading(true);
    try {
      const params = {};
      if (statusFilter) params.status = statusFilter;
      if (search) params.search = search;
      const data = await adminJSeraiAPI.getTickets(params);
      setTickets(Array.isArray(data?.data) ? data.data : []);
    } catch (err) {
      if (!err?.isSessionExpired) console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (uuid) => {
    setConfirm(null);
    try {
      await adminJSeraiAPI.deleteTicket(uuid);
      setFeedback({ type: 'success', message: 'Ticket supprimé.' });
      loadTickets();
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || 'Erreur lors de la suppression.' });
    }
  };

  const handleDownload = async (ticket) => {
    setDownloadingUuid(ticket.uuid);
    try {
      const result = await adminJSeraiAPI.downloadTicket(ticket.uuid);
      const url = URL.createObjectURL(result.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = result.filename || `j-y-serai-${ticket.first_name}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || 'Erreur lors du téléchargement.' });
    } finally {
      setDownloadingUuid(null);
    }
  };

  const formatDate = (d) => d ? new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

  return (
    <motion.div key="tickets" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      {feedback && (
        <div className={`ajserai-banner ajserai-banner-${feedback.type}`} style={{ marginBottom: '1rem' }}>
          <span>{feedback.message}</span>
          <button onClick={() => setFeedback(null)}>×</button>
        </div>
      )}

      <div style={{ marginBottom: '1rem', display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          className="ag-input"
          style={{ width: 260 }}
          placeholder="Rechercher par nom ou UUID..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
        <select className="ag-input" style={{ width: 'auto' }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">Tous les statuts</option>
          <option value="draft">Brouillon</option>
          <option value="completed">Terminé</option>
          <option value="downloaded">Téléchargé</option>
        </select>
      </div>

      {loading ? (
        <div className="loading-container"><span className="ag-spinner" /> Chargement...</div>
      ) : tickets.length === 0 ? (
        <div className="ajserai-empty"><p>Aucun ticket trouvé.</p></div>
      ) : (
        <div className="ajserai-table-wrap">
          <table className="ag-table">
            <thead>
              <tr>
                <th>Affiche</th>
                <th>Nom</th>
                <th>Téléphone</th>
                <th>Statut</th>
                <th>Téléchargé le</th>
                <th>Créé le</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((t) => (
                <tr key={t.uuid}>
                  <td>
                    {t.poster_url ? (
                      <div
                        className="ajserai-poster-thumb"
                        onClick={() => setPosterModal(t)}
                        style={{
                          width: 50,
                          height: 60,
                          borderRadius: 4,
                          overflow: 'hidden',
                          cursor: 'pointer',
                          border: '1px solid var(--ag-border)',
                          flexShrink: 0,
                        }}
                      >
                        <img src={t.poster_url} alt="Affiche" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </div>
                    ) : t.photo_url ? (
                      <div
                        style={{
                          width: 50,
                          height: 60,
                          borderRadius: 4,
                          overflow: 'hidden',
                          border: '1px solid var(--ag-border)',
                          flexShrink: 0,
                        }}
                      >
                        <img src={t.photo_url} alt="Photo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </div>
                    ) : (
                      <span style={{ color: 'var(--ag-text-3)', fontSize: '0.8rem' }}>—</span>
                    )}
                  </td>
                  <td>
                    <strong>{t.first_name} {t.last_name}</strong>
                  </td>
                  <td style={{ color: 'var(--ag-text-2)', fontSize: '0.85rem' }}>{t.phone || '—'}</td>
                  <td>
                    <span className={`ajserai-status ajserai-status-${t.status}`}>
                      {t.status === 'draft' ? 'Brouillon' : t.status === 'completed' ? 'Terminé' : 'Téléchargé'}
                    </span>
                  </td>
                  <td style={{ fontSize: '0.8rem', color: 'var(--ag-text-2)' }}>{t.downloaded_at ? formatDate(t.downloaded_at) : '—'}</td>
                  <td style={{ fontSize: '0.8rem', color: 'var(--ag-text-2)' }}>{formatDate(t.created_at)}</td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'flex-end' }}>
                      {t.poster_url && (
                        <button
                          className="ag-btn ag-btn-sm ag-btn-ghost"
                          onClick={() => setPosterModal(t)}
                          title="Voir l'affiche"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                        </button>
                      )}
                      {!t.poster_url && t.photo_url && (
                        <button
                          className="ag-btn ag-btn-sm ag-btn-ghost"
                          onClick={() => setPosterModal({ ...t, poster_url: t.photo_url })}
                          title="Voir la photo"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                        </button>
                      )}
                      <button
                        className="ag-btn ag-btn-sm ag-btn-primary"
                        onClick={() => handleDownload(t)}
                        disabled={downloadingUuid === t.uuid}
                        title="Télécharger l'affiche"
                      >
                        {downloadingUuid === t.uuid ? '...' : (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
                        )}
                      </button>
                      <button
                        className="ag-btn ag-btn-sm ag-btn-danger"
                        onClick={() => setConfirm({ uuid: t.uuid, message: `Supprimer l'affiche de ${t.first_name} ${t.last_name} ?` })}
                        title="Supprimer"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AnimatePresence>
        {confirm && (
          <ConfirmModal message={confirm.message} onConfirm={() => handleDelete(confirm.uuid)} onCancel={() => setConfirm(null)} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {posterModal && (
          <motion.div
            className="ajserai-confirm-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setPosterModal(null)}
          >
            <motion.div
              style={{
                maxWidth: '90vw',
                maxHeight: '90vh',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '1rem',
              }}
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                <h3 style={{ color: '#fff', margin: 0, fontSize: '1rem' }}>
                  {posterModal.first_name} {posterModal.last_name}
                  {posterModal.poster_url && (
                    <span style={{ fontSize: '0.75rem', fontWeight: 400, marginLeft: '0.5rem', opacity: 0.6 }}>(Affiche)</span>
                  )}
                  {!posterModal.poster_url && (
                    <span style={{ fontSize: '0.75rem', fontWeight: 400, marginLeft: '0.5rem', opacity: 0.6 }}>(Photo)</span>
                  )}
                </h3>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button className="ag-btn ag-btn-sm ag-btn-primary" onClick={() => handleDownload(posterModal)}>
                    Télécharger
                  </button>
                  <button className="ag-btn ag-btn-sm ag-btn-ghost" onClick={() => setPosterModal(null)} style={{ color: '#fff' }}>
                    Fermer
                  </button>
                </div>
              </div>
              <img
                src={posterModal.poster_url}
                alt={`Affiche de ${posterModal.first_name}`}
                style={{ maxWidth: '100%', maxHeight: '80vh', borderRadius: 8, boxShadow: '0 8px 40px rgba(0,0,0,0.6)' }}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default AdminJSerai;
