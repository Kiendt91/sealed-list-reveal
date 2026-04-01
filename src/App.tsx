import React, { Component, useState, useEffect, useMemo } from 'react';
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
  History,
  Gamepad2,
  RotateCcw,
  Dices
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
import { auth, db } from './firebase';
import { cn } from './lib/utils';
import { Match, PlayerMetadata, ListContent, GameData } from './types';

// --- Error Handling ---
enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

class ErrorBoundary extends Component<any, any> {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      let displayError = "Đã xảy ra lỗi không mong muốn.";
      try {
        const parsed = JSON.parse(this.state.error.message);
        if (parsed.error.includes("permission-denied")) {
          displayError = "Bạn không có quyền thực hiện hành động này. Vui lòng kiểm tra lại.";
        }
      } catch (e) {
        displayError = this.state.error.message || displayError;
      }

      return (
        <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-2xl max-w-md w-full text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2 text-white">Oops! Có lỗi xảy ra</h2>
            <p className="text-zinc-500 mb-6">{displayError}</p>
            <Button onClick={() => window.location.reload()} variant="primary" className="w-full">
              Tải lại trang
            </Button>
          </div>
        </div>
      );
    }
    return (this as any).props.children;
  }
}

// --- Constants ---
const MATCH_EXPIRY_HOURS = 168; // 7 days

// --- Helper Components ---
const Countdown = ({ expiresAt }: { expiresAt: any }) => {
  const [timeLeft, setTimeLeft] = useState<string>('');

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date().getTime();
      const expiry = expiresAt?.toDate ? expiresAt.toDate().getTime() : new Date(expiresAt).getTime();
      const distance = expiry - now;

      if (distance < 0) {
        setTimeLeft('ĐÃ HẾT HẠN');
        clearInterval(timer);
        return;
      }

      const days = Math.floor(distance / (1000 * 60 * 60 * 24));
      const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((distance % (1000 * 60)) / 1000);

      setTimeLeft(`${days} ngày ${hours}h ${minutes}m ${seconds}s`);
    }, 1000);

    return () => clearInterval(timer);
  }, [expiresAt]);

  return (
    <div className="flex items-center gap-2 text-orange-500 font-mono text-xs bg-orange-500/10 px-3 py-1.5 rounded-full border border-orange-500/20">
      <Clock className="w-3.5 h-3.5" />
      <span className="uppercase tracking-widest font-bold">Hết hạn sau: {timeLeft}</span>
    </div>
  );
};
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

const Card = ({ children, className, onClick, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div 
    onClick={onClick}
    className={cn('bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 backdrop-blur-sm', className)}
    {...props}
  >
    {children}
  </div>
);

// --- Main Application ---
export default function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}

function PublicMatches({ onSelectMatch, t }: { onSelectMatch: (id: string) => void, t: any }) {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, 'matches'),
      where('revealed', '==', true),
      orderBy('revealedAt', 'desc'),
      limit(20)
    );

    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Match));
      setMatches(data);
      setLoading(false);
    }, (error) => {
      console.error('Error fetching public matches:', error);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  if (loading) return (
    <div className="flex justify-center py-8">
      <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
    </div>
  );

  if (matches.length === 0) return null;

  return (
    <div className="mt-12 space-y-6">
      <div className="flex items-center gap-2 mb-4">
        <History className="w-5 h-5 text-orange-500" />
        <h3 className="text-lg font-bold uppercase tracking-wider">{t('public_matches')}</h3>
      </div>
      
      <div className="grid gap-4">
        {matches.map((m) => (
          <Card 
            key={m.id} 
            className="hover:border-orange-500/30 transition-colors cursor-pointer group bg-zinc-900/30"
            onClick={() => onSelectMatch(m.id)}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-8">
                <div className="flex flex-col">
                  <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-tighter">SLOT 1</span>
                  <span className="font-bold text-zinc-200">{m.p1.name || 'Anonymous'}</span>
                </div>
                <div className="text-zinc-700 font-black italic text-sm">VS</div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-tighter">SLOT 2</span>
                  <span className="font-bold text-zinc-200">{m.p2.name || 'Anonymous'}</span>
                </div>
              </div>
              
              <div className="flex items-center gap-4">
                <div className="hidden sm:flex flex-col items-end">
                  <span className="text-[10px] text-zinc-500 font-bold uppercase">REVEALED</span>
                  <span className="text-[10px] text-zinc-600">
                    {m.revealedAt?.toDate ? m.revealedAt.toDate().toLocaleString() : 'Recent'}
                  </span>
                </div>
                <div className="font-mono text-xs bg-zinc-800 px-3 py-1.5 rounded-lg group-hover:bg-orange-600/20 group-hover:text-orange-500 transition-all border border-zinc-700 group-hover:border-orange-500/30">
                  {m.id}
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

// --- Translations ---
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
    submit_list_label: "Army Lists (Bạn có thể nộp nhiều list)",
    submit_list_add: "Thêm List",
    submit_list_delete: "Xóa",
    submit_list_placeholder: "Dán danh sách quân đội của bạn tại đây...",
    submit_note: "Lưu ý: Sau khi nộp, bạn sẽ không thể chỉnh sửa danh sách. Danh sách chỉ được hiển thị khi đối thủ của bạn cũng đã nộp xong. Nếu nộp nhiều list, hệ thống sẽ chọn ngẫu nhiên 1 list để thi đấu.",
    submit_btn: "Niêm Phong & Nộp",
    waiting_title: "Đang Chờ Đối Thủ",
    waiting_desc: "Bạn đã nộp list thành công. Hệ thống đang chờ đối thủ hoàn tất.",
    player_you: "BẠN",
    player_opponent: "ĐỐI THỦ",
    status_submitted: "ĐÃ NỘP",
    status_typing: "ĐANG NHẬP...",
    your_lists: "Danh sách của bạn",
    reveal_status: "ĐÃ CÔNG BỐ",
    reveal_status_finished: "TRẬN ĐẤU ĐÃ KẾT THÚC",
    reveal_title: "Trận Đấu Bắt Đầu!",
    reveal_download: "Tải Xuống Cả Hai List (.txt)",
    reveal_finish_btn: "Kết Thúc Trận Đấu & Khóa Điểm",
    reveal_wish_fair: "Chúc các bạn có một trận đấu công bằng!",
    reveal_thanks: "Cảm ơn đã sử dụng Sealed List Reveal.",
    reveal_win: "chúc mừng chiên thắng!",
    reveal_draw: "Trận đấu kết thúc với tỉ số hòa!",
    reveal_final_score: "Tỉ số chung cuộc",
    card_submitted_at: "Nộp lúc",
    card_score: "ĐIỂM SỐ",
    card_loading_content: "Đang tải nội dung...",
    card_player_submitted: "Người chơi đã nộp",
    card_choose_list: "Hãy chọn một list để bắt đầu",
    card_or: "HOẶC",
    card_random: "CHỌN NGẪU NHIÊN",
    card_selected_list: "Đã chọn List",
    card_change_list: "Đổi List",
    dashboard_title: "Bảng Điều Khiển Trận Đấu",
    dashboard_sub: "Công cụ hỗ trợ thời gian thực",
    dashboard_mission: "Chưa tạo mission",
    dashboard_roll_draw: "Hòa! Hãy roll lại.",
    dashboard_quick_roll: "Roll nhanh kết quả",
    public_matches: "Trận Đấu Đã Reveal",
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
    submit_list_label: "Army Lists (You can submit multiple)",
    submit_list_add: "Add List",
    submit_list_delete: "Remove",
    submit_list_placeholder: "Paste your army list here...",
    submit_note: "Note: You cannot edit your list after submission. It will only be revealed when your opponent also submits. If multiple lists are submitted, one will be chosen randomly.",
    submit_btn: "Seal & Submit",
    waiting_title: "Waiting for Opponent",
    waiting_desc: "You have submitted successfully. Waiting for your opponent to complete.",
    player_you: "YOU",
    player_opponent: "OPPONENT",
    status_submitted: "SUBMITTED",
    status_typing: "ENTERING...",
    your_lists: "Your Lists",
    reveal_status: "REVEALED",
    reveal_status_finished: "MATCH FINISHED",
    reveal_title: "Let the Battle Begin!",
    reveal_download: "Download Both Lists (.txt)",
    reveal_finish_btn: "Finish Match & Lock Scores",
    reveal_wish_fair: "Have a fair and glorious battle!",
    reveal_thanks: "Thanks for using Sealed List Reveal.",
    reveal_win: "Congratulations on your victory!",
    reveal_draw: "The match ended in a draw!",
    reveal_final_score: "Final Score",
    card_submitted_at: "Submitted at",
    card_score: "SCORE",
    card_loading_content: "Loading content...",
    card_player_submitted: "Player submitted",
    card_choose_list: "Choose a list to begin",
    card_or: "OR",
    card_random: "RANDOM SELECTION",
    card_selected_list: "Selected List",
    card_change_list: "Change List",
    dashboard_title: "Match Dashboard",
    dashboard_sub: "Real-time support tools",
    dashboard_mission: "No mission generated",
    dashboard_roll_draw: "Draw! Roll again.",
    dashboard_quick_roll: "Quick roll results",
    public_matches: "Revealed Matches",
    common_loading: "Loading...",
  }
};

function AppContent() {
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
    expiresAt.setHours(expiresAt.getHours() + MATCH_EXPIRY_HOURS);

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
              <HomeView 
                key="home" 
                onCreate={createMatch} 
                onSelectMatch={(id) => {
                  window.history.pushState({}, '', `/${id}`);
                  setMatchId(id);
                  setView('match');
                }} 
                t={t}
              />
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

function HomeView({ onCreate, onSelectMatch, t }: { onCreate: () => void, onSelectMatch: (id: string) => void, t: any, key?: string }) {
  const [matchCode, setMatchCode] = useState('');

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (matchCode.trim()) {
      onSelectMatch(matchCode.trim().toUpperCase());
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

      <PublicMatches onSelectMatch={onSelectMatch} t={t} />
    </motion.div>
  );
}

function MatchView({ id, onBack, t }: { id: string, onBack: () => void, t: any, key?: string }) {
  const [match, setMatch] = useState<Match | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [p1Lists, setP1Lists] = useState<string[] | null>(null);
  const [p2Lists, setP2Lists] = useState<string[] | null>(null);
  const [p1SelectedIndex, setP1SelectedIndex] = useState<number | null>(null);
  const [p2SelectedIndex, setP2SelectedIndex] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [mySlot, setMySlot] = useState<'p1' | 'p2' | null>(null);
  const [p1Score, setP1Score] = useState<number>(0);
  const [p2Score, setP2Score] = useState<number>(0);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'matches', id), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as Match;
        setMatch(data);
        if (data.p1Score !== undefined) setP1Score(data.p1Score);
        if (data.p2Score !== undefined) setP2Score(data.p2Score);
        setLoading(false);
      } else {
        setError(t('match_error_not_found'));
        setLoading(false);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `matches/${id}`);
    });

    return () => unsub();
  }, [id]);

  useEffect(() => {
    if (!match || !id) return;
    
    const unsubs: (() => void)[] = [];

    if (match.revealed) {
      // Listen to both lists
      unsubs.push(onSnapshot(doc(db, 'matches', id, 'lists', 'p1'), (snap) => {
        if (snap.exists()) {
          const data = snap.data() as ListContent;
          setP1Lists(data.items);
          setP1SelectedIndex(data.selectedIndex ?? null);
        }
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, `matches/${id}/lists/p1`);
      }));
      unsubs.push(onSnapshot(doc(db, 'matches', id, 'lists', 'p2'), (snap) => {
        if (snap.exists()) {
          const data = snap.data() as ListContent;
          setP2Lists(data.items);
          setP2SelectedIndex(data.selectedIndex ?? null);
        }
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, `matches/${id}/lists/p2`);
      }));
    } else if (mySlot && match[mySlot].submitted) {
      // Listen to my own list
      unsubs.push(onSnapshot(doc(db, 'matches', id, 'lists', mySlot), (snap) => {
        if (snap.exists()) {
          const data = snap.data() as ListContent;
          if (mySlot === 'p1') {
            setP1Lists(data.items);
            setP1SelectedIndex(data.selectedIndex ?? null);
          } else {
            setP2Lists(data.items);
            setP2SelectedIndex(data.selectedIndex ?? null);
          }
        }
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, `matches/${id}/lists/${mySlot}`);
      }));
    }

    return () => unsubs.forEach(unsub => unsub());
  }, [match?.revealed, match?.p1.submitted, match?.p2.submitted, mySlot, id]);

  const handleSubmit = async (name: string, lists: string[]) => {
    if (!mySlot) return;
    setSubmitting(true);
    try {
      // 1. Save list content to subcollection (restricted by rules)
      await setDoc(doc(db, 'matches', id, 'lists', mySlot), { 
        items: lists,
        selectedIndex: lists.length === 1 ? 0 : null 
      });
      
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
        updates.revealedAt = serverTimestamp();
        // Set new expiry: 7 days from reveal
        const newExpiry = new Date();
        newExpiry.setHours(newExpiry.getHours() + MATCH_EXPIRY_HOURS);
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

  const randomizeList = async (slot: 'p1' | 'p2') => {
    const lists = slot === 'p1' ? p1Lists : p2Lists;
    if (!lists || lists.length <= 1) return;
    
    const randomIndex = Math.floor(Math.random() * lists.length);
    await selectList(slot, randomIndex);
  };

  const selectList = async (slot: 'p1' | 'p2', index: number) => {
    try {
      await updateDoc(doc(db, 'matches', id, 'lists', slot), {
        selectedIndex: index
      });
      if (slot === 'p1') setP1SelectedIndex(index);
      else setP2SelectedIndex(index);
    } catch (err) {
      console.error(err);
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

      {match?.expiresAt && (
        <div className="flex justify-center mb-6">
          <Countdown expiresAt={match.expiresAt} />
        </div>
      )}

      <AnimatePresence mode="wait">
        {phase === 'lobby' && (
          <LobbyView key="lobby" id={id} match={match!} onJoin={(slot) => setMySlot(slot)} t={t} />
        )}
        {phase === 'submit' && (
          <SubmitForm key="submit" slot={mySlot!} onSubmit={handleSubmit} isLoading={submitting} t={t} />
        )}
        {phase === 'waiting' && (
          <WaitingView 
            key="waiting" 
            match={match!} 
            mySlot={mySlot!} 
            lists={mySlot === 'p1' ? p1Lists : p2Lists}
            selectedIndex={mySlot === 'p1' ? p1SelectedIndex : p2SelectedIndex}
            onRandomize={() => randomizeList(mySlot!)}
            onSelectIndex={(idx) => selectList(mySlot!, idx)}
            t={t}
          />
        )}
        {phase === 'reveal' && (
          <RevealView 
            key="reveal" 
            match={match!} 
            p1Lists={p1Lists} 
            p2Lists={p2Lists} 
            p1SelectedIndex={p1SelectedIndex}
            p2SelectedIndex={p2SelectedIndex}
            onRandomize={randomizeList}
            onSelectIndex={selectList}
            p1Score={p1Score}
            setP1Score={setP1Score}
            p2Score={p2Score}
            setP2Score={setP2Score}
            t={t}
          />
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

function SubmitForm({ slot, onSubmit, isLoading, t }: { slot: 'p1' | 'p2', onSubmit: (name: string, lists: string[]) => void, isLoading: boolean, t: any, key?: string }) {
  const [name, setName] = useState('');
  const [lists, setLists] = useState<string[]>(['']);

  const addList = () => setLists([...lists, '']);
  const removeList = (index: number) => setLists(lists.filter((_, i) => i !== index));
  const updateList = (index: number, value: string) => {
    const newLists = [...lists];
    newLists[index] = value;
    setLists(newLists);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const validLists = lists.filter(l => l.trim());
    if (name.trim() && validLists.length > 0) {
      onSubmit(name, validLists);
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

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-zinc-400">{t('submit_list_label')}</label>
              <button 
                type="button" 
                onClick={addList}
                className="text-xs text-orange-500 hover:text-orange-400 font-bold uppercase flex items-center gap-1"
              >
                <Plus className="w-3 h-3" /> {t('submit_list_add')}
              </button>
            </div>
            
            {lists.map((list, idx) => (
              <div key={idx} className="space-y-2 relative group">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-zinc-600 font-bold uppercase">List #{idx + 1}</span>
                  {lists.length > 1 && (
                    <button 
                      type="button" 
                      onClick={() => removeList(idx)}
                      className="text-[10px] text-red-500 hover:text-red-400 font-bold uppercase opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      {t('submit_list_delete')}
                    </button>
                  )}
                </div>
                <textarea 
                  required
                  placeholder={t('submit_list_placeholder')}
                  value={list}
                  onChange={(e) => updateList(idx, e.target.value)}
                  className="w-full h-48 bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 font-mono text-sm focus:outline-none focus:border-orange-600 transition-colors resize-none"
                />
              </div>
            ))}
          </div>

          <div className="p-4 bg-orange-600/10 border border-orange-600/20 rounded-lg flex gap-3">
            <AlertCircle className="w-5 h-5 text-orange-600 shrink-0" />
            <p className="text-xs text-orange-200/70">
              {t('submit_note')}
            </p>
          </div>

          <Button type="submit" className="w-full py-4 text-lg" isLoading={isLoading}>
            {t('submit_btn')} {lists.length > 1 ? `(${lists.length} Lists)` : ''}
          </Button>
        </form>
      </Card>
    </motion.div>
  );
}

function WaitingView({ 
  match, 
  mySlot, 
  lists, 
  selectedIndex, 
  onRandomize,
  onSelectIndex,
  t
}: { 
  match: Match, 
  mySlot: 'p1' | 'p2', 
  lists: string[] | null, 
  selectedIndex: number | null, 
  onRandomize: () => void,
  onSelectIndex: (idx: number) => void,
  t: any,
  key?: string 
}) {
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

      <div className="max-w-md mx-auto">
        <h3 className="text-sm font-bold text-zinc-500 uppercase tracking-widest mb-4 text-center">{t('your_lists')}</h3>
        <PlayerListCard 
          name={match[mySlot].name} 
          lists={lists} 
          selectedIndex={selectedIndex}
          onRandomize={onRandomize}
          onSelectIndex={onSelectIndex}
          slot={mySlot === 'p1' ? 'SLOT 1' : 'SLOT 2'} 
          submittedAt={match[mySlot].submittedAt} 
          isRevealed={false}
          t={t}
        />
      </div>
    </motion.div>
  );
}

const MISSIONS = {
  deployments: ["Search and Destroy", "Crucible of Battle", "Sweeping Engagement", "Hammer and Anvil", "Tipping Point"],
  primaries: ["Take and Hold", "Scorched Earth", "Purge the Foe", "Vital Ground", "The Ritual", "Supply Lines"],
  rules: ["Chilling Rain", "Hidden Supplies", "Minefields", "Scrambler Fields", "Vox-static", "Inspired Leadership"]
};

function GameDashboard({ match, t }: { match: Match, t: any }) {
  const [isUpdating, setIsUpdating] = useState(false);
  const [lastRoll, setLastRoll] = useState<string | null>(null);
  
  const updateGame = async (updates: Partial<GameData>) => {
    setIsUpdating(true);
    try {
      const currentData = match.gameData || { turn: 1, p1Vp: 0, p1Cp: 0, p2Vp: 0, p2Cp: 0 };
      await updateDoc(doc(db, 'matches', match.id), {
        gameData: { ...currentData, ...updates }
      });
    } catch (err) {
      console.error(err);
    } finally {
      setIsUpdating(false);
    }
  };

  const generateMission = () => {
    const deployment = MISSIONS.deployments[Math.floor(Math.random() * MISSIONS.deployments.length)];
    const primary = MISSIONS.primaries[Math.floor(Math.random() * MISSIONS.primaries.length)];
    const rule = MISSIONS.rules[Math.floor(Math.random() * MISSIONS.rules.length)];
    updateGame({ mission: { deployment, primary, rule } });
  };

  const rollOff = () => {
    const p1 = Math.floor(Math.random() * 6) + 1;
    const p2 = Math.floor(Math.random() * 6) + 1;
    updateGame({ rollOff: { p1, p2 } });
  };

  const data = match.gameData || { turn: 1, p1Vp: 0, p1Cp: 0, p2Vp: 0, p2Cp: 0 };

  if (match.finished) return null;

  return (
    <Card className="bg-zinc-900/50 border-zinc-800 p-6 space-y-6">
      <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-orange-600/20 rounded-full flex items-center justify-center">
            <Gamepad2 className="w-5 h-5 text-orange-600" />
          </div>
          <div>
            <h3 className="font-bold text-lg">{t('dashboard_title')}</h3>
            <p className="text-xs text-zinc-500 uppercase tracking-widest">{t('dashboard_sub')}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <span className="text-[10px] text-zinc-500 font-bold uppercase block">BATTLE ROUND</span>
            <div className="flex items-center gap-2">
              <Button 
                variant="ghost" size="sm" className="h-8 w-8 p-0"
                onClick={() => updateGame({ turn: Math.max(1, data.turn - 1) })}
              >-</Button>
              <span className="text-2xl font-black text-orange-500">{data.turn}</span>
              <Button 
                variant="ghost" size="sm" className="h-8 w-8 p-0"
                onClick={() => updateGame({ turn: Math.min(5, data.turn + 1) })}
              >+</Button>
            </div>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <div className="md:col-span-1 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Mission Setup</h4>
            <Button variant="ghost" size="sm" onClick={generateMission} className="h-7 text-[10px] gap-1">
              <RotateCcw className="w-3 h-3" /> RANDOM
            </Button>
          </div>
          {data.mission ? (
            <div className="space-y-2">
              <div className="bg-zinc-950/50 p-3 rounded-lg border border-zinc-800/50">
                <span className="text-[9px] text-zinc-600 font-bold uppercase block">Deployment</span>
                <span className="text-sm font-medium text-orange-200/80">{data.mission.deployment}</span>
              </div>
              <div className="bg-zinc-950/50 p-3 rounded-lg border border-zinc-800/50">
                <span className="text-[9px] text-zinc-600 font-bold uppercase block">Primary Mission</span>
                <span className="text-sm font-medium text-orange-200/80">{data.mission.primary}</span>
              </div>
              <div className="bg-zinc-950/50 p-3 rounded-lg border border-zinc-800/50">
                <span className="text-[9px] text-zinc-600 font-bold uppercase block">Mission Rule</span>
                <span className="text-sm font-medium text-orange-200/80">{data.mission.rule}</span>
              </div>
            </div>
          ) : (
            <div className="h-32 border border-dashed border-zinc-800 rounded-lg flex flex-col items-center justify-center text-zinc-600">
              <Dices className="w-6 h-6 mb-2 opacity-20" />
              <p className="text-[10px] uppercase font-bold">{t('dashboard_mission')}</p>
            </div>
          )}
        </div>

        <div className="md:col-span-2 grid grid-cols-2 gap-4">
          {/* Player 1 Stats */}
          <div className="bg-zinc-950/30 p-4 rounded-xl border border-zinc-800/50 space-y-4">
            <div className="text-center border-b border-zinc-800 pb-2">
              <span className="text-[10px] text-zinc-500 font-bold uppercase">{match.p1.name}</span>
            </div>
            <div className="flex justify-around items-center">
              <div className="text-center">
                <span className="text-[9px] text-zinc-600 font-bold uppercase block mb-1">VP (Score)</span>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => updateGame({ p1Vp: Math.max(0, data.p1Vp - 5) })}>-5</Button>
                  <span className="text-2xl font-black text-white">{data.p1Vp}</span>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => updateGame({ p1Vp: data.p1Vp + 5 })}>+</Button>
                </div>
              </div>
              <div className="text-center">
                <span className="text-[9px] text-zinc-600 font-bold uppercase block mb-1">CP</span>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => updateGame({ p1Cp: Math.max(0, data.p1Cp - 1) })}>-</Button>
                  <span className="text-xl font-bold text-orange-500">{data.p1Cp}</span>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => updateGame({ p1Cp: data.p1Cp + 1 })}>+</Button>
                </div>
              </div>
            </div>
          </div>

          {/* Player 2 Stats */}
          <div className="bg-zinc-950/30 p-4 rounded-xl border border-zinc-800/50 space-y-4">
            <div className="text-center border-b border-zinc-800 pb-2">
              <span className="text-[10px] text-zinc-500 font-bold uppercase">{match.p2.name}</span>
            </div>
            <div className="flex justify-around items-center">
              <div className="text-center">
                <span className="text-[9px] text-zinc-600 font-bold uppercase block mb-1">VP (Score)</span>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => updateGame({ p2Vp: Math.max(0, data.p2Vp - 5) })}>-5</Button>
                  <span className="text-2xl font-black text-white">{data.p2Vp}</span>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => updateGame({ p2Vp: data.p2Vp + 5 })}>+</Button>
                </div>
              </div>
              <div className="text-center">
                <span className="text-[9px] text-zinc-600 font-bold uppercase block mb-1">CP</span>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => updateGame({ p2Cp: Math.max(0, data.p2Cp - 1) })}>-</Button>
                  <span className="text-xl font-bold text-orange-500">{data.p2Cp}</span>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => updateGame({ p2Cp: data.p2Cp + 1 })}>+</Button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="md:col-span-1 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Roll-off Tool</h4>
            <Button variant="ghost" size="sm" onClick={rollOff} className="h-7 text-[10px] gap-1">
              <Dices className="w-3 h-3" /> ROLL
            </Button>
          </div>
          <div className="bg-zinc-950/50 p-4 rounded-lg border border-zinc-800/50 flex items-center justify-around">
            <div className="text-center">
              <span className="text-[9px] text-zinc-600 font-bold uppercase block mb-1">{match.p1.name}</span>
              <div className={cn(
                "w-10 h-10 rounded-lg flex items-center justify-center text-xl font-black border",
                data.rollOff ? (data.rollOff.p1 > data.rollOff.p2 ? "bg-green-500/20 border-green-500 text-green-500" : "bg-zinc-900 border-zinc-800 text-zinc-500") : "bg-zinc-900 border-zinc-800 text-zinc-700"
              )}>
                {data.rollOff?.p1 || '?'}
              </div>
            </div>
            <div className="text-zinc-700 font-black italic">VS</div>
            <div className="text-center">
              <span className="text-[9px] text-zinc-600 font-bold uppercase block mb-1">{match.p2.name}</span>
              <div className={cn(
                "w-10 h-10 rounded-lg flex items-center justify-center text-xl font-black border",
                data.rollOff ? (data.rollOff.p2 > data.rollOff.p1 ? "bg-green-500/20 border-green-500 text-green-500" : "bg-zinc-900 border-zinc-800 text-zinc-500") : "bg-zinc-900 border-zinc-800 text-zinc-700"
              )}>
                {data.rollOff?.p2 || '?'}
              </div>
            </div>
          </div>
          {data.rollOff && data.rollOff.p1 === data.rollOff.p2 && (
            <p className="text-[9px] text-orange-500 font-bold text-center uppercase">{t('dashboard_roll_draw')}</p>
          )}
        </div>

        <div className="md:col-span-1 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Quick Dice</h4>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              className="h-10 text-xs font-bold bg-zinc-950/50 border-zinc-800 hover:border-orange-500/50"
              onClick={() => {
                const roll = Math.floor(Math.random() * 6) + 1;
                setLastRoll(`1D6: ${roll}`);
              }}
            >
              1D6
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              className="h-10 text-xs font-bold bg-zinc-950/50 border-zinc-800 hover:border-orange-500/50"
              onClick={() => {
                const r1 = Math.floor(Math.random() * 6) + 1;
                const r2 = Math.floor(Math.random() * 6) + 1;
                setLastRoll(`2D6: ${r1} + ${r2} = ${r1 + r2}`);
              }}
            >
              2D6
            </Button>
          </div>
          {lastRoll && (
            <div className="bg-orange-600/10 border border-orange-600/30 p-2 rounded text-center">
              <span className="text-xs font-black text-orange-500">{lastRoll}</span>
            </div>
          )}
          <p className="text-[8px] text-zinc-600 text-center uppercase">{t('dashboard_quick_roll')}</p>
        </div>
      </div>
    </Card>
  );
}

function RevealView({ 
  match, 
  p1Lists, 
  p2Lists,
  p1SelectedIndex,
  p2SelectedIndex,
  onRandomize,
  onSelectIndex,
  p1Score,
  setP1Score,
  p2Score,
  setP2Score,
  t
}: { 
  match: Match, 
  p1Lists: string[] | null, 
  p2Lists: string[] | null, 
  p1SelectedIndex: number | null,
  p2SelectedIndex: number | null,
  onRandomize: (slot: 'p1' | 'p2') => void,
  onSelectIndex: (slot: 'p1' | 'p2', idx: number) => void,
  p1Score: number,
  setP1Score: (s: number) => void,
  p2Score: number,
  setP2Score: (s: number) => void,
  t: any,
  key?: string 
}) {
  const [isFinishing, setIsFinishing] = useState(false);
  const [copiedScore, setCopiedScore] = useState(false);

  // Sync local score state with gameData VP if not finished
  useEffect(() => {
    if (!match.finished && match.gameData) {
      setP1Score(match.gameData.p1Vp);
      setP2Score(match.gameData.p2Vp);
    }
  }, [match.gameData?.p1Vp, match.gameData?.p2Vp, match.finished]);

  const copyScore = () => {
    const scoreText = `${match.p1Score ?? p1Score} - ${match.p2Score ?? p2Score}`;
    navigator.clipboard.writeText(scoreText);
    setCopiedScore(true);
    setTimeout(() => setCopiedScore(false), 2000);
  };

  const downloadBoth = () => {
    const p1List = p1SelectedIndex !== null ? p1Lists?.[p1SelectedIndex] : 'Chưa chọn list';
    const p2List = p2SelectedIndex !== null ? p2Lists?.[p2SelectedIndex] : 'Chưa chọn list';

    const content = `WARHAMMER 40K - MATCH ${match.id}\n` +
      `==========================================\n\n` +
      `PLAYER 1: ${match.p1.name}\n` +
      `SUBMITTED AT: ${match.p1.submittedAt?.toDate ? match.p1.submittedAt.toDate().toLocaleString() : 'N/A'}\n` +
      `SCORE: ${match.p1Score ?? 'N/A'}\n` +
      `------------------------------------------\n` +
      `${p1List || 'Loading...'}\n\n` +
      `==========================================\n\n` +
      `PLAYER 2: ${match.p2.name}\n` +
      `SUBMITTED AT: ${match.p2.submittedAt?.toDate ? match.p2.submittedAt.toDate().toLocaleString() : 'N/A'}\n` +
      `SCORE: ${match.p2Score ?? 'N/A'}\n` +
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

  const finishMatch = async () => {
    setIsFinishing(true);
    try {
      await updateDoc(doc(db, 'matches', match.id), {
        p1Score,
        p2Score,
        finished: true
      });
    } catch (err) {
      console.error(err);
      alert('Có lỗi xảy ra khi kết thúc trận đấu.');
    } finally {
      setIsFinishing(false);
    }
  };

  return (
    <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="space-y-8">
      <div className="text-center space-y-4">
        <div className="inline-flex items-center gap-2 bg-green-500/20 text-green-500 px-4 py-1 rounded-full border border-green-500/30 text-sm font-bold uppercase tracking-widest">
          <Eye className="w-4 h-4" /> {match.finished ? t('reveal_status_finished') : t('reveal_status')}
        </div>
        <h2 className="text-3xl font-black italic uppercase tracking-tighter">{t('reveal_title')}</h2>
        
        <div className="flex flex-wrap justify-center gap-4">
          <Button onClick={downloadBoth} variant="outline" className="gap-2">
            <Copy className="w-4 h-4" /> {t('reveal_download')}
          </Button>
          {!match.finished && (
            <Button onClick={finishMatch} variant="primary" className="gap-2" isLoading={isFinishing}>
              <ShieldCheck className="w-4 h-4" /> {t('reveal_finish_btn')}
            </Button>
          )}
        </div>
      </div>

      <GameDashboard match={match} t={t} />

      <div className="grid md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <PlayerListCard 
            name={match.p1.name} 
            lists={p1Lists} 
            selectedIndex={p1SelectedIndex}
            onRandomize={() => onRandomize('p1')}
            onSelectIndex={(idx) => onSelectIndex('p1', idx)}
            slot="SLOT 1" 
            submittedAt={match.p1.submittedAt} 
            score={match.finished ? match.p1Score : p1Score}
            onScoreChange={match.finished ? undefined : setP1Score}
            isRevealed={true}
            isFinished={match.finished}
            t={t}
          />
        </div>
        <div className="space-y-4">
          <PlayerListCard 
            name={match.p2.name} 
            lists={p2Lists} 
            selectedIndex={p2SelectedIndex}
            onRandomize={() => onRandomize('p2')}
            onSelectIndex={(idx) => onSelectIndex('p2', idx)}
            slot="SLOT 2" 
            submittedAt={match.p2.submittedAt} 
            score={match.finished ? match.p2Score : p2Score}
            onScoreChange={match.finished ? undefined : setP2Score}
            isRevealed={true}
            isFinished={match.finished}
            t={t}
          />
        </div>
      </div>

      <Card className="bg-orange-600/10 border-orange-600/30 text-center">
        <Trophy className="w-8 h-8 text-orange-600 mx-auto mb-3" />
        {match.finished ? (
          <>
            <h3 className="font-bold text-lg mb-1 text-orange-500">
              {match.p1Score! > match.p2Score! ? `${match.p1.name} ${t('reveal_win')}` : 
               match.p2Score! > match.p1Score! ? `${match.p2.name} ${t('reveal_win')}` : 
               t('reveal_draw')}
            </h3>
            <div className="flex flex-col items-center gap-2 mt-4">
              <span className="text-zinc-500 text-[10px] uppercase font-bold tracking-widest">{t('reveal_final_score')}</span>
              <div className="flex items-center gap-4 bg-zinc-950/50 border border-zinc-800 px-8 py-4 rounded-2xl shadow-inner">
                <span className="text-5xl font-black text-white tracking-tighter tabular-nums">
                  {match.p1Score} <span className="text-orange-600 mx-1">-</span> {match.p2Score}
                </span>
                <button 
                  onClick={copyScore}
                  className="text-orange-500 hover:text-orange-400 transition-colors p-2 bg-zinc-900 rounded-lg border border-zinc-800 hover:border-orange-600/50"
                  title="Copy"
                >
                  {copiedScore ? <CheckCircle2 className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                </button>
              </div>
            </div>
          </>
        ) : (
          <>
            <h3 className="font-bold text-lg mb-1">{t('reveal_wish_fair')}</h3>
            <p className="text-zinc-500 text-sm">{t('reveal_thanks')}</p>
          </>
        )}
      </Card>
    </motion.div>
  );
}

function PlayerListCard({ 
  name, 
  lists, 
  selectedIndex,
  onRandomize,
  onSelectIndex,
  slot, 
  submittedAt, 
  score, 
  onScoreChange, 
  isRevealed,
  isFinished,
  t
}: { 
  name: string, 
  lists: string[] | null, 
  selectedIndex: number | null,
  onRandomize: () => void,
  onSelectIndex: (idx: number) => void,
  slot: string, 
  submittedAt?: any,
  score?: number,
  onScoreChange?: (score: number) => void,
  isRevealed?: boolean,
  isFinished?: boolean,
  t: any
}) {
  const [copied, setCopied] = useState(false);
  const list = selectedIndex !== null ? lists?.[selectedIndex] : null;

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
        <div className="flex items-center gap-2">
          <div className="flex flex-col items-end">
            <span className="text-[10px] text-zinc-500 font-bold uppercase">{t('card_score')}</span>
            {isFinished ? (
              <span className="text-2xl font-black text-white">{score ?? 0}</span>
            ) : (
              <input 
                type="number" 
                value={score ?? 0}
                onChange={(e) => onScoreChange?.(parseInt(e.target.value) || 0)}
                className="w-16 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-center font-bold text-lg focus:outline-none focus:border-orange-600"
              />
            )}
          </div>
          <Button onClick={copyList} variant="ghost" className="p-2" disabled={!list}>
            {copied ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
          </Button>
        </div>
      </div>
      
      <div className="flex-1 bg-black/40 rounded-lg p-4 overflow-auto max-h-[500px] scrollbar-thin scrollbar-thumb-zinc-700 min-h-[300px]">
        {selectedIndex !== null ? (
          <pre className="text-xs font-mono text-zinc-400 whitespace-pre-wrap leading-relaxed">
            {list}
          </pre>
        ) : lists && lists.length > 0 ? (
          <div className="flex flex-col items-center justify-center h-full space-y-4 py-10">
            <div className="w-16 h-16 bg-orange-600/10 rounded-full flex items-center justify-center">
              <Dices className="w-8 h-8 text-orange-600" />
            </div>
            <div className="text-center w-full px-4">
              <h4 className="font-bold text-lg mb-1">{t('card_player_submitted')} {lists.length} List</h4>
              <p className="text-xs text-zinc-500 uppercase tracking-widest mb-6">{t('card_choose_list')}</p>
              
              <div className="grid gap-2 mb-6 max-w-[280px] mx-auto">
                {lists.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => onSelectIndex(idx)}
                    className="flex items-center justify-between p-3 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-orange-500/50 transition-colors group"
                  >
                    <span className="text-xs font-bold text-zinc-400 group-hover:text-zinc-200">LIST #{idx + 1}</span>
                    <div className="w-4 h-4 rounded-full border-2 border-zinc-700 group-hover:border-orange-500" />
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-3">
                <div className="h-px bg-zinc-800 flex-1" />
                <span className="text-[10px] text-zinc-600 font-bold">{t('card_or')}</span>
                <div className="h-px bg-zinc-800 flex-1" />
              </div>

              <Button onClick={onRandomize} variant="outline" className="w-full mt-4 border-zinc-800 hover:bg-zinc-800">
                <RotateCcw className="w-4 h-4" /> {t('card_random')}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-40 text-zinc-600">
            <Loader2 className="w-6 h-6 animate-spin mb-2" />
            <span className="text-xs">{t('card_loading_content')}</span>
          </div>
        )}
      </div>

      {selectedIndex !== null && lists && lists.length > 1 && (
        <div className="mt-4 pt-4 border-t border-zinc-800 flex items-center justify-between">
          <span className="text-[10px] text-zinc-500 font-bold uppercase">{t('card_selected_list')} #{selectedIndex + 1} / {lists.length}</span>
          {!isFinished && !isRevealed && (
            <div className="flex items-center gap-3">
              <button 
                onClick={() => onSelectIndex((selectedIndex + 1) % lists.length)} 
                className="text-[10px] text-zinc-500 hover:text-zinc-300 font-bold uppercase"
              >
                {t('card_change_list')}
              </button>
              <button onClick={onRandomize} className="text-[10px] text-orange-500 hover:text-orange-400 font-bold uppercase flex items-center gap-1">
                <RotateCcw className="w-3 h-3" /> {t('card_random')}
              </button>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
