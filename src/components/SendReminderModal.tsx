import React, { useState, useEffect } from 'react';
import {
  X,
  Send,
  MessageCircle,
  Copy,
  Check,
  Clock,
  Phone,
  User,
  ExternalLink,
  AlertCircle
} from 'lucide-react';
import { Task, Company, UserProfile, ReminderRecord } from '../types';
import {
  generateTaxReminderMessage,
  formatWhatsAppUrl,
  formatTelegramUrl,
  saveReminderRecord,
  getRemindersHistory,
  cleanPhoneNumber
} from '../lib/messenger';

interface SendReminderModalProps {
  task: Task;
  company?: Company;
  currentUser: UserProfile;
  onClose: () => void;
}

export const SendReminderModal: React.FC<SendReminderModalProps> = ({
  task,
  company,
  currentUser,
  onClose,
}) => {
  const targetCompany = company || task.company;
  const initialPhone = targetCompany?.phone || '';
  const initialTelegram = targetCompany?.telegram_contact || '';

  const [channel, setChannel] = useState<'whatsapp' | 'telegram'>('whatsapp');
  const [phone, setPhone] = useState(initialPhone);
  const [telegramContact, setTelegramContact] = useState(initialTelegram);
  const [recipientName, setRecipientName] = useState(
    targetCompany?.contact_person || targetCompany?.name || 'Клиент'
  );

  const [message, setMessage] = useState('');
  const [copied, setCopied] = useState(false);
  const [remindersHistory, setRemindersHistory] = useState<ReminderRecord[]>([]);

  useEffect(() => {
    if (targetCompany) {
      const defaultText = generateTaxReminderMessage({
        company: targetCompany,
        task,
        senderName: currentUser.full_name,
      });
      setMessage(defaultText);
    }
    setRemindersHistory(getRemindersHistory(task.id));
  }, [task, targetCompany, currentUser]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback
    }
  };

  const handleSendWhatsApp = async () => {
    if (!phone.trim()) {
      alert('Пожалуйста, укажите номер телефона для WhatsApp');
      return;
    }

    const url = formatWhatsAppUrl(phone, message);
    window.open(url, '_blank', 'noopener,noreferrer');

    // Сохраняем факт отправки
    const record = await saveReminderRecord(
      {
        task_id: task.id,
        company_id: task.company_id,
        recipient_name: recipientName,
        channel: 'whatsapp',
        phone_or_handle: cleanPhoneNumber(phone),
        message_text: message,
        sent_by_user_id: currentUser.id,
        status: 'sent',
      },
      currentUser
    );

    setRemindersHistory((prev) => [record, ...prev]);
  };

  const handleSendTelegram = async () => {
    const target = telegramContact.trim() || phone.trim();
    const url = formatTelegramUrl(target, message);
    window.open(url, '_blank', 'noopener,noreferrer');

    const record = await saveReminderRecord(
      {
        task_id: task.id,
        company_id: task.company_id,
        recipient_name: recipientName,
        channel: 'telegram',
        phone_or_handle: target || 'Telegram чат',
        message_text: message,
        sent_by_user_id: currentUser.id,
        status: 'sent',
      },
      currentUser
    );

    setRemindersHistory((prev) => [record, ...prev]);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
      <div
        className="bg-white rounded-2xl w-full max-w-lg shadow-2xl border border-[#EAE3D6] overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#EAE3D6] bg-[#FAF8F5]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#E7F3EB] text-[#5FA07A] flex items-center justify-center">
              <MessageCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#2B2A25]">
                Напоминание клиенту в мессенджер
              </h3>
              <p className="text-[11px] text-[#8C8577]">
                WhatsApp / Telegram • {targetCompany?.name}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#8C8577] hover:text-[#2B2A25] hover:bg-[#EAE3D6]/50 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-4 text-xs">
          {/* Channel Selector */}
          <div>
            <label className="block text-[11px] font-semibold text-[#8C8577] mb-1.5">
              Канал отправки
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setChannel('whatsapp')}
                className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border text-xs font-medium transition ${
                  channel === 'whatsapp'
                    ? 'border-[#25D366] bg-[#25D366]/10 text-[#128C7E] font-semibold shadow-sm'
                    : 'border-[#EAE3D6] bg-white text-[#2B2A25] hover:bg-[#FAF8F5]'
                }`}
              >
                <span className="w-2.5 h-2.5 rounded-full bg-[#25D366]" />
                <span>WhatsApp</span>
              </button>

              <button
                type="button"
                onClick={() => setChannel('telegram')}
                className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border text-xs font-medium transition ${
                  channel === 'telegram'
                    ? 'border-[#0088cc] bg-[#0088cc]/10 text-[#0088cc] font-semibold shadow-sm'
                    : 'border-[#EAE3D6] bg-white text-[#2B2A25] hover:bg-[#FAF8F5]'
                }`}
              >
                <span className="w-2.5 h-2.5 rounded-full bg-[#0088cc]" />
                <span>Telegram</span>
              </button>
            </div>
          </div>

          {/* Contact Input */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-[#8C8577] mb-1">
                Контактное лицо
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  placeholder="Имя директора / контакт"
                  className="w-full px-3 py-2 pl-8 border border-[#EAE3D6] rounded-xl text-xs text-[#2B2A25] focus:outline-none focus:border-[#5FA07A]"
                />
                <User className="w-3.5 h-3.5 text-[#8C8577] absolute left-2.5 top-3" />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-[#8C8577] mb-1">
                {channel === 'whatsapp' ? 'Номер WhatsApp (+996...)' : 'Telegram (@username или номер)'}
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={channel === 'whatsapp' ? phone : telegramContact}
                  onChange={(e) =>
                    channel === 'whatsapp'
                      ? setPhone(e.target.value)
                      : setTelegramContact(e.target.value)
                  }
                  placeholder={channel === 'whatsapp' ? '+996 555 123456' : '@username или телефон'}
                  className="w-full px-3 py-2 pl-8 border border-[#EAE3D6] rounded-xl text-xs text-[#2B2A25] focus:outline-none focus:border-[#5FA07A]"
                />
                <Phone className="w-3.5 h-3.5 text-[#8C8577] absolute left-2.5 top-3" />
              </div>
            </div>
          </div>

          {/* Message Textarea */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-semibold text-[#8C8577]">
                Текст напоминания
              </label>
              <button
                type="button"
                onClick={handleCopy}
                className="inline-flex items-center gap-1 text-[11px] text-[#5FA07A] hover:underline"
              >
                {copied ? <Check className="w-3 h-3 text-[#5FA07A]" /> : <Copy className="w-3 h-3" />}
                <span>{copied ? 'Скопировано!' : 'Копировать'}</span>
              </button>
            </div>
            <textarea
              rows={6}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full p-3 border border-[#EAE3D6] rounded-xl text-xs text-[#2B2A25] leading-relaxed focus:outline-none focus:border-[#5FA07A] font-mono bg-[#FAF8F5]/50 resize-none"
            />
          </div>

          {/* Previous reminders history if any */}
          {remindersHistory.length > 0 && (
            <div className="pt-2 border-t border-[#EAE3D6]">
              <span className="text-[11px] font-semibold text-[#8C8577] block mb-2">
                История отправленных напоминаний ({remindersHistory.length})
              </span>
              <div className="space-y-1.5 max-h-24 overflow-y-auto pr-1">
                {remindersHistory.map((rem) => (
                  <div
                    key={rem.id}
                    className="flex items-center justify-between p-2 rounded-lg bg-[#FAF8F5] text-[10px] text-[#8C8577]"
                  >
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          rem.channel === 'whatsapp' ? 'bg-[#25D366]' : 'bg-[#0088cc]'
                        }`}
                      />
                      <span className="font-medium text-[#2B2A25]">
                        {rem.channel.toUpperCase()} → {rem.phone_or_handle}
                      </span>
                    </div>
                    <span>{new Date(rem.created_at).toLocaleDateString('ru-RU')}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-6 py-3.5 border-t border-[#EAE3D6] bg-[#FAF8F5]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-medium text-[#8C8577] hover:bg-[#EAE3D6]/50 transition"
          >
            Закрыть
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#EAE3D6] bg-white text-xs font-medium text-[#2B2A25] hover:bg-[#FAF8F5] transition"
            >
              <Copy className="w-3.5 h-3.5 text-[#8C8577]" />
              <span>Копировать</span>
            </button>

            {channel === 'whatsapp' ? (
              <button
                type="button"
                onClick={handleSendWhatsApp}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#25D366] hover:bg-[#20ba59] text-white text-xs font-semibold shadow-sm transition"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Открыть WhatsApp</span>
                <ExternalLink className="w-3 h-3 opacity-75" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSendTelegram}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0088cc] hover:bg-[#0077b5] text-white text-xs font-semibold shadow-sm transition"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Открыть Telegram</span>
                <ExternalLink className="w-3 h-3 opacity-75" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
