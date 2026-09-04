// Saga login screen — a split-panel sign-in window matching the design reference.
// Left: editorial "manuscript" panel with wash background and display serif text.
// Right: quiet underline-only form fields with entrance animation.
import { useState, useRef, useEffect } from 'react';
import type { OnyxState } from '../state/onyx';
import { login, saveToken, loginWithApiKey } from '../api/abs';
import Titlebar from '../components/chrome/Titlebar';
import lyreIcon from '../assets/lyre.png';
import { errorMessage } from '../lib/presentError';
import { log } from '../lib/log';

// Typography constants matching the Saga design tokens
const SERIF = '"Source Serif 4", "Source Serif Pro", "Noto Serif SC", Georgia, serif';
const MONO = "'JetBrains Mono', ui-monospace, monospace";
const SANS = "'Inter', system-ui, -apple-system, sans-serif";

export interface LoginProps {
  // The global app state — needed to persist token and navigate after login
  st: OnyxState;
}

export default function Login({ st }: LoginProps) {
  // ── Form state (local only — never touches global state until submit succeeds) ──
  const lastServer = (() => {
    try { return new URL(localStorage.getItem('skald.lastServerUrl') ?? ''); } catch { return null; }
  })();
  const [scheme, setScheme] = useState<'http' | 'https'>(() => lastServer?.protocol === 'https:' ? 'https' : 'http');
  const [host, setHost] = useState(() => lastServer?.host ?? '');
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');
  const [schemeOpen, setSchemeOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [method, setMethod] = useState<'password' | 'apikey'>('apikey');
  const [apiKey, setApiKey] = useState('');

  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!schemeOpen) return;
    const onDown = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setSchemeOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [schemeOpen]);

  // ── Submit handler ──────────────────────────────────────────────────────────
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!host.trim()) return setError('请输入服务器地址');
    const serverUrl = `${scheme}://${host.trim()}`;

    // ── API key method ──────────────────────────────────────────────────────
    if (method === 'apikey') {
      if (!apiKey.trim()) return setError('请输入 API 密钥');
      setError('');
      setPending(true);
      try {
        const result = await loginWithApiKey(serverUrl, apiKey.trim());
        await saveToken(result.token);
        localStorage.setItem('skald.lastServerUrl', serverUrl);
        st.setAuthToken(result.token);
        st.setServerUrl(serverUrl);
        st.setUserId(result.user.id);
        st.setUsername(result.user.username);
        st.setUser(result.user);
        if (result.serverSettings) st.setServerSettings(result.serverSettings);
        st.setScreen('library');
      } catch (err) {
        log.warn('auth', 'api key sign-in failed', { err: String(err) });
        setError(errorMessage(err, { operation: 'authenticate', credential: 'api-key' }));
        setPending(false);
      }
      return;
    }

    // ── Password method ─────────────────────────────────────────────────────
    if (!user.trim()) return setError('请输入用户名');
    if (!pass) return setError('请输入密码');
    setError('');
    setPending(true);
    try {
      const { user: loggedInUser, serverSettings } = await login(serverUrl, user.trim(), pass);
      if (serverSettings) st.setServerSettings(serverSettings);
      localStorage.setItem('skald.lastServerUrl', serverUrl);
      st.setAuthToken(loggedInUser.token);
      st.setServerUrl(serverUrl);
      st.setUserId(loggedInUser.id);
      st.setUsername(loggedInUser.username);
      st.setUser(loggedInUser);
      st.setScreen('library');
    } catch (err) {
      log.warn('auth', 'password sign-in failed', { err: String(err) });
      setError(errorMessage(err, { operation: 'authenticate', credential: 'password' }));
      setPending(false);
    }
  };

  // Shared underline-only input style
  const underline: React.CSSProperties = {
    width: '100%',
    boxSizing: 'border-box',
    background: 'transparent',
    border: 'none',
    borderBottom: '1px solid rgba(255,255,255,0.12)',
    outline: 'none',
    color: '#ebe7df',
    fontSize: 16,
    fontFamily: SERIF,
    padding: '0 0 9px',
    letterSpacing: '0.01em',
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      display: 'flex',
      overflow: 'hidden',
      background: '#0b0b0e',
      color: '#ebe7df',
      fontFamily: SANS,
    }}>
      <Titlebar isDark minimal />

      {/* ── LEFT PANEL — 268px manuscript column ───────────────────────── */}
      <div style={{
        position: 'relative',
        width: 268,
        flexShrink: 0,
        overflow: 'hidden',
        borderRight: '1px solid rgba(var(--onyx-accent-r),var(--onyx-accent-g),var(--onyx-accent-b),0.35)',
      }}>
        <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: '#0b0b0e', pointerEvents: 'none' }}>
          <div style={{ position: 'absolute', left: '-15%', top: '-25%', width: '70%', height: '120%', background: 'radial-gradient(50% 50% at 50% 50%, rgba(var(--onyx-accent-r),var(--onyx-accent-g),var(--onyx-accent-b),0.196), transparent 65%)', filter: 'blur(90px)' }} />
          <div style={{ position: 'absolute', right: '-10%', top: '20%', width: '60%', height: '80%', background: 'radial-gradient(50% 50% at 50% 50%, rgba(var(--onyx-accent-r),var(--onyx-accent-g),var(--onyx-accent-b),0.112), transparent 60%)', filter: 'blur(110px)' }} />
          <div style={{ position: 'absolute', left: '20%', bottom: '-30%', width: '70%', height: '90%', background: 'radial-gradient(50% 50% at 50% 50%, rgba(60,40,20,0.6), transparent 65%)', filter: 'blur(120px)' }} />
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,0.15), rgba(0,0,0,0.55))' }} />
          <div style={{ position: 'absolute', inset: 0, opacity: 0.05, mixBlendMode: 'overlay', backgroundImage: 'repeating-radial-gradient(circle at 13% 27%, rgba(255,255,255,0.6) 0 0.5px, transparent 0.5px 3px), repeating-radial-gradient(circle at 73% 67%, rgba(255,255,255,0.5) 0 0.5px, transparent 0.5px 3px)' }} />
        </div>
        <div style={{ position: 'absolute', inset: 0, opacity: 0.5, mixBlendMode: 'soft-light', pointerEvents: 'none', background: 'radial-gradient(120% 80% at 0% 0%, rgba(var(--onyx-accent-r),var(--onyx-accent-g),var(--onyx-accent-b),0.35), transparent 55%)' }} />

        <div style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '54px 30px 30px' }}>
          <div>
            <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.28em', textTransform: 'uppercase', color: 'var(--onyx-accent)' }}>
              Skald
            </div>
            <div style={{ width: 26, height: 1, background: 'rgba(var(--onyx-accent-r),var(--onyx-accent-g),var(--onyx-accent-b),0.35)', margin: '16px 0 18px' }} />
            <div style={{ fontFamily: SERIF, fontSize: 33, lineHeight: 1.14, fontWeight: 600, letterSpacing: '-0.015em', color: '#ebe7df' }}>
              讲述者<br />重返
              <span style={{ fontStyle: 'italic', color: 'var(--onyx-accent)' }}>殿堂</span>
            </div>
          </div>

          <div style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px 0',
          }}>
            <img
              src={lyreIcon}
              alt="Skald"
              style={{
                width: 200,
                height: 200,
                objectFit: 'contain',
                opacity: 0.85,
                filter: 'drop-shadow(0 0 18px rgba(var(--onyx-accent-r), var(--onyx-accent-g), var(--onyx-accent-b), 0.35))',
              }}
            />
          </div>

          <div style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: 13, lineHeight: 1.55, color: 'rgba(235,231,223,0.62)', maxWidth: 200 }}>
            "你珍藏的故事都在此等候——声韵犹在，随时待续。"
            <div style={{ fontStyle: 'normal', fontFamily: MONO, fontSize: 9.5, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(235,231,223,0.38)', marginTop: 14 }}>
              — 守书人寄语
            </div>
          </div>
        </div>
      </div>

      {/* ── RIGHT PANEL — form, with saga-in entrance animation ─────────── */}
      <form
        onSubmit={submit}
        className="saga-in"
        style={{
          position: 'relative',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '54px 44px 40px',
          zIndex: 10,
        }}
      >
        <div style={{ marginBottom: 30 }}>
          <div style={{ fontFamily: SERIF, fontSize: 27, fontWeight: 600, letterSpacing: '-0.01em', color: '#ebe7df' }}>
            进入殿堂
          </div>
          <div style={{ fontSize: 13, fontFamily: SANS, color: 'rgba(235,231,223,0.62)', marginTop: 6 }}>
            连接你的书库服务器以继续
          </div>
        </div>

        <div style={{ display: 'flex', marginBottom: 24 }}>
          <div style={{
            display: 'flex',
            borderRadius: 999,
            border: '1px solid rgba(var(--onyx-accent-r),var(--onyx-accent-g),var(--onyx-accent-b),0.25)',
            overflow: 'hidden',
          }}>
            {(['apikey', 'password'] as const).map(m => (
              <button
                key={m}
                type="button"
                onClick={() => { setMethod(m); setError(''); }}
                style={{
                  background: method === m ? 'rgba(var(--onyx-accent-r),var(--onyx-accent-g),var(--onyx-accent-b),0.15)' : 'transparent',
                  border: 'none',
                  color: method === m ? 'var(--onyx-accent)' : 'rgba(235,231,223,0.38)',
                  fontFamily: MONO,
                  fontSize: 10,
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  padding: '5px 16px',
                  cursor: 'pointer',
                  transition: 'background 0.15s, color 0.15s',
                }}
              >
                {m === 'password' ? '密码' : 'API 密钥'}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

          {/* ── Field 1: Server URL ── */}
          <label style={{ display: 'block' }}>
            <div style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: 13, color: 'rgba(235,231,223,0.62)', marginBottom: 7 }}>
              服务器在哪里？
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12 }}>
              <div ref={dropdownRef} style={{ position: 'relative', flexShrink: 0 }}>
                <button
                  type="button"
                  onClick={() => setSchemeOpen(o => !o)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    borderBottom: '1px solid rgba(255,255,255,0.12)',
                    color: 'var(--onyx-accent)',
                    fontFamily: SERIF,
                    fontSize: 16,
                    padding: '0 4px 9px 0',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  {scheme}://
                  <span style={{
                    fontSize: 10,
                    color: 'rgba(235,231,223,0.38)',
                    display: 'inline-block',
                    transform: schemeOpen ? 'rotate(180deg)' : 'none',
                    transition: 'transform 0.15s',
                  }}>▾</span>
                </button>
                {schemeOpen && (
                  <div style={{
                    position: 'absolute',
                    top: 'calc(100% + 6px)',
                    left: 0,
                    background: '#1a1a22',
                    border: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: 8,
                    boxShadow: '0 16px 32px rgba(0,0,0,0.5)',
                    padding: 5,
                    zIndex: 30,
                    minWidth: 132,
                  }}>
                    {(['https', 'http'] as const).map(s => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => { setScheme(s); setSchemeOpen(false); }}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: 12,
                          width: '100%',
                          textAlign: 'left',
                          background: s === scheme ? 'rgba(var(--onyx-accent-r),var(--onyx-accent-g),var(--onyx-accent-b),0.18)' : 'transparent',
                          border: 'none',
                          borderRadius: 5,
                          padding: '8px 10px',
                          cursor: 'pointer',
                          fontFamily: SERIF,
                          fontSize: 14,
                          color: s === scheme ? 'var(--onyx-accent)' : '#ebe7df',
                        }}
                      >
                        {s}://
                        <span style={{ fontFamily: MONO, fontSize: 9, color: 'rgba(235,231,223,0.38)', letterSpacing: '0.06em' }}>
                          {s === 'http' ? '明文' : '加密'}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <input
                className="saga-input"
                style={{ ...underline, flex: 1 }}
                value={host}
                onChange={e => setHost(e.target.value)}
                placeholder="library.example.com 或 192.168.1.20:13378"
                spellCheck={false}
              />
            </div>
          </label>

          {method === 'password' ? (
            <>
              <label style={{ display: 'block' }}>
                <div style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: 13, color: 'rgba(235,231,223,0.62)', marginBottom: 7 }}>
                  你的用户名是？
                </div>
                <input
                  className="saga-input"
                  style={underline}
                  value={user}
                  onChange={e => setUser(e.target.value)}
                  placeholder="用户名"
                  spellCheck={false}
                />
              </label>
              <label style={{ display: 'block' }}>
                <div style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: 13, color: 'rgba(235,231,223,0.62)', marginBottom: 7 }}>
                  密码
                </div>
                <input
                  className="saga-input"
                  style={underline}
                  type="password"
                  value={pass}
                  onChange={e => setPass(e.target.value)}
                  placeholder="••••••••••"
                />
              </label>
            </>
          ) : (
            <label style={{ display: 'block' }}>
              <div style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: 13, color: 'rgba(235,231,223,0.62)', marginBottom: 7 }}>
                你的 API 密钥
              </div>
              <textarea
                className="saga-input"
                rows={3}
                style={{
                  ...underline,
                  fontFamily: MONO,
                  fontSize: 11,
                  letterSpacing: '0.03em',
                  resize: 'none',
                  lineHeight: 1.6,
                  paddingTop: 4,
                }}
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                placeholder="在此粘贴你的 API 密钥"
                spellCheck={false}
                autoComplete="off"
              />
              <div style={{ fontFamily: SANS, fontSize: 11, color: 'rgba(235,231,223,0.35)', marginTop: 8 }}>
                在 Audiobookshelf 网页端「设置 → 用户 → API 密钥」中生成。
              </div>
            </label>
          )}
        </div>

        {error && (
          <div style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: 13, color: '#f1a89a', marginTop: 18 }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginTop: 32 }}>
          <button
            type="submit"
            disabled={pending}
            className="saga-cta"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              background: 'linear-gradient(180deg, #e9bb5e, #d4a64a 55%, #a37d2e)',
              border: '1px solid rgba(var(--onyx-accent-r),var(--onyx-accent-g),var(--onyx-accent-b),0.35)',
              borderRadius: 999,
              color: '#1a1306',
              fontFamily: SERIF,
              fontWeight: 600,
              fontSize: 15,
              padding: '11px 28px',
              cursor: pending ? 'wait' : 'pointer',
              letterSpacing: '0.01em',
              boxShadow: '0 8px 24px rgba(var(--onyx-accent-r),var(--onyx-accent-g),var(--onyx-accent-b),0.22), inset 0 1px 0 rgba(255,255,255,0.2)',
              transition: 'transform 0.12s, box-shadow 0.18s, filter 0.12s',
            }}
          >
            {pending ? '正在连接…' : '进入'}
            <span className="saga-arrow" style={{ display: 'flex', transition: 'transform 0.2s' }}>→</span>
          </button>

          <button
            type="button"
            onClick={() => { st.setLocalMode(true); st.setScreen('library'); }}
            style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              fontFamily: SERIF, fontStyle: 'italic', fontSize: 13,
              color: 'rgba(235,231,223,0.62)', padding: '6px 4px', textDecoration: 'underline',
              textUnderlineOffset: 3, textDecorationColor: 'rgba(235,231,223,0.25)',
            }}
          >
            本地使用，无需服务器
          </button>
        </div>
      </form>
    </div>
  );
}
