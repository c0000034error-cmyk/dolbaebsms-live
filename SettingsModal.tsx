import React, { useState } from 'react';
import { X, Lock, Trash2, LogOut, User as UserIcon } from 'lucide-react';
import { db } from '../services/firebase';
import { ref, update, remove, get } from 'firebase/database';
import { Button } from './Button';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: string;
  onLogout: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, currentUser, onLogout }) => {
  const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'danger'>('profile');
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmDelete, setConfirmDelete] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  if (!isOpen) return null;

  const handleChangePassword = async () => {
    if (!oldPassword || !newPassword) return;
    setIsLoading(true);
    setMessage({ type: '', text: '' });

    try {
      const userRef = ref(db, `users/${currentUser}`);
      const snapshot = await get(userRef);
      const userData = snapshot.val();

      if (userData.password !== oldPassword) {
        setMessage({ type: 'error', text: 'Старый пароль неверен' });
        setIsLoading(false);
        return;
      }

      await update(userRef, { password: newPassword });
      setMessage({ type: 'success', text: 'Пароль успешно изменен' });
      setOldPassword('');
      setNewPassword('');
    } catch (error) {
      setMessage({ type: 'error', text: 'Ошибка при смене пароля' });
    }
    setIsLoading(false);
  };

  const handleDeleteAccount = async () => {
    if (confirmDelete !== currentUser) {
      setMessage({ type: 'error', text: 'Введите имя пользователя для подтверждения' });
      return;
    }
    setIsLoading(true);

    try {
      // Delete user record
      await remove(ref(db, `users/${currentUser}`));
      // We do not delete messages to preserve history for other users,
      // but you could iterate and mark them deleted if needed.
      onLogout();
    } catch (error) {
      setMessage({ type: 'error', text: 'Ошибка удаления аккаунта' });
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <UserIcon size={20} className="text-indigo-500" />
            Настройки
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors p-1">
            <X size={24} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-800 bg-slate-900/50">
          <button 
            onClick={() => setActiveTab('profile')}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${activeTab === 'profile' ? 'text-indigo-400 border-b-2 border-indigo-400' : 'text-slate-400 hover:text-slate-200'}`}
          >
            Профиль
          </button>
          <button 
            onClick={() => setActiveTab('security')}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${activeTab === 'security' ? 'text-indigo-400 border-b-2 border-indigo-400' : 'text-slate-400 hover:text-slate-200'}`}
          >
            Безопасность
          </button>
          <button 
            onClick={() => setActiveTab('danger')}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${activeTab === 'danger' ? 'text-red-400 border-b-2 border-red-400' : 'text-slate-400 hover:text-slate-200'}`}
          >
            Опасно
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto custom-scrollbar flex-1 bg-slate-900">
          {message.text && (
            <div className={`mb-4 p-3 rounded-lg text-sm text-center ${message.type === 'error' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-green-500/10 text-green-400 border border-green-500/20'}`}>
              {message.text}
            </div>
          )}

          {activeTab === 'profile' && (
            <div className="space-y-6 text-center">
              <div className="w-24 h-24 mx-auto rounded-full bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white font-bold text-4xl shadow-xl">
                {currentUser[0].toUpperCase()}
              </div>
              <div>
                <h3 className="text-2xl font-bold text-white">{currentUser}</h3>
                <p className="text-slate-400">Пользователь DolbaebSMS</p>
              </div>
              <Button variant="secondary" onClick={onLogout} className="w-full" icon={<LogOut size={18} />}>
                Выйти из аккаунта
              </Button>
            </div>
          )}

          {activeTab === 'security' && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-white mb-2 flex items-center gap-2">
                <Lock size={18} /> Смена пароля
              </h3>
              <div className="space-y-3">
                <input
                  type="password"
                  placeholder="Текущий пароль"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition-all"
                />
                <input
                  type="password"
                  placeholder="Новый пароль"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition-all"
                />
                <Button onClick={handleChangePassword} isLoading={isLoading} disabled={!oldPassword || !newPassword} className="w-full">
                  Обновить пароль
                </Button>
              </div>
            </div>
          )}

          {activeTab === 'danger' && (
            <div className="space-y-4">
              <div className="p-4 bg-red-500/5 border border-red-500/10 rounded-xl">
                <h3 className="text-lg font-medium text-red-400 mb-2 flex items-center gap-2">
                  <Trash2 size={18} /> Удаление аккаунта
                </h3>
                <p className="text-sm text-slate-400 mb-4">
                  Это действие необратимо. Ваш аккаунт будет удален навсегда. Ваши сообщения могут остаться видимыми для собеседников.
                </p>
                <div className="space-y-3">
                  <label className="text-xs text-slate-500 uppercase font-bold">Для подтверждения введите "{currentUser}"</label>
                  <input
                    type="text"
                    placeholder={currentUser}
                    value={confirmDelete}
                    onChange={(e) => setConfirmDelete(e.target.value)}
                    className="w-full bg-slate-800 border border-red-900/30 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-red-500 transition-all placeholder-slate-600"
                  />
                  <Button 
                    variant="danger" 
                    onClick={handleDeleteAccount} 
                    isLoading={isLoading} 
                    disabled={confirmDelete !== currentUser} 
                    className="w-full"
                  >
                    Удалить аккаунт навсегда
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
