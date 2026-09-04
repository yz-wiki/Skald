// First-launch onboarding host (First-Launch Onboarding roadmap, Phase 1).
import { useEffect, useMemo, useState } from 'react';
import type { OnyxState } from '../state/onyx';
import type { Library } from '../api/abs';
import { log } from '../lib/log';
import StepFrame, { ProgressDots, GhostButton, MONO } from '../components/onboarding/frame';
import WelcomeStep from '../components/onboarding/WelcomeStep';
import ChoosePathStep, { type OnboardingPath } from '../components/onboarding/ChoosePathStep';
import AbsConnectStep from '../components/onboarding/AbsConnectStep';
import AbsFoldersStep from '../components/onboarding/AbsFoldersStep';
import CreateLocalStep from '../components/onboarding/CreateLocalStep';
import AddBooksStep from '../components/onboarding/AddBooksStep';
import DoneStep from '../components/onboarding/DoneStep';

export interface OnboardingProps { st: OnyxState; }

type StepKey = 'welcome' | 'choose' | 'connect' | 'folders' | 'create' | 'addbooks' | 'done';

export default function Onboarding({ st }: OnboardingProps) {
  const [index, setIndex] = useState(0);
  const [path, setPath] = useState<OnboardingPath | null>(null);
  const [created, setCreated] = useState<Library | null>(null);

  useEffect(() => {
    log.info('app', 'onboarding shown', { hasServer: !!st.authToken, localMode: st.localMode });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const sequence = useMemo<StepKey[]>(() => {
    const seq: StepKey[] = ['welcome', 'choose'];
    if (path === 'abs' || path === 'both') seq.push('connect', 'folders');
    if (path === 'local' || path === 'both') seq.push('create', 'addbooks');
    seq.push('done');
    return seq;
  }, [path]);

  const safeIndex = Math.min(index, sequence.length - 1);
  const step = sequence[safeIndex];

  const goNext = () => setIndex(i => Math.min(i + 1, sequence.length - 1));
  const goBack = () => setIndex(i => Math.max(i - 1, 0));

  const choose = (p: OnboardingPath) => {
    if (p !== path) { setPath(p); if (p === 'abs') setCreated(null); }
    log.info('app', 'onboarding path chosen', { path: p });
    setIndex(i => i + 1);
  };

  const finish = (skipped: boolean) => {
    if (!st.authToken) st.setLocalMode(true);
    st.setOnboarded(true);
    st.setScreen('library');
    if (skipped) {
      log.info('app', 'onboarding skipped', { atStep: step });
      if (!st.authToken) {
        st.setToast({ message: '你可以随时在「设置 → 服务器」中连接服务器。', type: 'info' });
      }
    } else {
      log.info('app', 'onboarding completed', { path });
    }
  };

  // ── Footer chrome ────────────────────────────────────────────────────────
  const branchSteps: StepKey[] = sequence.filter(s => s !== 'welcome');
  const dotIndex = Math.max(0, branchSteps.indexOf(step));

  const footer = (
    <>
      <div style={{ minWidth: 80 }}>
        {safeIndex > 0 && step !== 'done' && (
          <button
            type="button"
            onClick={goBack}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: MONO, fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(235,231,223,0.5)', padding: '6px 4px' }}
          >
            ← 返回
          </button>
        )}
      </div>
      {step !== 'welcome' && <ProgressDots count={branchSteps.length} index={dotIndex} />}
      <div style={{ minWidth: 80, display: 'flex', justifyContent: 'flex-end' }}>
        {step !== 'done' && <GhostButton onClick={() => finish(true)}>跳过设置</GhostButton>}
      </div>
    </>
  );

  // ── Per-step header copy + body ────────────────────────────────────────────
  const eyebrow = step === 'welcome'
    ? '欢迎'
    : `第 ${dotIndex + 1} 步，共 ${branchSteps.length} 步`;

  const header: Record<StepKey, { title: React.ReactNode; subtitle?: React.ReactNode }> = {
    welcome: { title: <>欢迎使用 <span style={{ fontStyle: 'italic', color: 'var(--onyx-accent)' }}>Skald</span></> },
    choose: { title: '你打算怎么用 Skald？', subtitle: '先选一个——之后可以在设置中添加另一种方式。' },
    connect: { title: '连接 Audiobookshelf', subtitle: '输入服务器地址，用 API 密钥或密码登录。' },
    folders: { title: '下载存储位置', subtitle: '选择离线副本在这台电脑上的存放位置。' },
    create: { title: '创建本地书库', subtitle: 'Skald 会从本机有声书构建一个管理文件夹——无需服务器。' },
    addbooks: { title: '导入书籍', subtitle: '两种方式向本地书库添加书籍。' },
    done: { title: '一切就绪', subtitle: undefined },
  };

  const body = (() => {
    switch (step) {
      case 'welcome': return <WelcomeStep onBegin={goNext} />;
      case 'choose': return <ChoosePathStep value={path} onChoose={choose} />;
      case 'connect': return <AbsConnectStep st={st} onConnected={goNext} />;
      case 'folders': return <AbsFoldersStep st={st} onContinue={goNext} />;
      case 'create': return <CreateLocalStep st={st} created={created} onCreated={(lib) => { setCreated(lib); goNext(); }} onSkip={goNext} />;
      case 'addbooks': return <AddBooksStep st={st} library={created} onContinue={goNext} />;
      case 'done': return <DoneStep st={st} path={path} created={created} onFinish={() => finish(false)} />;
    }
  })();

  return (
    <StepFrame
      stepKey={step}
      eyebrow={eyebrow}
      title={header[step].title}
      subtitle={header[step].subtitle}
      footer={footer}
    >
      {body}
    </StepFrame>
  );
}
