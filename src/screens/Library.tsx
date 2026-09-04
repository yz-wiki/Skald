import { useEffect } from 'react';
import type { OnyxState } from '../state/onyx';
import FocusPanel from '../components/FocusPanel';
import GreetingPane from '../components/greeting/GreetingPane';
import PickItUp from '../components/PickItUp';
import TopNav from '../components/chrome/TopNav';
import ShelfHeader from '../components/shelf/ShelfHeader';
import LibraryShelf from '../components/shelf/LibraryShelf';
import { SeriesView } from '../components/shelf/tabs';
import { AuthorsView } from '../components/shelf/tabs';
import { NarratorsView } from '../components/shelf/tabs';
import { CollectionsView } from '../components/shelf/tabs';
import { PlaylistsView } from '../components/shelf/tabs';
import { GenresView } from '../components/shelf/tabs';
import { PublishersView } from '../components/shelf/tabs';
import PodcastBrowse from '../components/podcast/PodcastBrowse';
import MiniPlayer from '../components/player/MiniPlayer';
import { prefetchReviews } from '../api/reviewCache';
import { shelfTabForSource } from '../lib/shelfTabs';
import { recentlyAddedItems } from '../lib/recentlyAdded';
import { log } from '../lib/log';

export interface LibraryProps { st: OnyxState; }

export default function Library({ st }: LibraryProps) {
  const isPodcast = st.activeLibrary?.mediaType === 'podcast';
  const isLocalLibrary = st.activeLibrary?.source === 'local';
  const isAllLibraries = st.activeLibrary?.source === 'all';

  const shelfSource = isAllLibraries ? 'all' : isLocalLibrary ? 'local' : 'abs';
  const visibleShelfTab = shelfTabForSource(st.shelfTab, shelfSource);
  const recentlyAdded = recentlyAddedItems(st.library);

  useEffect(() => {
    if (visibleShelfTab !== 'recently-added') return;
    log.info('library', 'recently added shelf opened', {
      source: shelfSource,
      items: recentlyAdded.length,
    });
  }, [visibleShelfTab, shelfSource, recentlyAdded.length]);

  useEffect(() => {
    if (isPodcast || !st.library.length || !st.serverUrl) return;
    const cancel = prefetchReviews(st.library, st.serverUrl, st.enableOpenLibrary);
    return cancel;
  }, [st.library, st.serverUrl, st.enableOpenLibrary, isPodcast]); // eslint-disable-line react-hooks/exhaustive-deps

  const playingIsPodcast = !!st.currentEpisode;
  const playingBookInLib = !!st.currentBookId && st.library.some(b => b.id === st.currentBookId);
  const showFocus = playingBookInLib && !playingIsPodcast;
  const showMini = !!st.playingItem && !!st.currentBookId && !showFocus;

  const focusColumn = (
    <div style={{
      alignSelf: 'stretch',
      display: 'flex',
      flexDirection: 'column',
      flexShrink: 0,
      minHeight: 0,
      maxWidth: 360,
    }}>
      <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
        {showFocus
          ? <FocusPanel st={st} />
          : <GreetingPane st={st} name={st.user?.username || st.localDisplayName || '读者'} />}
      </div>
      {showMini && <MiniPlayer st={st} force />}
    </div>
  );

  if (isPodcast) {
    return (
      <div style={{ flex: 1, display: 'flex', gap: 24, padding: '8px 24px 24px', minHeight: 0, width: '100%', maxWidth: '100%', overflow: 'visible' }}>
        {focusColumn}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 18, minWidth: 0 }}>
          <TopNav st={st} />
          <PodcastBrowse st={st} />
        </div>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, display: 'flex', gap: 24, padding: '8px 24px 24px', minHeight: 0, width: '100%', maxWidth: '100%', overflow: 'visible' }}>
      {focusColumn}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 18, minWidth: 0, minHeight: 0 }}>
        <TopNav st={st} />
        <PickItUp st={st} />
        <ShelfHeader st={st} />
        {visibleShelfTab === 'library' && <LibraryShelf st={st} />}
        {visibleShelfTab === 'recently-added' && (
          <LibraryShelf st={st} items={recentlyAdded} sortMode="recently" groupBySeries={false} />
        )}
        {visibleShelfTab === 'series' && <SeriesView st={st} inline />}
        {visibleShelfTab === 'authors' && <AuthorsView st={st} inline />}
        {visibleShelfTab === 'narrators' && <NarratorsView st={st} inline />}
        {visibleShelfTab === 'genres' && <GenresView st={st} inline />}
        {visibleShelfTab === 'publishers' && <PublishersView st={st} inline />}
        {visibleShelfTab === 'collections' && <CollectionsView st={st} inline />}
        {visibleShelfTab === 'playlists' && <PlaylistsView st={st} inline />}
      </div>
    </div>
  );
}
