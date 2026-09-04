// 播客详情页（集群 E）。展示播客头部信息及完整的已发布单集列表
// （打开时从实时订阅源解析，并与已下载单集合并）。已下载的单集可直接播放；
// 未下载的单集会打开播放器并进入"先下载再播放"流程。
// "下载…"选择器可批量将尚未下载的单集加入下载队列。
// 通过 PodcastBrowse 调用 setScreen('podcast') 进入此页面。
import { useState, useEffect } from 'react';
import type { OnyxState, LibraryItem } from '../state/onyx';
import { fmtRemaining, fmtTime } from '../state/onyx';
import { asPodcastItem, fetchItem, type PodcastEpisode, type RecentEpisode } from '../api/abs';
import { resolvePodcastFeed, cachedFeedEpisodes, cachedPodcastImage, episodeKey } from '../lib/podcastCover';
import { playEpisode, togglePlayback } from '../api/playbook';
import { log } from '../lib/log';
import Cover from '../components/Cover';
import Icon from '../components/Icon';
import ContextMenu from '../components/ContextMenu';
import PlaylistPicker from '../components/PlaylistPicker';
import PodcastSettingsModal from '../components/podcast/PodcastSettingsModal';
import PodcastDownloadModal from '../components/podcast/PodcastDownloadModal';
import { buildEpisodeContextMenu } from '../components/podcast/buildEpisodeContextMenu';
import type { EpisodeDirection } from '../lib/upNext';
import { episodeDirection, setEpisodeDirection } from '../lib/upNextPrefs';

export interface PodcastDetailProps {
  st: OnyxState;
}

function episodeDate(ep: PodcastEpisode): string {
  const d = ep.publishedAt ? new Date(ep.publishedAt) : ep.pubDate ? new Date(ep.pubDate) : null;
  if (!d || isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function episodeTime(ep: PodcastEpisode): number {
  if (ep.publishedAt) return ep.publishedAt;
  if (ep.pubDate) { const t = Date.parse(ep.pubDate); return isNaN(t) ? 0 : t; }
  return ep.index ?? 0;
}

export default function PodcastDetail({ st }: PodcastDetailProps) {
  const mono = "'JetBrains Mono', ui-monospace, monospace";
  const [showSettings, setShowSettings] = useState(false);
  const [showDownload, setShowDownload] = useState(false);
  // 单集右键菜单 + 由其触发的"添加到播放列表"选择器
  const [epMenu, setEpMenu] = useState<{ x: number; y: number; ep: PodcastEpisode; downloaded: boolean } | null>(null);
  const [playlistEp, setPlaylistEp] = useState<PodcastEpisode | null>(null);
  // 自动播放下一集的遍历方向。按播客独立存储，因为这是播客本身的属性：
  // 往期节目适合正序播放，新闻类订阅则适合倒序。
  const [advanceDir, setAdvanceDir] = useState<EpisodeDirection>(
    () => episodeDirection(st.podcastDetailId),
  );
  // 在不同播客间切换时本组件会被复用，而 state 初始化器仅在挂载时执行一次——
  // 若不在此处同步，控件会继续显示（并基于）上一个播客的方向，
  // 却将新值写入当前播客的 key 下。
  useEffect(() => {
    setAdvanceDir(episodeDirection(st.podcastDetailId));
  }, [st.podcastDetailId]);

  // 书库列表返回的是精简版播客条目（仅有 numEpisodes，无 episodes[]）。
  // 需请求完整条目以获取已下载单集列表。
  const libEntry = st.library.find(i => i.id === st.podcastDetailId);
  const libEpisodeCount = libEntry
    ? (asPodcastItem(libEntry).media.numEpisodes ?? asPodcastItem(libEntry).media.episodes?.length ?? 0)
    : 0;
  const [full, setFull] = useState<LibraryItem | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const bumpRefresh = () => { setRefreshTick(t => t + 1); st.refreshLibrary().catch(e => log.error('library', 'podcast detail refresh failed', { err: String(e) })); };
  const [feedImg, setFeedImg] = useState<string | undefined>(
    () => (st.podcastDetailId ? cachedPodcastImage(st.podcastDetailId) : undefined),
  );
  // 已发布的订阅源单集（打开时自动解析）。先从缓存加载以实现即时显示，
  // 再从实时订阅源刷新。
  const [feedEps, setFeedEps] = useState<RecentEpisode[]>(
    () => (st.podcastDetailId ? cachedFeedEpisodes(st.podcastDetailId) ?? [] : []),
  );

  // 本地播客书库已将完整单集列表嵌入书库条目中，
  // 无需向服务器请求完整数据——直接基于 libEntry 渲染。
  const isLocal = st.activeLibrary?.source === 'local';

  useEffect(() => {
    if (isLocal) { setFull(null); return; }
    if (!st.podcastDetailId || !st.serverUrl) { setFull(null); return; }
    let cancelled = false;
    fetchItem(st.serverUrl, st.podcastDetailId)
      .then(it => { if (!cancelled) setFull(it); })
      .catch(e => log.error('library', 'podcast detail fetchItem failed', { itemId: st.podcastDetailId, err: String(e) }));
    return () => { cancelled = true; };
  }, [st.podcastDetailId, st.serverUrl, libEpisodeCount, refreshTick, isLocal]);

  // 自动"查找单集"：打开时解析实时订阅源（带缓存），
  // 使页面展示最新发布的单集，而非仅已下载的单集。
  const metaFeedUrl = ((full ?? libEntry) as unknown as { media?: { metadata?: Record<string, unknown> } })?.media?.metadata?.feedUrl as string | undefined;
  useEffect(() => {
    const id = st.podcastDetailId;
    if (!id || !metaFeedUrl) return;
    let cancelled = false;
    resolvePodcastFeed(st.serverUrl, id, metaFeedUrl, isLocal).then(d => {
      if (cancelled || !d) return;
      if (d.episodes.length) setFeedEps(d.episodes);
      if (d.image) setFeedImg(prev => prev ?? d.image ?? undefined);
    });
    return () => { cancelled = true; };
  }, [st.podcastDetailId, st.serverUrl, metaFeedUrl, isLocal]);

  const item = full ?? libEntry;

  if (!item) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--onyx-text-mute)', fontFamily: mono, fontSize: 13 }}>
        未找到该播客
      </div>
    );
  }

  const p = asPodcastItem(item);
  const meta = p.media.metadata;
  const autoOn = p.media.autoDownloadEpisodes ?? false;

  // 将已下载单集（可播放、含进度）与已发布的订阅源单集合并。
  const downloadedEps = p.media.episodes ?? [];
  const dlMap = new Map<string, PodcastEpisode>();
  downloadedEps.forEach(e => dlMap.set(episodeKey(e), e));
  const byKey = new Map<string, { ep: PodcastEpisode; downloaded: boolean }>();
  feedEps.forEach(fe => {
    const k = episodeKey(fe);
    const dl = dlMap.get(k);
    byKey.set(k, { ep: dl ?? fe, downloaded: !!dl });
  });
  downloadedEps.forEach(e => {
    const k = episodeKey(e);
    if (!byKey.has(k)) byKey.set(k, { ep: e, downloaded: true });
  });
  const episodes = [...byKey.values()].sort((a, b) => episodeTime(b.ep) - episodeTime(a.ep));
  const pendingCount = episodes.filter(e => !e.downloaded).length;

  const back = () => { st.setScreen('library'); st.setPodcastDetailId(null); };

  const play = async (ep: PodcastEpisode) => {
    if (!ep.id) return;
    // 仅在播放实际启动后再跳转——若先跳转到播放器，
    // 当会话打开失败时播放器仍显示上一个（或空）条目，
    // 用户会误以为播放器损坏而非播放出错。
    try {
      // 传入完整条目而非 id：书架条目是精简版的，
      // playEpisode 保存的快照才是自动播放下一集在结束时读取的数据。
      await playEpisode(st, item, ep);
      st.setScreen('player');
    } catch (e) {
      log.error('playback', 'playEpisode failed', { itemId: item.id, episodeId: ep.id, err: String(e) });
      st.setToast({ message: '无法播放该单集', type: 'error' });
    }
  };

  // 未下载 → 打开播放器并进入待下载/先下载再播放状态
  const openUndownloaded = (ep: PodcastEpisode) => {
    st.setCurrentEpisode(ep);
    st.setCurrentEpisodeId(null);
    st.setCurrentBookId(item.id);
    st.setFocusedBookId(item.id);
    st.setScreen('player');
  };

  const onRow = (ep: PodcastEpisode, downloaded: boolean) => {
    if (!downloaded) { openUndownloaded(ep); return; }
    if (!ep.id) return;
    const isCurrent = st.currentEpisodeId === ep.id && st.currentBookId === item.id;
    if (isCurrent) { st.setScreen('player'); return; }
    play(ep);
  };

  // 下载选择器中展示的未下载单集
  const undownloaded = episodes.filter(e => !e.downloaded).map(e => e.ep);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 18, padding: '8px 24px 24px', minHeight: 0, width: '100%', overflow: 'hidden' }}>
      {/* 返回按钮 */}
      <button
        onClick={back}
        style={{
          alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 6,
          background: 'none', border: 'none', cursor: 'pointer', fontFamily: mono,
          fontSize: 11, letterSpacing: '0.06em', color: 'var(--onyx-text-dim)', padding: 0,
        }}
      >
        <Icon name="chevron-left" size={14} /> 书库
      </button>

      {/* 头部信息 */}
      <div style={{ display: 'flex', gap: 20, flexShrink: 0 }}>
        <div style={{ width: 160, height: 160, flexShrink: 0 }}>
          <Cover item={item} fill serverUrl={st.serverUrl} fallbackImageUrl={(meta?.imageUrl ?? (meta as unknown as { image?: string })?.image) || feedImg} />
        </div>
        <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--onyx-text)', lineHeight: 1.15 }}>
            {meta.title ?? item.id}
          </div>
          {meta.author && <div style={{ fontSize: 13, color: 'var(--onyx-text-dim)' }}>{meta.author}</div>}
          <div style={{ fontFamily: mono, fontSize: 11, color: 'var(--onyx-text-mute)', letterSpacing: '0.04em' }}>
            共 {episodes.length} 集
            {pendingCount > 0 ? ` · ${pendingCount} 集未下载` : ''}
            {meta.explicit ? ' · 含成人内容' : ''}
          </div>
          {meta.feedUrl && (
            <div className="onyx-selectable" style={{
              fontFamily: mono, fontSize: 10.5, color: 'var(--onyx-text-mute)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 460, opacity: 0.8,
            }} title={meta.feedUrl}>{meta.feedUrl}</div>
          )}
          {meta.description && (
            <div className="onyx-selectable" style={{
              fontSize: 12, color: 'var(--onyx-text-dim)', lineHeight: 1.45, marginTop: 4, maxWidth: 560,
              overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical',
            }}>{meta.description}</div>
          )}
          {/* 操作按钮 */}
          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            <button
              onClick={() => setShowDownload(true)}
              disabled={pendingCount === 0}
              title={pendingCount === 0 ? '所有单集均已下载' : `从 ${pendingCount} 集中选择下载`}
              style={{
                padding: '7px 14px', borderRadius: 8, border: 'none',
                cursor: pendingCount === 0 ? 'default' : 'pointer',
                background: pendingCount === 0 ? 'var(--onyx-line)' : 'var(--onyx-accent)',
                color: pendingCount === 0 ? 'var(--onyx-text-mute)' : 'var(--onyx-bg)',
                fontFamily: mono, fontSize: 11, letterSpacing: '0.06em', fontWeight: 600,
              }}
            >{pendingCount === 0 ? '全部已下载' : `下载… (${pendingCount})`}</button>
            <button
              onClick={() => setShowSettings(true)}
              title={autoOn ? '自动下载已开启——点击配置' : '配置自动下载'}
              style={{
                padding: '7px 14px', borderRadius: 8, cursor: 'pointer',
                background: autoOn ? 'var(--onyx-accent)' : 'transparent',
                color: autoOn ? 'var(--onyx-bg)' : 'var(--onyx-text-dim)',
                border: autoOn ? 'none' : '1px solid var(--onyx-glass-edge)',
                fontFamily: mono, fontSize: 11, letterSpacing: '0.06em', fontWeight: autoOn ? 600 : 400,
              }}
            >{autoOn ? '自动下载 · 已开启' : '自动下载'}</button>
            <button
              onClick={() => {
                const next: EpisodeDirection = advanceDir === 'oldest' ? 'newest' : 'oldest';
                setAdvanceDir(next);
                if (st.podcastDetailId) setEpisodeDirection(st.podcastDetailId, next);
              }}
              title="开启连续播放时下一集的顺序（设置 → 播放）"
              style={{
                padding: '7px 14px', borderRadius: 8, cursor: 'pointer',
                background: 'transparent', color: 'var(--onyx-text-dim)',
                border: '1px solid var(--onyx-glass-edge)',
                fontFamily: mono, fontSize: 11, letterSpacing: '0.06em',
              }}
            >{advanceDir === 'oldest' ? '接下来 · 从最早开始' : '接下来 · 从最新开始'}</button>
          </div>
        </div>
      </div>

      {/* 单集列表 */}
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, display: 'flex', flexDirection: 'column', gap: 2, paddingRight: 4 }}>
        {episodes.length === 0 && (
          <div style={{ color: 'var(--onyx-text-mute)', fontFamily: mono, fontSize: 12, padding: '16px 0' }}>
            订阅源中未找到任何单集
          </div>
        )}
        {episodes.map(({ ep, downloaded }) => {
          const mp = downloaded ? st.mediaProgress.find(x => x.libraryItemId === item.id && x.episodeId === ep.id) : undefined;
          const dur = ep.duration ?? mp?.duration ?? 0;
          const pct = mp ? Math.min(100, Math.round((mp.progress ?? 0) * 100)) : 0;
          const finished = mp?.isFinished ?? false;
          const nowPlaying = downloaded && st.currentEpisodeId === ep.id && st.currentBookId === item.id;
          const date = episodeDate(ep);
          return (
            <div
              key={episodeKey(ep)}
              className="onyx-row"
              onClick={() => onRow(ep, downloaded)}
              onContextMenu={(e) => { e.preventDefault(); setEpMenu({ x: e.clientX, y: e.clientY, ep, downloaded }); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '10px 10px',
                borderRadius: 8, borderBottom: '1px solid var(--onyx-line)', cursor: 'pointer',
              }}
            >
              <button
                onClick={(e) => { e.stopPropagation(); if (!downloaded) { openUndownloaded(ep); return; } if (nowPlaying) togglePlayback(st).catch(err => log.error('playback', 'episode toggle playback failed', { err: String(err) })); else play(ep); }}
                title={!downloaded ? '下载单集' : (nowPlaying && st.playing ? '暂停' : '播放单集')}
                style={{
                  width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
                  background: nowPlaying ? 'var(--onyx-accent)' : 'rgba(255,255,255,0.06)',
                  color: nowPlaying ? 'var(--onyx-bg)' : (downloaded ? 'var(--onyx-text)' : 'var(--onyx-text-mute)'),
                  border: '1px solid var(--onyx-glass-edge)', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Icon name={!downloaded ? 'plus' : (nowPlaying && st.playing ? 'pause' : 'play')} size={14} />
              </button>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 13, color: downloaded ? 'var(--onyx-text)' : 'var(--onyx-text-dim)', fontWeight: nowPlaying ? 600 : 400,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>{ep.title}</div>
                <div style={{ fontFamily: mono, fontSize: 10.5, color: 'var(--onyx-text-mute)', letterSpacing: '0.03em', marginTop: 2, display: 'flex', gap: 10 }}>
                  {date && <span>{date}</span>}
                  {dur > 0 && <span>{fmtRemaining(dur)}</span>}
                  {!downloaded ? <span style={{ color: 'var(--onyx-text-mute)' }}>未下载</span>
                    : finished ? <span style={{ color: 'var(--onyx-accent)' }}>已听完</span>
                    : pct > 0 ? <span>{fmtTime((mp?.currentTime ?? 0))} · {pct}%</span> : null}
                </div>
                {pct > 0 && !finished && (
                  <div style={{ height: 2, background: 'var(--onyx-line)', borderRadius: 1, marginTop: 6, overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: 'var(--onyx-accent)' }} />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 单集右键菜单（播客单集上下文菜单路线图） */}
      {epMenu && (
        <ContextMenu
          x={epMenu.x}
          y={epMenu.y}
          sections={buildEpisodeContextMenu(item, epMenu.ep, epMenu.downloaded, st, {
            play,
            openUndownloaded,
            setPlaylistEpisode: isLocal ? undefined : (_it, ep2) => setPlaylistEp(ep2),
            onDeleted: bumpRefresh,
          })}
          onClose={() => setEpMenu(null)}
        />
      )}
      {playlistEp && (
        <PlaylistPicker item={item} episode={playlistEp} serverUrl={st.serverUrl} onClose={() => setPlaylistEp(null)} />
      )}

      {showDownload && (
        <PodcastDownloadModal
          st={st}
          itemId={item.id}
          episodes={undownloaded}
          onClose={() => setShowDownload(false)}
          onQueued={bumpRefresh}
        />
      )}
      {showSettings && (
        <PodcastSettingsModal
          st={st}
          item={item}
          onClose={() => setShowSettings(false)}
          onSaved={bumpRefresh}
        />
      )}
    </div>
  );
}
