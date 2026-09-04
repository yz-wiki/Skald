// 单播客“接下来”播放顺序控制（自动播放下一集路线图，第4阶段）。
// 播放顺序按播客独立存储，因此控件需要跟随播客切换而更新——
// PodcastDetail 通过屏幕切换渲染而非带 key 的路由渲染，
// React 会复用实例，state 初始化器仅执行一次。
// 本测试的核心就是验证：切换播客后控件显示的内容，
// 以及下次点击时写入的是哪个 key。
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../api/playbook', () => ({
  playEpisode: vi.fn(async () => {}),
  togglePlayback: vi.fn(async () => {}),
}));
vi.mock('../components/Cover', () => ({ default: () => <div data-testid="cover" /> }));
vi.mock('@tauri-apps/api/core', () => ({ invoke: async () => undefined }));
vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(async () => {}), warn: vi.fn(async () => {}),
  error: vi.fn(async () => {}), debug: vi.fn(async () => {}),
  attachConsole: vi.fn(async () => () => {}),
}));

import PodcastDetail from './PodcastDetail';
import type { OnyxState } from '../state/onyx';

const DIRECTION = (showId: string) => `onyx.podcast.advanceDir.${showId}`;

function show(id: string, title: string) {
  return {
    id, ino: id, libraryId: 'lib1', mediaType: 'podcast',
    media: { metadata: { title }, numEpisodes: 0, episodes: [] },
  };
}

/** 未设置 serverUrl，因此跳过展开项的请求，直接从书架条目渲染——
 *  这里只关心播放顺序控件的行为。 */
function state(podcastDetailId: string): OnyxState {
  return {
    library: [show('p1', 'Show One'), show('p2', 'Show Two')],
    podcastDetailId,
    serverUrl: '',
    mediaProgress: [],
    activeLibrary: undefined,
    currentBookId: null,
    currentEpisodeId: null,
    playing: false,
    refreshLibrary: async () => {},
    setScreen: vi.fn(),
    setPodcastDetailId: vi.fn(),
    setCurrentEpisode: vi.fn(),
    setCurrentEpisodeId: vi.fn(),
    setCurrentBookId: vi.fn(),
    setFocusedBookId: vi.fn(),
    setToast: vi.fn(),
  } as unknown as OnyxState;
}

const directionButton = () => screen.getByRole('button', { name: /^接下来 · / });

beforeEach(() => { localStorage.clear(); });

describe('单播客播放顺序', () => {
  it('切换到另一个播客时无需重新挂载即可跟随更新', () => {
    localStorage.setItem(DIRECTION('p1'), JSON.stringify('newest'));
    // p2 没有存储的顺序，因此使用默认值：从最早开始。
    const { rerender } = render(<PodcastDetail st={state('p1')} />);
    expect(directionButton().textContent).toBe('接下来 · 从最新开始');

    rerender(<PodcastDetail st={state('p2')} />);

    expect(directionButton().textContent).toBe('接下来 · 从最早开始');
  });

  it('基于新播客的值进行切换，并写入对应的 key', () => {
    localStorage.setItem(DIRECTION('p1'), JSON.stringify('newest'));
    const { rerender } = render(<PodcastDetail st={state('p1')} />);
    rerender(<PodcastDetail st={state('p2')} />);

    fireEvent.click(directionButton());

    // 如果错误地基于过期的 "newest" 进行切换，就会写入 oldest-first，
    // 表面上看起来什么都没发生，而控件声称的顺序解析也从未被使用。
    expect(localStorage.getItem(DIRECTION('p2'))).toBe(JSON.stringify('newest'));
    expect(directionButton().textContent).toBe('接下来 · 从最新开始');
    expect(localStorage.getItem(DIRECTION('p1'))).toBe(JSON.stringify('newest'));
  });
});
