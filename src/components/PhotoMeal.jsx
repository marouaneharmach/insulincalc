import { useState, useRef } from 'react';
import { recognizeFood, mapToLocalFoods, compressImage } from '../utils/foodRecognition.js';

export default function PhotoMeal({ allFoods, toggleFood, t, colors, theme }) {
  const cc = colors || {};
  const isDark = theme === 'dark' || !theme;
  const [status, setStatus] = useState('idle');
  const [results, setResults] = useState([]);
  const [error, setError] = useState('');
  const [photoPreview, setPhotoPreview] = useState(null);
  const fileRef = useRef(null);

  const handlePhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const compressed = await compressImage(file, 400);
    setPhotoPreview(URL.createObjectURL(compressed));
    setStatus('loading');
    setError('');

    try {
      const foodResults = await recognizeFood(file);
      const mapped = mapToLocalFoods(foodResults, allFoods);
      setResults(mapped);
      setStatus('results');
    } catch (err) {
      console.error('[PhotoMeal]', err);
      if (err.message === 'CLARIFAI_NOT_CONFIGURED') {
        setError(t('photoNonConfiguree'));
      } else {
        setError(t('photoErreur'));
      }
      setStatus('error');
    }
  };

  const addFood = (item) => {
    if (item.localFood) toggleFood(item.localFood);
  };

  const reset = () => {
    setStatus('idle');
    setResults([]);
    setError('');
    setPhotoPreview(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const card = {
    background: cc.card, border: `1px solid ${cc.border}`, borderRadius: 14,
    padding: 16, marginBottom: 12,
  };

  return (
    <div style={card}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ fontSize: 12, letterSpacing: 2, color: '#a855f7', textTransform: 'uppercase' }}>
          📷 {t('photoRepas')}
        </div>
        {status !== 'idle' && (
          <button onClick={reset} style={{
            background: 'none', border: 'none', color: cc.muted, cursor: 'pointer',
            fontFamily: "'IBM Plex Mono',monospace", fontSize: 11,
          }}>✕ {t('annuler')}</button>
        )}
      </div>

      {/* Idle — camera buttons */}
      {status === 'idle' && (
        <label style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          padding: '20px 14px', borderRadius: 12, cursor: 'pointer', transition: 'all 0.15s',
          border: `2px dashed ${isDark ? '#334155' : '#cbd5e1'}`,
          background: isDark ? '#0a1520' : '#f8fafc',
        }}>
          <span style={{ fontSize: 32, marginBottom: 8 }}>📸</span>
          <span style={{ fontSize: 13, color: isDark ? '#8aa8bd' : '#475569', fontWeight: 500 }}>
            {t('prendrePhoto')}
          </span>
          <span style={{ fontSize: 11, color: cc.muted, marginTop: 4 }}>
            {t('iaReconnaitraAliments')}
          </span>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handlePhoto}
            style={{ display: 'none' }}
          />
        </label>
      )}

      {/* Loading */}
      {status === 'loading' && (
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          {photoPreview && (
            <img src={photoPreview} alt="" style={{
              width: 120, height: 120, objectFit: 'cover', borderRadius: 14,
              margin: '0 auto 12px', display: 'block',
              border: `2px solid #a855f7`,
            }} />
          )}
          <div style={{
            width: 28, height: 28, border: '3px solid #a855f7', borderTopColor: 'transparent',
            borderRadius: '50%', margin: '0 auto 10px',
            animation: 'spin 0.8s linear infinite',
          }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <div style={{ fontSize: 13, color: '#a855f7' }}>
            🔍 {t('analyseEnCours')}
          </div>
          <div style={{ fontSize: 11, color: cc.muted, marginTop: 4 }}>
            {t('identificationIA')}
          </div>
        </div>
      )}

      {/* Error */}
      {status === 'error' && (
        <div style={{ textAlign: 'center', padding: '16px 0' }}>
          {photoPreview && (
            <img src={photoPreview} alt="" style={{
              width: 90, height: 90, objectFit: 'cover', borderRadius: 12,
              margin: '0 auto 10px', display: 'block', opacity: 0.6,
            }} />
          )}
          <div style={{ fontSize: 13, color: '#ef4444', marginBottom: 10 }}>❌ {error}</div>
          <button onClick={reset} style={{
            padding: '8px 18px', borderRadius: 10, border: 'none', cursor: 'pointer',
            background: '#a855f7', color: '#fff', fontSize: 12,
            fontFamily: "'IBM Plex Mono',monospace",
          }}>🔄 {t('reessayer')}</button>
        </div>
      )}

      {/* Results */}
      {status === 'results' && (
        <div>
          {photoPreview && (
            <img src={photoPreview} alt="" style={{
              width: '100%', height: 160, objectFit: 'cover', borderRadius: 12,
              marginBottom: 12,
            }} />
          )}

          <div style={{ fontSize: 11, color: cc.muted, marginBottom: 8 }}>
            {results.length} {results.length > 1 ? t('alimentsDetectes') : t('alimentDetecte')} — {t('tapPourAjouter')}
          </div>

          {results.map((item, i) => (
            <button
              key={i}
              onClick={() => addFood(item)}
              disabled={!item.mapped}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 12px', marginBottom: 4, borderRadius: 10,
                background: item.mapped ? (isDark ? '#0a1520' : '#f0fdfa') : (isDark ? '#0d1117' : '#f8fafc'),
                border: `1px solid ${item.mapped ? `${cc.accent}44` : cc.border}`,
                cursor: item.mapped ? 'pointer' : 'default',
                opacity: item.mapped ? 1 : 0.5,
                fontFamily: "'IBM Plex Mono',monospace", textAlign: 'left',
                transition: 'all 0.12s',
              }}
            >
              {/* Confidence badge */}
              <div style={{
                width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 700,
                background: item.confidence >= 80 ? 'rgba(34,197,94,0.12)' : item.confidence >= 50 ? 'rgba(245,158,11,0.12)' : 'rgba(148,163,184,0.12)',
                color: item.confidence >= 80 ? '#22c55e' : item.confidence >= 50 ? '#f59e0b' : '#94a3b8',
                border: `1px solid ${item.confidence >= 80 ? 'rgba(34,197,94,0.3)' : item.confidence >= 50 ? 'rgba(245,158,11,0.3)' : 'rgba(148,163,184,0.3)'}`,
              }}>
                {item.confidence}%
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: isDark ? '#c8d6e5' : '#334155', textTransform: 'capitalize' }}>
                  {item.nameFr || item.name}
                </div>
                {item.mapped ? (
                  <div style={{ fontSize: 11, color: cc.accent, marginTop: 2 }}>
                    → {item.localFood.name} ({item.localFood.carbs}g {t('glucidesUnit')})
                  </div>
                ) : (
                  <div style={{ fontSize: 11, color: cc.muted, marginTop: 2 }}>
                    {item.name} — {t('nonTrouveDansBase')}
                  </div>
                )}
              </div>

              {item.mapped && (
                <span style={{ fontSize: 13, fontWeight: 700, color: cc.accent, flexShrink: 0 }}>
                  + {item.localFood.carbs}g
                </span>
              )}
            </button>
          ))}

          {/* Another photo */}
          <button onClick={reset} style={{
            width: '100%', padding: 10, marginTop: 8, borderRadius: 10,
            border: `1px solid ${cc.border}`, cursor: 'pointer',
            background: isDark ? '#0d1117' : '#f1f5f9',
            color: cc.muted, fontSize: 12,
            fontFamily: "'IBM Plex Mono',monospace",
          }}>
            📷 {t('autrePhoto')}
          </button>
        </div>
      )}
    </div>
  );
}
