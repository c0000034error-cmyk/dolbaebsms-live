import React, { useState, useEffect, useRef } from 'react';
import { db } from './services/firebase';
import { ref, onValue, set, update, push, off, query, orderByChild, startAt, endAt } from 'firebase/database';
import { User, Message, ChatPreview } from './types';
import { Button } from './components/Button';
import { MessageBubble } from './components/MessageBubble';
import { SettingsModal } from './components/SettingsModal';
import { Search, Send, Image as ImageIcon, Mic, X, ChevronLeft, Video, Settings as SettingsIcon, Menu, Trash2 } from 'lucide-react';

const App: React.FC = () => {
  // Auth State
  const [currentUser, setCurrentUser] = useState<string | null>(() => localStorage.getItem('dolbaeb_user'));
  const [isLoginView, setIsLoginView] = useState(true);
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [authError, setAuthError] = useState('');
  
  // App State
  const [chats, setChats] = useState<ChatPreview[]>([]);
  const [activeChatUser, setActiveChatUser] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showMobileSidebar, setShowMobileSidebar] = useState(true);
  
  // Media State
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // --- Effects ---

  useEffect(() => {
    if (currentUser) {
      // Set online status
      const userRef = ref(db, `users/${currentUser}`);
      update(userRef, { isOnline: true, lastSeen: Date.now() });

      // Load chats
      const messagesRef = ref(db, 'messages');
      const unsubscribe = onValue(messagesRef, (snapshot) => {
        const data = snapshot.val();
        if (!data) {
          setChats([]);
          return;
        }

        const newChats: Map<string, ChatPreview> = new Map();
        
        Object.entries(data).forEach(([chatId, msgs]: [string, any]) => {
          const users = chatId.split('_');
          if (users.includes(currentUser)) {
            const otherUser = users.find(u => u !== currentUser);
            
            // Handle chat with self or logic error
            const targetUser = otherUser || (users.length === 2 && users[0] === users[1] ? users[0] : null);

            if (targetUser) {
              const msgList = Object.values(msgs) as Message[];
              // Filter out deleted messages for preview, but ensure chat still shows if history exists
              const validMsgs = msgList.filter(m => !m.deleted).sort((a, b) => b.timestamp - a.timestamp);
              
              if (validMsgs.length > 0) {
                newChats.set(targetUser, {
                  user: targetUser,
                  lastMessage: validMsgs[0],
                  timestamp: validMsgs[0].timestamp,
                  isOnline: false 
                });
              } else if (msgList.length > 0) {
                // If all messages deleted, show "Chat cleared" or similar (optional, here we show nothing to keep clean)
              }
            }
          }
        });

        setChats(Array.from(newChats.values()).sort((a, b) => b.timestamp - a.timestamp));
      });

      return () => {
        off(messagesRef);
        if (currentUser) {
           update(userRef, { isOnline: false, lastSeen: Date.now() }).catch(() => {});
        }
      };
    }
  }, [currentUser]);

  useEffect(() => {
    if (currentUser && activeChatUser) {
      const chatId = [currentUser, activeChatUser].sort().join('_');
      const chatRef = ref(db, `messages/${chatId}`);
      
      const unsubscribe = onValue(chatRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
          const loadedMessages = Object.entries(data).map(([key, val]: [string, any]) => ({
            ...val,
            id: key
          }));
          setMessages(loadedMessages.sort((a, b) => a.timestamp - b.timestamp));
        } else {
          setMessages([]);
        }
      });

      // On mobile, hide sidebar when chat opens
      setShowMobileSidebar(false);

      return () => off(chatRef);
    } else {
      setShowMobileSidebar(true);
    }
  }, [currentUser, activeChatUser]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isRecording]); // scroll when recording starts too to see indicators

  // --- Handlers ---

  const handleAuth = async () => {
    if (!usernameInput.trim() || !passwordInput.trim()) return;
    
    // Normalize username only if strict matching is desired, but based on DB, we use as-is
    const cleanUsername = usernameInput.trim();
    const userRef = ref(db, `users/${cleanUsername}`);
    
    onValue(userRef, (snapshot) => {
      const data = snapshot.val();
      
      if (isLoginView) {
        if (data && data.password === passwordInput) {
          localStorage.setItem('dolbaeb_user', cleanUsername);
          setCurrentUser(cleanUsername);
          setAuthError('');
        } else {
          setAuthError('Неверный логин или пароль');
        }
      } else {
        if (data) {
          setAuthError('Пользователь уже существует');
        } else {
          set(userRef, {
            username: cleanUsername,
            password: passwordInput,
            createdAt: Date.now(),
            isOnline: true,
            lastSeen: Date.now()
          }).then(() => {
            localStorage.setItem('dolbaeb_user', cleanUsername);
            setCurrentUser(cleanUsername);
            setAuthError('');
          });
        }
      }
    }, { onlyOnce: true });
  };

  const handleLogout = () => {
    if (currentUser) {
      update(ref(db, `users/${currentUser}`), { isOnline: false, lastSeen: Date.now() });
    }
    localStorage.removeItem('dolbaeb_user');
    setCurrentUser(null);
    setActiveChatUser(null);
    setChats([]);
    setIsSettingsOpen(false);
  };

  const handleSendMessage = async (type: 'text' | 'photo' | 'video' | 'audio' = 'text', content: string = messageInput) => {
    if ((!content.trim() && type === 'text') || !currentUser || !activeChatUser) return;

    const chatId = [currentUser, activeChatUser].sort().join('_');
    const messagesRef = ref(db, `messages/${chatId}`);
    
    const newMessage: Message = {
      sender: currentUser,
      text: type === 'text' ? content : '',
      timestamp: Date.now(),
      type: type,
      mediaUrl: type !== 'text' ? content : undefined,
      deleted: false
    };

    try {
      await push(messagesRef, newMessage);
      if (type === 'text') setMessageInput('');
    } catch (e) {
      alert("Ошибка отправки сообщения. Возможно, файл слишком большой.");
    }
  };

  const handleSearch = (term: string) => {
    setSearchQuery(term);
    if (!term.trim()) {
      setSearchResults([]);
      return;
    }

    const usersRef = ref(db, 'users');
    // Basic search implementation
    const q = query(usersRef, orderByChild('username'), startAt(term), endAt(term + '\uf8ff'));
    
    onValue(q, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const users = Object.values(data) as User[];
        setSearchResults(users.filter(u => u.username !== currentUser));
      } else {
        setSearchResults([]);
      }
    }, { onlyOnce: true });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'photo' | 'video') => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Increased limit to 4MB for better experience
    if (file.size > 4 * 1024 * 1024) {
      alert('Файл слишком большой. Максимум 4MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      handleSendMessage(type, base64);
    };
    reader.onerror = () => alert("Ошибка чтения файла");
    reader.readAsDataURL(file);
    
    // Reset input
    e.target.value = '';
  };

  const toggleRecording = async () => {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
    } else {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            alert("Ваш браузер не поддерживает запись аудио.");
            return;
        }

        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        // Prefer supported mime types
        const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 
                         MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4' : '';
        
        const mediaRecorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
        const audioChunks: Blob[] = [];

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) audioChunks.push(event.data);
        };

        mediaRecorder.onstop = () => {
          const finalMime = mediaRecorder.mimeType || 'audio/webm';
          const audioBlob = new Blob(audioChunks, { type: finalMime });
          
          if (audioBlob.size < 100) {
              alert("Запись слишком короткая");
              return;
          }

          const reader = new FileReader();
          reader.onload = (e) => {
            const base64 = e.target?.result as string;
            handleSendMessage('audio', base64);
          };
          reader.readAsDataURL(audioBlob);
          stream.getTracks().forEach(track => track.stop());
        };

        mediaRecorder.start();
        setIsRecording(true);
        mediaRecorderRef.current = mediaRecorder;
      } catch (err) {
        console.error("Mic error:", err);
        alert("Ошибка доступа к микрофону. Разрешите доступ в настройках браузера.");
      }
    }
  };

  // --- Render ---

  if (!currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-slate-950 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-900/40 via-slate-950 to-slate-950">
        <div className="w-full max-w-md bg-slate-900/60 backdrop-blur-xl p-8 rounded-3xl shadow-2xl border border-indigo-500/20 animate-fade-in relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500"></div>
          
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-slate-800 border-4 border-slate-700 mb-6 shadow-xl relative group">
              <div className="absolute inset-0 rounded-full bg-indigo-500/20 animate-pulse group-hover:bg-indigo-500/30 transition-colors"></div>
              <svg className="w-12 h-12 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <h1 className="text-4xl font-bold text-white mb-2 tracking-tight">DolbaebSMS</h1>
            <p className="text-slate-400 font-light">Secure. Fast. Simple.</p>
          </div>

          <div className="space-y-5">
            {authError && (
              <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center font-medium animate-slide-up">
                {authError}
              </div>
            )}
            <div className="space-y-4">
              <input 
                type="text" 
                placeholder="Имя пользователя" 
                className="w-full bg-slate-950/50 border border-slate-700 rounded-xl px-5 py-4 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 transition-all shadow-inner"
                value={usernameInput}
                onChange={(e) => setUsernameInput(e.target.value)}
              />
              <input 
                type="password" 
                placeholder="Пароль" 
                className="w-full bg-slate-950/50 border border-slate-700 rounded-xl px-5 py-4 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 transition-all shadow-inner"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAuth()}
              />
            </div>
            
            <Button className="w-full py-4 text-lg shadow-indigo-500/25" onClick={handleAuth}>
              {isLoginView ? 'Войти' : 'Создать аккаунт'}
            </Button>
            
            <div className="flex justify-center mt-6">
              <button 
                onClick={() => { setIsLoginView(!isLoginView); setAuthError(''); }}
                className="text-slate-400 hover:text-indigo-400 text-sm transition-colors py-2"
              >
                {isLoginView ? 'Впервые здесь? Создать аккаунт' : 'Уже есть аккаунт? Войти'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- Main App Interface ---
  return (
    <div className="flex h-screen overflow-hidden bg-slate-950">
      <SettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
        currentUser={currentUser}
        onLogout={handleLogout}
      />

      {/* Sidebar - Chats List */}
      <div className={`${showMobileSidebar ? 'flex' : 'hidden'} md:flex w-full md:w-[420px] flex-col border-r border-slate-800 bg-slate-900 z-10 shadow-2xl relative`}>
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90 backdrop-blur-sm sticky top-0 z-20 h-[72px]">
          <div className="flex items-center gap-3">
            <button 
               className="md:hidden text-slate-400"
               onClick={() => {}} // Could be menu toggle
            >
               <Menu size={24} />
            </button>
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white font-bold text-lg shadow-lg ring-2 ring-slate-800">
              {currentUser[0].toUpperCase()}
            </div>
            <div className="flex flex-col">
              <h2 className="font-bold text-white leading-tight">{currentUser}</h2>
              <span className="text-[11px] text-green-500 font-medium flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                В сети
              </span>
            </div>
          </div>
          <button 
            onClick={() => setIsSettingsOpen(true)} 
            className="p-2.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-all hover:scale-105"
            title="Настройки"
          >
            <SettingsIcon size={20} />
          </button>
        </div>

        {/* Search */}
        <div className="p-4 pb-2">
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-500 transition-colors" size={18} />
            <input 
              type="text"
              placeholder="Поиск людей..."
              className="w-full bg-slate-800/50 border border-slate-700 rounded-xl py-3 pl-10 pr-4 text-slate-200 placeholder-slate-500 focus:bg-slate-800 focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 transition-all outline-none"
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
            />
          </div>
        </div>

        {/* List Content */}
        <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1 custom-scrollbar">
          {searchQuery ? (
            // Search Results
            searchResults.length > 0 ? (
              searchResults.map(user => (
                <div 
                  key={user.username}
                  onClick={() => { setActiveChatUser(user.username); setSearchQuery(''); setSearchResults([]); }}
                  className="p-3 flex items-center gap-3 rounded-xl hover:bg-slate-800 cursor-pointer transition-colors group"
                >
                  <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center text-slate-300 font-bold border border-slate-700 group-hover:border-indigo-500/50 transition-colors">
                    {user.username[0].toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium text-slate-200 group-hover:text-white">{user.username}</h3>
                    <p className="text-sm text-slate-500 group-hover:text-slate-400">Нажмите, чтобы написать</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-slate-500">Пользователь не найден</div>
            )
          ) : (
            // Active Chats
            chats.length > 0 ? (
              chats.map(chat => (
                <div 
                  key={chat.user}
                  onClick={() => setActiveChatUser(chat.user)}
                  className={`p-3 flex items-center gap-3 rounded-xl cursor-pointer transition-all border ${activeChatUser === chat.user ? 'bg-indigo-600/10 border-indigo-500/30' : 'border-transparent hover:bg-slate-800'}`}
                >
                  <div className="relative">
                    <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center text-white font-bold text-lg border border-slate-700 shadow-sm">
                      {chat.user[0].toUpperCase()}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline mb-1">
                      <h3 className={`font-semibold truncate ${activeChatUser === chat.user ? 'text-indigo-400' : 'text-slate-200'}`}>
                        {chat.user}
                      </h3>
                      <span className="text-[11px] text-slate-500 font-medium">{new Date(chat.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                    </div>
                    <p className="text-sm text-slate-400 truncate pr-2">
                      {chat.lastMessage.type === 'text' ? (
                        <span className={chat.lastMessage.sender === currentUser ? 'text-slate-500' : 'text-slate-400'}>
                          {chat.lastMessage.sender === currentUser && 'Вы: '}{chat.lastMessage.text}
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-indigo-400">
                           {chat.lastMessage.type === 'photo' ? <ImageIcon size={14}/> : chat.lastMessage.type === 'video' ? <Video size={14}/> : <Mic size={14}/>}
                           {chat.lastMessage.type === 'photo' ? 'Фото' : chat.lastMessage.type === 'video' ? 'Видео' : 'Голосовое'}
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div className="mt-10 p-8 text-center text-slate-500 flex flex-col items-center gap-3 animate-fade-in">
                <div className="w-20 h-20 rounded-full bg-slate-800/50 flex items-center justify-center mb-2">
                  <Search className="text-slate-600" size={28} />
                </div>
                <div>
                  <h3 className="text-slate-300 font-medium mb-1">Нет чатов</h3>
                  <p className="text-xs max-w-[200px] mx-auto">Найдите кого-нибудь через поиск сверху, чтобы начать общение</p>
                </div>
              </div>
            )
          )}
        </div>
      </div>

      {/* Chat Area */}
      {activeChatUser ? (
        <div className={`${!showMobileSidebar ? 'flex' : 'hidden md:flex'} flex-1 flex-col bg-slate-950 relative`}>
          {/* Top Bar */}
          <div className="h-[72px] px-4 flex items-center justify-between border-b border-slate-800 bg-slate-900/80 backdrop-blur-md sticky top-0 z-20">
            <div className="flex items-center gap-3">
              <button 
                onClick={() => { setActiveChatUser(null); setShowMobileSidebar(true); }} 
                className="md:hidden p-2 -ml-2 text-slate-400 hover:text-white rounded-full hover:bg-slate-800 transition-colors"
              >
                <ChevronLeft size={24} />
              </button>
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold shadow-lg">
                {activeChatUser[0].toUpperCase()}
              </div>
              <div>
                <h3 className="font-bold text-slate-200 leading-tight">{activeChatUser}</h3>
                <span className="text-xs text-indigo-400 font-medium">В чате</span>
              </div>
            </div>
            {/* Optional Actions */}
            <div className="flex items-center gap-2">
              <button 
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors"
                title="Очистить чат (Demo)"
              >
                <Trash2 size={20} className="opacity-0 cursor-default" /> {/* Hidden placeholder for layout */}
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] bg-fixed">
             {messages.filter(m => !m.deleted).length === 0 ? (
               <div className="h-full flex flex-col items-center justify-center text-slate-600 gap-4 opacity-70 animate-fade-in">
                 <div className="w-24 h-24 bg-slate-900 rounded-full flex items-center justify-center border border-slate-800 shadow-xl">
                    <Send size={36} className="text-indigo-500 ml-1" />
                 </div>
                 <div className="text-center">
                   <p className="text-slate-400 font-medium">Начните общение с {activeChatUser}</p>
                   <p className="text-xs text-slate-600 mt-1">Отправьте привет!</p>
                 </div>
               </div>
             ) : (
               messages.map((msg) => (
                 <MessageBubble 
                    key={msg.id} 
                    message={msg} 
                    isOwn={msg.sender === currentUser} 
                    chatId={[currentUser, activeChatUser].sort().join('_')}
                    messageId={msg.id!}
                    currentUser={currentUser}
                 />
               ))
             )}
             <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-3 md:p-4 bg-slate-900 border-t border-slate-800 safe-area-bottom">
            <div className="flex items-end gap-2 max-w-4xl mx-auto">
              {/* Media Actions */}
              <div className="flex items-center gap-1 mb-1.5 bg-slate-800/50 p-1 rounded-xl border border-slate-700/50">
                <label className="p-2 text-slate-400 hover:text-indigo-400 hover:bg-slate-700/50 rounded-lg cursor-pointer transition-all active:scale-95" title="Отправить фото">
                  <ImageIcon size={20} />
                  <input type="file" className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, 'photo')} />
                </label>
                <label className="p-2 text-slate-400 hover:text-indigo-400 hover:bg-slate-700/50 rounded-lg cursor-pointer transition-all active:scale-95" title="Отправить видео">
                  <Video size={20} />
                  <input type="file" className="hidden" accept="video/*" onChange={(e) => handleFileUpload(e, 'video')} />
                </label>
                <button 
                  onClick={toggleRecording}
                  className={`p-2 rounded-lg transition-all active:scale-95 ${isRecording ? 'bg-red-500/20 text-red-500 animate-pulse' : 'text-slate-400 hover:text-indigo-400 hover:bg-slate-700/50'}`}
                  title={isRecording ? "Остановить запись" : "Записать голосовое"}
                >
                  {isRecording ? <div className="w-5 h-5 flex items-center justify-center"><div className="w-2.5 h-2.5 bg-red-500 rounded-sm"></div></div> : <Mic size={20} />}
                </button>
              </div>

              {/* Text Input */}
              <div className="flex-1 bg-slate-800 rounded-2xl border border-slate-700 focus-within:border-indigo-500/50 focus-within:ring-2 focus-within:ring-indigo-500/20 transition-all shadow-sm">
                <textarea
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage('text');
                    }
                  }}
                  placeholder={isRecording ? "Запись идет..." : "Сообщение..."}
                  disabled={isRecording}
                  className="w-full bg-transparent text-white px-4 py-3.5 max-h-32 min-h-[52px] focus:outline-none resize-none custom-scrollbar placeholder-slate-500 text-[15px]"
                  rows={1}
                />
              </div>

              {/* Send Button */}
              <button 
                onClick={() => handleSendMessage('text')}
                disabled={!messageInput.trim() && !isRecording}
                className="p-3.5 mb-0.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-500 disabled:opacity-50 disabled:hover:bg-indigo-600 disabled:scale-100 shadow-lg shadow-indigo-600/20 transition-all hover:scale-105 active:scale-95"
              >
                <Send size={20} className={messageInput.trim() ? "ml-0.5" : ""} />
              </button>
            </div>
            {isRecording && (
                <div className="text-center text-xs text-red-400 mt-2 animate-pulse font-medium">
                    Запись аудио... Нажмите кнопку микрофона, чтобы отправить.
                </div>
            )}
          </div>
        </div>
      ) : (
        /* Empty State for Desktop */
        <div className="hidden md:flex flex-1 items-center justify-center bg-slate-950 text-slate-500 flex-col gap-6 p-8 relative overflow-hidden">
           <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-indigo-900/10 via-slate-950 to-slate-950"></div>
           <div className="w-32 h-32 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center shadow-2xl relative z-10 animate-fade-in">
              <div className="absolute inset-0 rounded-full border border-indigo-500/20 animate-ping opacity-20"></div>
              <svg className="w-14 h-14 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
           </div>
           <div className="text-center z-10">
             <h3 className="text-2xl font-bold text-white mb-3">DolbaebSMS</h3>
             <p className="max-w-xs text-slate-400 leading-relaxed">
               Выберите чат из списка слева или найдите пользователя, чтобы начать безопасное общение.
             </p>
           </div>
        </div>
      )}
    </div>
  );
};

export default App;