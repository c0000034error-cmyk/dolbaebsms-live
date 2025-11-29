import React, { useState } from 'react';
import { Message } from '../types';
import { format } from 'date-fns';
import { Trash2, Smile, MoreVertical } from 'lucide-react';
import { db } from '../services/firebase';
import { ref, update } from 'firebase/database';

interface MessageBubbleProps {
  message: Message;
  isOwn: boolean;
  chatId: string;
  messageId: string;
  currentUser: string;
}

const EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🔥'];

export const MessageBubble: React.FC<MessageBubbleProps> = ({ message, isOwn, chatId, messageId, currentUser }) => {
  const [showActions, setShowActions] = useState(false);
  const [showReactions, setShowReactions] = useState(false);

  const handleDelete = async () => {
    if (confirm('Удалить сообщение?')) {
      const msgRef = ref(db, `messages/${chatId}/${messageId}`);
      await update(msgRef, { deleted: true });
    }
    setShowActions(false);
  };

  const handleReaction = async (emoji: string) => {
    const msgRef = ref(db, `messages/${chatId}/${messageId}/reactions`);
    const currentReactions = message.reactions || {};
    // Toggle reaction if already present
    if (currentReactions[currentUser] === emoji) {
        const updates: Record<string, any> = {};
        updates[currentUser] = null; // remove
        await update(msgRef, updates);
    } else {
        await update(msgRef, { [currentUser]: emoji });
    }
    setShowReactions(false);
    setShowActions(false);
  };

  if (message.deleted) {
    return null; 
  }

  const renderContent = () => {
    switch (message.type) {
      case 'photo':
        return (
          <div className="relative group cursor-pointer overflow-hidden rounded-lg">
            <img 
              src={message.mediaUrl} 
              alt="Photo" 
              className="max-w-full sm:max-w-[320px] max-h-[400px] object-cover rounded-lg" 
              loading="lazy"
            />
          </div>
        );
      case 'video':
        return (
          <video 
            controls 
            src={message.mediaUrl} 
            className="max-w-full sm:max-w-[320px] max-h-[400px] rounded-lg bg-black"
            playsInline
          />
        );
      case 'audio':
        return (
          <div className="flex items-center gap-3 min-w-[200px] pr-2">
            <div className={`p-2.5 rounded-full flex-shrink-0 ${isOwn ? 'bg-white/20' : 'bg-indigo-500/20 text-indigo-400'}`}>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            </div>
            {/* Audio controls styling varies by browser, usually reliable */}
            <audio controls src={message.mediaUrl} className="h-8 w-full max-w-[200px]" />
          </div>
        );
      default:
        return <p className="break-words whitespace-pre-wrap leading-relaxed text-[15px]">{message.text}</p>;
    }
  };

  return (
    <div 
      className={`group flex mb-3 ${isOwn ? 'justify-end' : 'justify-start'} animate-slide-up relative`}
      onMouseLeave={() => { if(!window.matchMedia('(hover: none)').matches) { setShowActions(false); setShowReactions(false); } }}
    >
      <div 
        className={`relative max-w-[85%] sm:max-w-[70%] rounded-2xl px-4 py-3 shadow-sm transition-all ${
          isOwn 
            ? 'bg-indigo-600 text-white rounded-br-none' 
            : 'bg-slate-800 text-slate-100 rounded-bl-none border border-slate-700'
        }`}
      >
        {/* Actions Button - Always visible slightly on desktop hover, easier target on mobile */}
        <button 
          onClick={(e) => { e.stopPropagation(); setShowActions(!showActions); }}
          className={`absolute -top-3 ${isOwn ? 'left-0' : 'right-0'} p-1.5 rounded-full bg-slate-800 border border-slate-700 shadow-md text-slate-400 z-10 transition-opacity ${showActions ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 focus:opacity-100 active:opacity-100'} sm:opacity-0`}
          title="Действия"
        >
          <MoreVertical size={14} />
        </button>

        {/* Context Menu */}
        {showActions && (
          <div className={`absolute -top-12 ${isOwn ? 'right-0' : 'left-0'} bg-slate-900 border border-slate-700 rounded-xl shadow-xl z-30 flex items-center overflow-hidden animate-fade-in`}>
            <button 
              onClick={() => setShowReactions(!showReactions)}
              className="p-2 hover:bg-slate-800 text-slate-300 transition-colors border-r border-slate-800"
              title="Реакция"
            >
              <Smile size={16} />
            </button>
            {isOwn && (
              <button 
                onClick={handleDelete}
                className="p-2 hover:bg-red-500/20 text-red-400 transition-colors"
                title="Удалить"
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>
        )}

        {/* Reaction Picker */}
        {showReactions && (
          <div className={`absolute -top-24 ${isOwn ? 'right-0' : 'left-0'} bg-slate-900 border border-slate-700 rounded-2xl shadow-xl z-40 flex flex-wrap max-w-[160px] p-2 gap-2 animate-fade-in`}>
            {EMOJIS.map(emoji => (
              <button
                key={emoji}
                onClick={() => handleReaction(emoji)}
                className="hover:bg-slate-800 p-1 rounded-lg text-xl transition-transform active:scale-95"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}

        {renderContent()}

        <div className={`flex items-center justify-end gap-1 mt-1 text-[10px] ${isOwn ? 'text-indigo-200' : 'text-slate-500'} font-medium`}>
          <span>{format(message.timestamp, 'HH:mm')}</span>
        </div>

        {/* Reactions Display */}
        {message.reactions && Object.keys(message.reactions).length > 0 && (
          <div 
            className={`absolute -bottom-3 ${isOwn ? 'left-0' : 'right-0'} flex -space-x-1 cursor-pointer`}
            onClick={() => setShowReactions(!showReactions)}
          >
            {Object.entries(message.reactions).slice(0, 4).map(([user, emoji], i) => (
              <div key={user} className="bg-slate-800 border border-slate-700 rounded-full w-6 h-6 flex items-center justify-center text-xs shadow-md z-10" title={user}>
                {emoji}
              </div>
            ))}
            {Object.keys(message.reactions).length > 4 && (
               <div className="bg-slate-800 border border-slate-700 rounded-full w-6 h-6 flex items-center justify-center text-[8px] text-slate-400 shadow-md z-0">
                 +{Object.keys(message.reactions).length - 4}
               </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
