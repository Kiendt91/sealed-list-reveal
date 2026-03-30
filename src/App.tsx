import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, 
  Share2, 
  CheckCircle2, 
  Clock, 
  ShieldCheck, 
  Copy, 
  ExternalLink, 
  ChevronRight,
  AlertCircle,
  Eye,
  Lock,
  Loader2,
  Trophy,
  History
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc, 
  onSnapshot, 
  serverTimestamp, 
  collection,
  query,
  where,
  orderBy,
  limit
} from 'firebase/firestore';
import { db } from './firebase';
import { cn } from './lib/utils';
import { Match, PlayerMetadata, ListContent } from './types';

// --- Constants ---
const MATCH_EXPIRY_HOURS = 24;

const TRANSLATIONS = {
  vi: {
    title_reveal: "Reveal",
    tagline: "Bảo mật danh sách quân đội Warhammer 40K. Công bằng tuyệt đối cho mọi trận đấu.",
    footer_made_by: "Phát triển bởi",
    footer_community: "từ cộng đồng",
    footer_copy: "Dành cho cộng đồng Wargaming.",
    home_create_title: "Tạo Trận Đấu Mới",
    home_create_desc: "Nhận mã phòng và QR để chia sẻ với đối thủ ngay lập tức.",
    home_create_btn: "Bắt Đầu Ngay",
    home_join_title: "Tham Gia Trận Đấu",
    home_join_desc: "Nhập mã phòng được chia sẻ bởi đối thủ của bạn.",
    home_join_placeholder: "MÃ PHÒNG",
    feat_secure: "Bảo Mật",
    feat_secure_desc: "List được mã hóa và niêm phong.",
    feat_fair: "Công Bằng",
    feat_fair_desc: "Chỉ hiện khi cả hai đã nộp xong.",
    feat_fast: "Nhanh Chóng",
    feat_fast_desc: "Không cần đăng ký tài khoản.",
    match_loading: "Đang tải thông tin trận đấu...",
    match_error_title: "Lỗi",
    match_error_not_found: "Trận đấu không tồn tại hoặc đã hết hạn.",
    match_back_home: "Quay Lại Trang Chủ",
    match_back: "Quay Lại",
    lobby_match_code: "Mã Trận",
    lobby_share_desc: "Chia sẻ mã này hoặc QR code cho đối thủ của bạn.",
    lobby_copy_link: "Sao Chép Link",
    lobby_share_btn: "Chia Sẻ Link",
    lobby_slot: "Slot",
    lobby_occupied: "ĐÃ CHIẾM",
    lobby_enter_slot: "VÀO SLOT",
    submit_title: "Niêm Phong Danh Sách",
    submit_name_label: "Tên của bạn",
    submit_name_placeholder: "Vd: Ultramarines Commander",
    submit_list_label: "Army List (Dán từ Battlescribe/New Recruit...)",
    submit_list_placeholder: "Dán danh sách quân đội của bạn tại đây...",
    submit_note: "Lưu ý: Sau khi nộp, bạn sẽ không thể chỉnh sửa danh sách. Danh sách chỉ được hiển thị khi đối thủ của bạn cũng đã nộp xong.",
    submit_btn: "Niêm Phong & Nộp List",
    waiting_title: "Đang Chờ Đối Thủ",
    waiting_desc: "Bạn đã nộp list thành công. Hệ thống đang chờ đối thủ hoàn tất.",
    player_you: "BẠN",
    player_opponent: "ĐỐI THỦ",
    status_submitted: "ĐÃ NỘP",
    status_typing: "ĐANG NHẬP...",
    reveal_status: "ĐÃ CÔNG BỐ",
    reveal_title: "Trận Đấu Bắt Đầu!",
    reveal_download: "Tải Xuống Cả Hai List (.txt)",
    reveal_wish_fair: "Chúc các bạn có một trận đấu công bằng!",
    reveal_thanks: "Cảm ơn đã sử dụng Sealed List Reveal.",
    card_submitted_at: "Nộp lúc",
    card_loading_content: "Đang tải nội dung...",
    common_loading: "Đang tải...",
  },
  en: {
    title_reveal: "Reveal",
    tagline: "Secure your Warhammer 40K army lists. Absolute fairness for every match.",
    footer_made_by: "Made By",
    footer_community: "from",
    footer_copy: "For the Wargaming community.",
    home_create_title: "Create New Match",
    home_create_desc: "Get a room code and QR to share with your opponent instantly.",
    home_create_btn: "Start Now",
    home_join_title: "Join Match",
    home_join_desc: "Enter the room code shared by your opponent.",
    home_join_placeholder: "ROOM CODE",
    feat_secure: "Secure",
    feat_secure_desc: "Lists are encrypted and sealed.",
    feat_fair: "Fair Play",
    feat_fair_desc: "Only revealed when both have submitted.",
    feat_fast: "Fast",
    feat_fast_desc: "No account registration required.",
    match_loading: "Loading match data...",
    match_error_title: "Error",
    match_error_not_found: "Match not found or has expired.",
    match_back_home: "Back to Home",
    match_back: "Back",
    lobby_match_code: "Match Code",
    lobby_share_desc: "Share this code or QR code with your opponent.",
    lobby_copy_link: "Copy Link",
    lobby_share_btn: "Share Link",
    lobby_slot: "Slot",
    lobby_occupied: "OCCUPIED",
    lobby_enter_slot: "ENTER SLOT",
    submit_title: "Seal Army List",
    submit_name_label: "Your Name",
    submit_name_placeholder: "e.g. Ultramarines Commander",
    submit_list_label: "Army List (Paste from Battlescribe/New Recruit...)",
    submit_list_placeholder: "Paste your army list here...",
    submit_note: "Note: You cannot edit your list after submission. It will only be revealed when your opponent also submits.",
    submit_btn: "Seal & Submit List",
    waiting_title: "Waiting for Opponent",
    waiting_desc: "You have submitted successfully. Waiting for your opponent to complete.",
    player_you: "YOU",
    player_opponent: "OPPONENT",
    status_submitted: "SUBMITTED",
    status_typing: "ENTERING...",
    reveal_status: "REVEALED",
    reveal_title: "Let the Battle Begin!",
    reveal_download: "Download Both Lists (.txt)",
    reveal_wish_fair: "Have a fair and glorious battle!",
    reveal_thanks: "Thanks for using Sealed List Reveal.",
    card_submitted_at: "Submitted at",
    card_loading_content: "Loading content...",
    common_loading: "Loading...",
  }
};

// --- Helper Components ---
const Button = ({ 
  children, 
  className, 
  variant = 'primary', 
  isLoading = false, 
  ...props 
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'outline' | 'ghost', isLoading?: boolean }) => {
  const variants = {
    primary: 'bg-orange-600 text-white hover:bg-orange-700 shadow-lg shadow-orange-900/20',
    secondary: 'bg-zinc-800 text-zinc-100 hover:bg-zinc-700',
    outline: 'border border-zinc-700 text-zinc-300 hover:bg-zinc-800',
    ghost: 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50'
  };

  return (
    <button 
      className={cn(
        'px-4 py-2 rounded-lg font-medium transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2',
        variants[variant],
        className
      )}
      disabled={isLoading}
      {...props}
    >
      {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
      {children}
    </button>
  );
};

const Card = ({ children, className }: { children: React.ReactNode, className?: string }) => (
  <div className={cn('bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 backdrop-blur-sm', className)}>
    {children}
  </div>
);

// --- Main Application ---
export default function App() {
  const [matchId, setMatchId] = useState<string | null>(null);
  const [view, setView] = useState<'home' | 'match'>('home');
  const [lang, setLang] = useState<'vi' | 'en'>(() => {
    const saved = localStorage.getItem('slr_lang');
    return (saved === 'en' || saved === 'vi') ? saved : 'vi';
  });

  const t = (key: keyof typeof TRANSLATIONS.vi) => TRANSLATIONS[lang][key] || key;

  useEffect(() => {
    localStorage.setItem('slr_lang', lang);
  }, [lang]);

  useEffect(() => {
    const path = window.location.pathname.split('/')[1];
    if (path && path.length >= 5) {
      setMatchId(path);
      setView('match');
    }
  }, []);

  const createMatch = async () => {
    const id = Math.random().toString(36).substring(2, 7).toUpperCase();
    const expiresAt = new Date();
    // Initial expiry for unrevealed matches: 48 hours
    expiresAt.setHours(expiresAt.getHours() + 48);

    const matchData: Match = {
      id,
      p1: { name: '', submitted: false },
      p2: { name: '', submitted: false },
      revealed: false,
      createdAt: serverTimestamp(),
      expiresAt: expiresAt.toISOString()
    };

    await setDoc(doc(db, 'matches', id), matchData);
    window.history.pushState({}, '', `/${id}`);
    setMatchId(id);
    setView('match');
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans selection:bg-orange-500/30">
      {/* Background Decor */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-orange-600/10 blur-[120px] rounded-full" />
        <div className="absolute -bottom-[10%] -right-[10%] w-[40%] h-[40%] bg-zinc-600/10 blur-[120px] rounded-full" />
      </div>

      <div className="relative max-w-4xl mx-auto px-4 py-12">
        {/* Language Switcher */}
        <div className="absolute top-4 right-4 flex gap-1 bg-zinc-900/50 p-1 rounded-lg border border-zinc-800">
          <button 
            onClick={() => setLang('vi')}
            className={cn("px-2 py-1 text-[10px] font-bold rounded transition-colors", lang === 'vi' ? "bg-orange-600 text-white" : "text-zinc-500 hover:text-zinc-300")}
          >
            VN
          </button>
          <button 
            onClick={() => setLang('en')}
            className={cn("px-2 py-1 text-[10px] font-bold rounded transition-colors", lang === 'en' ? "bg-orange-600 text-white" : "text-zinc-500 hover:text-zinc-300")}
          >
            EN
          </button>
        </div>

        <header className="flex flex-col items-center mb-16 text-center">
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-16 h-16 bg-orange-600 rounded-2xl flex items-center justify-center mb-6 shadow-2xl shadow-orange-600/20"
          >
            <ShieldCheck className="w-10 h-10 text-white" />
          </motion.div>
          <h1 className="text-4xl font-black tracking-tighter uppercase italic mb-2">
            Sealed List <span className="text-orange-600">{t('title_reveal')}</span>
          </h1>
          <p className="text-zinc-500 max-w-sm">
            {t('tagline')}
          </p>
        </header>

        <main>
          <AnimatePresence mode="wait">
            {view === 'home' ? (
              <HomeView key="home" onCreate={createMatch} t={t} />
            ) : (
              <MatchView key="match" id={matchId!} onBack={() => {
                window.history.pushState({}, '', '/');
                setView('home');
                setMatchId(null);
              }} t={t} />
            )}
          </AnimatePresence>
        </main>

        <footer className="mt-24 pt-8 border-t border-zinc-900 text-center text-zinc-600 text-sm">
          <p className="mb-2">{t('footer_made_by')} <span className="text-orange-600 font-bold">Kiên Chaos</span> {t('footer_community')} <span className="italic">D6 community</span></p>
          <p>© 2026 Warhammer 40K Sealed List Reveal. {t('footer_copy')}</p>
        </footer>
      </div>
    </div>
  );
}

// --- Views ---

function HomeView({ onCreate, t }: { onCreate: () => void, t: any, key?: string }) {
  const [matchCode, setMatchCode] = useState('');

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (matchCode.trim()) {
      window.location.pathname = `/${matchCode.trim().toUpperCase()}`;
    }
  };

  return (
    <motion.div 
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: -20, opacity: 0 }}
      className="space-y-8"
    >
      <div className="grid md:grid-cols-2 gap-6">
        <Card className="flex flex-col items-center text-center justify-center py-12 border-orange-600/20 bg-orange-600/5">
          <Plus className="w-12 h-12 text-orange-600 mb-4" />
          <h2 className="text-xl font-bold mb-2">{t('home_create_title')}</h2>
          <p className="text-zinc-500 text-sm mb-6">{t('home_create_desc')}</p>
          <Button onClick={onCreate} className="w-full max-w-[200px]">
            {t('home_create_btn')}
          </Button>
        </Card>

        <Card className="flex flex-col items-center text-center justify-center py-12">
          <History className="w-12 h-12 text-zinc-600 mb-4" />
          <h2 className="text-xl font-bold mb-2">{t('home_join_title')}</h2>
          <p className="text-zinc-500 text-sm mb-6">{t('home_join_desc')}</p>
          <form onSubmit={handleJoin} className="w-full max-w-[240px] flex gap-2">
            <input 
              type="text" 
              placeholder={t('home_join_placeholder')}
              value={matchCode}
              onChange={(e) => setMatchCode(e.target.value)}
              className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 w-full text-center font-mono uppercase focus:outline-none focus:border-orange-600 transition-colors"
            />
            <Button type="submit" variant="secondary" className="px-3">
              <ChevronRight className="w-5 h-5" />
            </Button>
          </form>
        </Card>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { icon: Lock, title: t('feat_secure'), desc: t('feat_secure_desc') },
          { icon: Eye, title: t('feat_fair'), desc: t('feat_fair_desc') },
          { icon: Clock, title: t('feat_fast'), desc: t('feat_fast_desc') }
        ].map((item, i) => (
          <div key={i} className="p-4 rounded-xl border border-zinc-900 bg-zinc-900/20 flex flex-col items-center text-center">
            <item.icon className="w-6 h-6 text-orange-600/60 mb-2" />
            <h3 className="font-bold text-sm">{item.title}</h3>
            <p className="text-xs text-zinc-600">{item.desc}</p>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

function MatchView({ id, onBack, t }: { id: string, onBack: () => void, t: any, key?: string }) {
  const [match, setMatch] = useState<Match | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [p1List, setP1List] = useState<string | null>(null);
  const [p2List, setP2List] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [mySlot, setMySlot] = useState<'p1' | 'p2' | null>(null);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'matches', id), (docSnap) => {
      if (docSnap.exists()) {
        setMatch(docSnap.data() as Match);
        setLoading(false);
      } else {
        setError(t('match_error_not_found'));
        setLoading(false);
      }
    });

    return () => unsub();
  }, [id, t]);

  useEffect(() => {
    if (match?.revealed) {
      const fetchLists = async () => {
        const p1Snap = await getDoc(doc(db, 'matches', id, 'lists', 'p1'));
        const p2Snap = await getDoc(doc(db, 'matches', id, 'lists', 'p2'));
        if (p1Snap.exists()) setP1List(p1Snap.data().content);
        if (p2Snap.exists()) setP2List(p2Snap.data().content);
      };
      fetchLists();
    }
  }, [match?.revealed, id]);

  const handleSubmit = async (name: string, list: string) => {
    if (!mySlot) return;
    setSubmitting(true);
    try {
      // 1. Save list content to subcollection (restricted by rules)
      await setDoc(doc(db, 'matches', id, 'lists', mySlot), { content: list });
      
      // 2. Update match metadata
      const updates: any = {
        [`${mySlot}.name`]: name,
        [`${mySlot}.submitted`]: true,
        [`${mySlot}.submittedAt`]: serverTimestamp()
      };

      // Check if this submission reveals the match
      const otherSlot = mySlot === 'p1' ? 'p2' : 'p1';
      if (match?.[otherSlot].submitted) {
        updates.revealed = true;
        // Set new expiry: 24 hours from reveal
        const newExpiry = new Date();
        newExpiry.setHours(newExpiry.getHours() + 24);
        updates.expiresAt = newExpiry.toISOString();
      }

      await updateDoc(doc(db, 'matches', id), updates);
    } catch (err) {
      console.error(err);
      alert('Có lỗi xảy ra khi nộp list.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-20">
      <Loader2 className="w-10 h-10 animate-spin text-orange-600 mb-4" />
      <p className="text-zinc-500">{t('match_loading')}</p>
    </div>
  );

  if (error) return (
    <div className="text-center py-20">
      <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
      <h2 className="text-xl font-bold mb-2">{t('match_error_title')}</h2>
      <p className="text-zinc-500 mb-6">{error}</p>
      <Button onClick={onBack} variant="outline">{t('match_back_home')}</Button>
    </div>
  );

  const isP1Submitted = match?.p1.submitted;
  const isP2Submitted = match?.p2.submitted;
  const isRevealed = match?.revealed;

  // Determine current phase
  let phase: 'lobby' | 'submit' | 'waiting' | 'reveal' = 'lobby';
  if (isRevealed) phase = 'reveal';
  else if (mySlot && !match?.[mySlot].submitted) phase = 'submit';
  else if (mySlot && match?.[mySlot].submitted) phase = 'waiting';
  else phase = 'lobby';

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      <div className="flex items-center justify-between mb-4">
        <Button onClick={onBack} variant="ghost" className="text-xs">
          <ChevronRight className="w-4 h-4 rotate-180" /> {t('match_back')}
        </Button>
        <div className="flex items-center gap-2 bg-zinc-900 px-3 py-1 rounded-full border border-zinc-800">
          <div className={cn("w-2 h-2 rounded-full", isRevealed ? "bg-green-500" : "bg-orange-500 animate-pulse")} />
          <span className="text-xs font-mono text-zinc-400 uppercase">{id}</span>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {phase === 'lobby' && (
          <LobbyView key="lobby" id={id} match={match!} onJoin={(slot) => setMySlot(slot)} t={t} />
        )}
        {phase === 'submit' && (
          <SubmitForm key="submit" slot={mySlot!} onSubmit={handleSubmit} isLoading={submitting} t={t} />
        )}
        {phase === 'waiting' && (
          <WaitingView key="waiting" match={match!} mySlot={mySlot!} t={t} />
        )}
        {phase === 'reveal' && (
          <RevealView key="reveal" match={match!} p1List={p1List} p2List={p2List} t={t} />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// --- Sub-Views ---

function LobbyView({ id, match, onJoin, t }: { id: string, match: Match, onJoin: (slot: 'p1' | 'p2') => void, t: any, key?: string }) {
  const url = `${window.location.origin}/${id}`;
  const [copied, setCopied] = useState(false);

  const copyLink = () => {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="space-y-6">
      <Card className="text-center py-10">
        <div className="bg-white p-4 rounded-xl inline-block mb-6">
          <QRCodeSVG value={url} size={160} />
        </div>
        <h2 className="text-2xl font-bold mb-2">{t('lobby_match_code')}: {id}</h2>
        <p className="text-zinc-500 text-sm mb-8">{t('lobby_share_desc')}</p>
        
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <div className="flex items-center gap-2 bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-sm font-mono overflow-hidden">
            <span className="truncate max-w-[200px]">{url}</span>
            <button onClick={copyLink} className="text-orange-500 hover:text-orange-400">
              {copied ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
          <Button onClick={copyLink} variant="primary">
            <Share2 className="w-4 h-4" /> {t('lobby_share_btn')}
          </Button>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-4">
        <Button 
          onClick={() => onJoin('p1')} 
          variant={match.p1.submitted ? 'outline' : 'secondary'}
          disabled={match.p1.submitted}
          className="h-24 flex-col"
        >
          <span className="text-xs text-zinc-500 uppercase tracking-widest">{t('lobby_slot')} 1</span>
          <span className="text-lg font-bold">{match.p1.submitted ? t('lobby_occupied') : `${t('lobby_enter_slot')} 1`}</span>
        </Button>
        <Button 
          onClick={() => onJoin('p2')} 
          variant={match.p2.submitted ? 'outline' : 'secondary'}
          disabled={match.p2.submitted}
          className="h-24 flex-col"
        >
          <span className="text-xs text-zinc-500 uppercase tracking-widest">{t('lobby_slot')} 2</span>
          <span className="text-lg font-bold">{match.p2.submitted ? t('lobby_occupied') : `${t('lobby_enter_slot')} 2`}</span>
        </Button>
      </div>
    </motion.div>
  );
}

function SubmitForm({ slot, onSubmit, isLoading, t }: { slot: 'p1' | 'p2', onSubmit: (name: string, list: string) => void, isLoading: boolean, t: any, key?: string }) {
  const [name, setName] = useState('');
  const [list, setList] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim() && list.trim()) {
      onSubmit(name, list);
    }
  };

  return (
    <motion.div initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
      <Card>
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-orange-600/20 rounded-lg flex items-center justify-center">
            <Lock className="w-5 h-5 text-orange-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold">{t('submit_title')}</h2>
            <p className="text-xs text-zinc-500 uppercase tracking-widest">{t('lobby_slot')} {slot === 'p1' ? '1' : '2'}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-400">{t('submit_name_label')}</label>
            <input 
              required
              type="text" 
              placeholder={t('submit_name_placeholder')}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 focus:outline-none focus:border-orange-600 transition-colors"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-400">{t('submit_list_label')}</label>
            <textarea 
              required
              placeholder={t('submit_list_placeholder')}
              value={list}
              onChange={(e) => setList(e.target.value)}
              className="w-full h-64 bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 font-mono text-sm focus:outline-none focus:border-orange-600 transition-colors resize-none"
            />
          </div>

          <div className="p-4 bg-orange-600/10 border border-orange-600/20 rounded-lg flex gap-3">
            <AlertCircle className="w-5 h-5 text-orange-600 shrink-0" />
            <p className="text-xs text-orange-200/70">
              {t('submit_note')}
            </p>
          </div>

          <Button type="submit" className="w-full py-4 text-lg" isLoading={isLoading}>
            {t('submit_btn')}
          </Button>
        </form>
      </Card>
    </motion.div>
  );
}

function WaitingView({ match, mySlot, t }: { match: Match, mySlot: 'p1' | 'p2', t: any, key?: string }) {
  const otherSlot = mySlot === 'p1' ? 'p2' : 'p1';
  const isOtherSubmitted = match[otherSlot].submitted;

  return (
    <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="space-y-6">
      <Card className="text-center py-12">
        <div className="w-20 h-20 bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-6 relative">
          <Clock className="w-10 h-10 text-zinc-500 animate-pulse" />
          <div className="absolute inset-0 border-4 border-orange-600 border-t-transparent rounded-full animate-spin" />
        </div>
        <h2 className="text-2xl font-bold mb-2">{t('waiting_title')}</h2>
        <p className="text-zinc-500 mb-8">{t('waiting_desc')}</p>

        <div className="grid grid-cols-2 gap-4 max-w-sm mx-auto">
          <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20 flex flex-col items-center">
            <CheckCircle2 className="w-6 h-6 text-green-500 mb-2" />
            <span className="text-xs font-bold uppercase">{t('player_you')}</span>
            <span className="text-[10px] text-green-500/70 uppercase">{t('status_submitted')}</span>
          </div>
          <div className={cn(
            "p-4 rounded-xl flex flex-col items-center transition-colors border",
            isOtherSubmitted ? "bg-green-500/10 border-green-500/20" : "bg-zinc-800 border-zinc-700"
          )}>
            {isOtherSubmitted ? (
              <CheckCircle2 className="w-6 h-6 text-green-500 mb-2" />
            ) : (
              <Loader2 className="w-6 h-6 text-zinc-500 animate-spin mb-2" />
            )}
            <span className="text-xs font-bold uppercase">{t('player_opponent')}</span>
            <span className={cn("text-[10px] uppercase", isOtherSubmitted ? "text-green-500/70" : "text-zinc-500")}>
              {isOtherSubmitted ? t('status_submitted') : t('status_typing')}
            </span>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

function RevealView({ match, p1List, p2List, t }: { match: Match, p1List: string | null, p2List: string | null, t: any, key?: string }) {
  const downloadBoth = () => {
    const content = `WARHAMMER 40K - MATCH ${match.id}\n` +
      `==========================================\n\n` +
      `PLAYER 1: ${match.p1.name}\n` +
      `SUBMITTED AT: ${match.p1.submittedAt?.toDate ? match.p1.submittedAt.toDate().toLocaleString() : 'N/A'}\n` +
      `------------------------------------------\n` +
      `${p1List || 'Loading...'}\n\n` +
      `==========================================\n\n` +
      `PLAYER 2: ${match.p2.name}\n` +
      `SUBMITTED AT: ${match.p2.submittedAt?.toDate ? match.p2.submittedAt.toDate().toLocaleString() : 'N/A'}\n` +
      `------------------------------------------\n` +
      `${p2List || 'Loading...'}\n`;

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Warhammer_Match_${match.id}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="space-y-8">
      <div className="text-center space-y-4">
        <div className="inline-flex items-center gap-2 bg-green-500/20 text-green-500 px-4 py-1 rounded-full border border-green-500/30 text-sm font-bold uppercase tracking-widest">
          <Eye className="w-4 h-4" /> {t('reveal_status')}
        </div>
        <h2 className="text-3xl font-black italic uppercase tracking-tighter">{t('reveal_title')}</h2>
        
        <div className="flex justify-center">
          <Button onClick={downloadBoth} variant="outline" className="gap-2">
            <Copy className="w-4 h-4" /> {t('reveal_download')}
          </Button>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <PlayerListCard name={match.p1.name} list={p1List} slot={`${t('lobby_slot')} 1`} submittedAt={match.p1.submittedAt} t={t} />
        <PlayerListCard name={match.p2.name} list={p2List} slot={`${t('lobby_slot')} 2`} submittedAt={match.p2.submittedAt} t={t} />
      </div>

      <Card className="bg-orange-600/10 border-orange-600/30 text-center">
        <Trophy className="w-8 h-8 text-orange-600 mx-auto mb-3" />
        <h3 className="font-bold text-lg mb-1">{t('reveal_wish_fair')}</h3>
        <p className="text-zinc-500 text-sm">{t('reveal_thanks')}</p>
      </Card>
    </motion.div>
  );
}

function PlayerListCard({ name, list, slot, submittedAt, t }: { name: string, list: string | null, slot: string, submittedAt?: any, t: any }) {
  const [copied, setCopied] = useState(false);

  const copyList = () => {
    if (list) {
      navigator.clipboard.writeText(list);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const formatTime = (ts: any) => {
    if (!ts) return '';
    const date = ts.toDate ? ts.toDate() : new Date(ts);
    return date.toLocaleString(undefined, { 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit',
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric' 
    });
  };

  return (
    <Card className="flex flex-col h-full bg-zinc-900/80">
      <div className="flex items-center justify-between mb-4 border-b border-zinc-800 pb-4">
        <div>
          <span className="text-[10px] text-zinc-500 font-bold tracking-widest uppercase">{slot}</span>
          <h3 className="text-xl font-bold text-orange-500 truncate max-w-[180px]">{name}</h3>
          {submittedAt && (
            <div className="flex items-center gap-1 text-[10px] text-zinc-600 mt-0.5">
              <Clock className="w-3 h-3" />
              <span>{t('card_submitted_at')}: {formatTime(submittedAt)}</span>
            </div>
          )}
        </div>
        <Button onClick={copyList} variant="ghost" className="p-2">
          {copied ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
        </Button>
      </div>
      
      <div className="flex-1 bg-black/40 rounded-lg p-4 overflow-auto max-h-[500px] scrollbar-thin scrollbar-thumb-zinc-700">
        {list ? (
          <pre className="text-xs font-mono text-zinc-400 whitespace-pre-wrap leading-relaxed">
            {list}
          </pre>
        ) : (
          <div className="flex flex-col items-center justify-center h-40 text-zinc-600">
            <Loader2 className="w-6 h-6 animate-spin mb-2" />
            <span className="text-xs">{t('card_loading_content')}</span>
          </div>
        )}
      </div>
    </Card>
  );
}
