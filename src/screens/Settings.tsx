import { useState, useEffect } from 'react';
import type { OnyxState } from '../state/onyx';
import { logout } from '../api/abs';
import Glass from '../components/chrome/Glass';
import Icon from '../components/Icon';
import type { IconName } from '../components/Icon';
import { matchesSettingsSearch } from '../lib/settingsSearch';
import {
  AccountSection,
  ServerSection,
  PlaybackSection,
  AudioSection,
  LibraryManagementSection,
  DownloadsSection,
  AppearanceSection,
  KeyboardSection,
  AboutSection,
  NotificationsSection,
  BackupSection,
  ScheduledTasksSection,
  LogsSection,
  SharingSection,
} from '../components/settings';

const MONO = "'JetBrains Mono', ui-monospace, monospace";

export interface SettingsProps { st: OnyxState; onLogout: () => void; }

type SectionId =

  | 'account' | 'server' | 'notifications' | 'backups' | 'scheduled-tasks' | 'logs' | 'sharing'
  | 'playback' | 'audio' | 'library' | 'downloads' | 'appearance' | 'keyboard' | 'about';

interface NavSection { id: SectionId; label: string; icon: IconName; keywords: string[]; requiresAbs?: boolean; adminOnly?: boolean; }
interface NavGroup { label: string; sections: NavSection[]; }

const NAV_GROUPS: NavGroup[] = [
  { label: '本设备', sections: [
    { id: 'account', label: '账户', icon: 'home', keywords: ['profile', 'password', 'user', 'sign out', '账户', '密码', '用户'] },
    { id: 'appearance', label: '外观', icon: 'sliders', keywords: ['theme', 'accent', 'scale', 'cover size', 'layout', 'display', 'shelf', '主题', '外观'] },
    { id: 'audio', label: '音频', icon: 'headphones', keywords: ['device', 'output', 'equalizer', 'eq', 'volume', '音频', '音量'] },
    { id: 'downloads', label: '下载', icon: 'download', keywords: ['offline', 'folder', 'storage', 'cache', 'retry', '下载', '离线'] },
    { id: 'keyboard', label: '快捷键', icon: 'kbd', keywords: ['shortcut', 'hotkey', 'keys', '快捷键'] },
  ]},
  { label: '书库', sections: [
    { id: 'library', label: '书库管理', icon: 'grid', keywords: ['local', 'staging', 'import', 'scan', 'provider', 'open library', '书库', '导入'] },
    { id: 'playback', label: '播放', icon: 'play', keywords: ['sleep timer', 'skip', 'speed', 'session', 'progress', 'resume', '播放', '倍速'] },
  ]},
  { label: 'Audiobookshelf 服务器', sections: [
    { id: 'server', label: '服务器', icon: 'monitor', keywords: ['sync', 'socket', 'connection', 'address', '服务器', '同步'], requiresAbs: true },
    { id: 'logs', label: '日志', icon: 'list', keywords: ['diagnostic', 'errors', 'debug', 'report', '日志'], requiresAbs: true, adminOnly: true },
    { id: 'backups', label: '备份', icon: 'file', keywords: ['restore', 'schedule', 'database', '备份'], requiresAbs: true, adminOnly: true },
    { id: 'notifications', label: '通知', icon: 'bell', keywords: ['apprise', 'alerts', 'events', '通知'], requiresAbs: true, adminOnly: true },
    { id: 'scheduled-tasks', label: '计划任务', icon: 'clock', keywords: ['jobs', 'scanner', 'maintenance', '计划任务'], requiresAbs: true, adminOnly: true },
    { id: 'sharing', label: '分享与 RSS', icon: 'share', keywords: ['feeds', 'public link', 'opds', '分享', 'RSS'], requiresAbs: true, adminOnly: true },
  ]},
  { label: '关于', sections: [
    { id: 'about', label: '关于', icon: 'info', keywords: ['help', 'quick start', 'version', 'privacy', 'troubleshooting', '关于', '帮助'] },
  ]},
];

const NAV = NAV_GROUPS.flatMap(group => group.sections);

function sectionVisible(section: NavSection, hasAbs: boolean, isAdmin: boolean): boolean {
  return !(section.requiresAbs && !hasAbs) && !(section.adminOnly && !isAdmin);
}

export default function Settings({ st, onLogout }: SettingsProps) {
  const requestedSection = NAV.some(item => item.id === st.settingsSection)
    ? st.settingsSection as SectionId
    : 'account';

  const [section, setSection] = useState<SectionId>(requestedSection);
  const [navQuery, setNavQuery] = useState('');

  const hasAbs = !!st.authToken && !!st.serverUrl;

  const visibleGroups = NAV_GROUPS
    .map(group => ({
      ...group,
      sections: group.sections.filter(item => sectionVisible(item, hasAbs, st.isAdmin) && matchesSettingsSearch(item.label, item.id, item.keywords, navQuery)),
    }))
    .filter(group => group.sections.length > 0);

  useEffect(() => {
    if (NAV.some(item => item.id === st.settingsSection)) {
      setSection(st.settingsSection as SectionId);
    }
  }, [st.settingsSection]);

  useEffect(() => {
    const nav = NAV.find(s => s.id === section);
    const hidden = !!nav && ((nav.requiresAbs && !hasAbs) || (nav.adminOnly && !st.isAdmin));
    if (hidden) setSection('account');
  }, [section, hasAbs, st.isAdmin]);

  async function handleSignOut() {
    try { await logout(); } catch { /* keyring failure is non-fatal */ }
    localStorage.removeItem('skald.hasAuth');
    localStorage.removeItem('skald.serverUrl');
    localStorage.removeItem('skald.userId');
    localStorage.removeItem('skald.username');
    localStorage.removeItem('skald.sessionId');
    localStorage.removeItem('skald.user');
    st.setLocalMode(false);
    onLogout();
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '12px 32px 24px', minHeight: 0 }}>
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18, fontFamily: MONO, fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--onyx-text-mute)' }}>
        <button
          onClick={() => st.setScreen('library')}
          style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: 'var(--onyx-text-dim)', cursor: 'pointer', padding: 4, fontFamily: 'inherit', fontSize: 'inherit', letterSpacing: 'inherit', textTransform: 'inherit' as const }}
        >
          <Icon name="chevron-left" size={12} /> 书库
        </button>
        <span>·</span>
        <span style={{ color: 'var(--onyx-text)' }}>设置</span>
      </div>

      <div style={{ flex: 1, display: 'flex', gap: 24, minHeight: 0 }}>
        <Glass translucent={st.translucent} style={{ width: 260, padding: '20px 14px', display: 'flex', flexDirection: 'column', flexShrink: 0, minHeight: 0, overflowY: 'auto' }}>
          <input
            value={navQuery}
            onChange={e => setNavQuery(e.target.value)}
            placeholder="搜索设置…"
            aria-label="搜索设置"
            style={{ margin: '0 8px 14px', padding: '8px 10px', borderRadius: 7, border: '1px solid var(--onyx-glass-edge)', background: 'var(--onyx-glass)', color: 'var(--onyx-text)', fontFamily: 'inherit', fontSize: 12 }}
          />
          {visibleGroups.map((group, groupIndex) => (
            <div key={group.label} style={{ marginTop: groupIndex === 0 ? 0 : 14 }}>
              <div style={{ padding: '0 12px 6px', fontFamily: MONO, fontSize: 8.5, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--onyx-text-mute)' }}>
                {group.label}
              </div>
              {group.sections.map(s => {
                const downloadCount = s.id === 'downloads' ? st.downloads.length : 0;
                const label = downloadCount > 0 ? `${s.label} (${downloadCount})` : s.label;
                return (
                  <button
                    key={s.id}
                    onClick={() => { setSection(s.id); st.setSettingsSection(s.id); }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '9px 12px', borderRadius: 8,
                      background: section === s.id ? 'var(--onyx-accent-dim)' : 'transparent',
                      border: `1px solid ${section === s.id ? 'var(--onyx-accent-edge)' : 'transparent'}`,
                      cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' as const,
                      color: section === s.id ? 'var(--onyx-accent)' : 'var(--onyx-text)',
                      fontSize: 13, fontWeight: section === s.id ? 500 : 400,
                      marginBottom: 2,
                    }}
                  >
                    <Icon name={s.icon} size={14} color={section === s.id ? 'var(--onyx-accent)' : 'var(--onyx-text-dim)'} />
                    {label}
                  </button>
                );
              })}
            </div>
          ))}
          <div style={{ flex: 1 }} />
        </Glass>

        {/* Content panel */}
        <Glass translucent={st.translucent} style={{ flex: 1, padding: '28px 36px', overflow: 'auto', minWidth: 0 }}>
          {section === 'account' && <AccountSection st={st} onSignOut={handleSignOut} />}
          {section === 'server' && <ServerSection st={st} />}
          {section === 'notifications' && <NotificationsSection st={st} />}
          {section === 'backups' && <BackupSection st={st} />}
          {section === 'scheduled-tasks' && <ScheduledTasksSection st={st} />}
          {section === 'logs' && <LogsSection st={st} />}
          {section === 'sharing' && <SharingSection st={st} />}
          {section === 'playback' && <PlaybackSection st={st} />}
          {section === 'audio' && <AudioSection />}
          {section === 'library' && <LibraryManagementSection st={st} />}
          {section === 'downloads' && <DownloadsSection st={st} />}
          {section === 'appearance' && <AppearanceSection st={st} />}
          {section === 'keyboard' && <KeyboardSection />}
          {section === 'about' && <AboutSection st={st} />}
        </Glass>
      </div>
    </div>
  );
}
