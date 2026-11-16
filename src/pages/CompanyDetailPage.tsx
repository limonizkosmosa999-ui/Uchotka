import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { 
  Building, 
  ArrowLeft, 
  PlusCircle, 
  FileText, 
  User, 
  CheckCircle2, 
  Clock, 
  History,
  Download,
  Phone,
  MessageCircle,
  ExternalLink,
  ShieldCheck
} from 'lucide-react';
import { getCompanyById, getTasks, deleteCompany, subscribeToActivityLogs } from '../lib/api';
import { Company, Task, ActivityLog } from '../types';
import { TaskCard } from '../components/TaskCard';
import { CompanyDocumentsPanel } from '../components/CompanyDocumentsPanel';
import { formatDateRu } from '../lib/dateUtils';
import { useAuth } from '../context/AuthContext';
import { ACTIVITY_ACTION_LABELS, getActivityLogs, exportActivityLogsToCsv, downloadCsvFile } from '../lib/activityLog';
import { cleanPhoneNumber, formatWhatsAppUrl, formatTelegramUrl } from '../lib/messenger';

export const CompanyDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [company, setCompany] = useState<Company | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [activityError, setActivityError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'active' | 'history' | 'documents' | 'audit'>('active');

  const loadCompanyData = async () => {
    if (!id) return;
    try {
      setPageError(null);
      setActivityError(null);
      setLoading(true);
      const [compData, tasksData] = await Promise.all([
        getCompanyById(id),
        getTasks({ companyId: id }),
      ]);
      setCompany(compData);
      setTasks(tasksData);
      try {
        setActivityLogs(await getActivityLogs({ companyId: id, limit: 100 }));
      } catch (err) {
        setActivityError(err instanceof Error ? err.message : 'Не удалось загрузить историю действий');
      }
    } catch (err) {
      console.error('Error fetching company details:', err);
      setPageError(err instanceof Error ? err.message : 'Не удалось загрузить компанию');
    } finally {
      setLoading(false);
    }
  };


  useEffect(() => {
    loadCompanyData();
  }, [id]);

  useEffect(() => {
    if (!id) return;
    const unsubscribe = subscribeToActivityLogs(() => {
      getActivityLogs({ companyId: id, limit: 100 })
        .then(setActivityLogs)
        .catch((err) => setActivityError(err instanceof Error ? err.message : 'Не удалось обновить историю действий'));
    }, id);
    return unsubscribe;
  }, [id]);

  const handleDeleteCompany = async () => {
    if (!company) return;
    if (confirm(`Вы уверены, что хотите удалить компанию "${company.name}" и все её задачи?`)) {
      try {
        await deleteCompany(company.id);
        navigate('/dashboard');
      } catch (err) {
        console.error('Failed to delete company:', err);
      }
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12 text-center text-xs text-[#8C8577]">
        Загрузка данных компании...
      </div>
    );
  }

  if (!company) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12 text-center">
        <h2 className="text-base font-bold text-[#2B2A25] mb-2">Компания не найдена</h2>
        {pageError && <p className="mb-3 text-xs text-[#DD6B60]">{pageError}</p>}
        <Link to="/dashboard" className="text-xs text-[#5FA07A] hover:underline">
          Вернуться на рабочий стол
        </Link>
      </div>
    );
  }

  const activeTasks = tasks.filter((t) => t.status !== 'done' && t.status !== 'submitted');
  const historyTasks = tasks.filter((t) => t.status === 'done' || t.status === 'submitted');

  return (
    <div className="w-full min-h-screen bg-[#F4EFEA] px-8 py-7">
      <div className="company-detail-layout">
        <div className="company-detail-main">
      {pageError && (
        <div className="mb-5 p-3 rounded-xl bg-[#FCE8E6] text-xs font-semibold text-[#D9483B]">
          Не удалось полностью загрузить карточку: {pageError}
        </div>
      )}
      {activityError && (
        <div className="mb-5 p-3 rounded-xl bg-[#FCE8E6] text-xs font-semibold text-[#D9483B]">
          {activityError}
        </div>
      )}
      {/* Top breadcrumb & Back button */}
      <div className="mb-6">
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-black transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Назад к задачам</span>
        </Link>
      </div>

      {/* Main Company Card Header */}
      <div className="bg-white border border-[#EAE5DD] rounded-2xl p-6 mb-6 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-[10px] bg-[#F6EFDE] text-[#C7A96E] flex items-center justify-center flex-shrink-0">
              <Building className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-[4px] uppercase ${
                  company.client_type === 'ОсОО' ? 'bg-[#FBEBD9] text-[#DB8A3C]' : 'bg-[#F6EFDE] text-[#C7A96E]'
                }`}>
                  {company.client_type}
                </span>
                <h1 className="text-xl font-bold text-[#2B2A25]">{company.name}</h1>
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#8C8577]">
                <span>ИНН: <strong className="text-[#2B2A25]">{company.inn}</strong></span>
                <span>•</span>
                <span>
                  Режим: <strong className="text-[#2B2A25]">{company.tax_type?.name || '—'}</strong>
                </span>
                {company.owner && (
                  <>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <User className="w-3.5 h-3.5 text-[#5FA07A]" />
                      Бухгалтер: <strong className="text-[#2B2A25]">{company.owner.full_name}</strong>
                    </span>
                  </>
                )}
                {company.phone && (
                  <>
                    <span>•</span>
                    <a
                      href={formatWhatsAppUrl(company.phone, `Здравствуйте! Бухгалтерское агентство «Учётка» по компании ${company.name}`)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[#25D366] hover:underline font-medium"
                      title="Написать в WhatsApp"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span>{company.phone}</span>
                    </a>
                  </>
                )}
                {company.telegram_contact && (
                  <>
                    <span>•</span>
                    <a
                      href={formatTelegramUrl(company.telegram_contact, `Здравствуйте! Бухгалтерское агентство «Учётка» по компании ${company.name}`)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[#0088cc] hover:underline font-medium"
                      title="Написать в Telegram"
                    >
                      <span>TG: {company.telegram_contact}</span>
                    </a>
                  </>
                )}
              </div>
            </div>
          </div>

        </div>

      </div>

      {/* Stats Summary Bar */}
      <div className="company-detail-stats grid grid-cols-2 sm:grid-cols-4 gap-3.5 mb-6">
        <div className="bg-white border border-[#EAE3D6] rounded-[10px] p-3.5 text-center">
          <span className="text-xs text-[#8C8577] block">Всего задач</span>
          <span className="text-lg font-bold text-[#2B2A25]">{tasks.length}</span>
        </div>
        <div className="bg-white border border-[#EAE3D6] rounded-[10px] p-3.5 text-center">
          <span className="text-xs text-[#DB8A3C] block">В работе</span>
          <span className="text-lg font-bold text-[#DB8A3C]">{activeTasks.length}</span>
        </div>
        <div className="bg-white border border-[#EAE3D6] rounded-[10px] p-3.5 text-center">
          <span className="text-xs text-[#5FA07A] block">Сдано / Готово</span>
          <span className="text-lg font-bold text-[#5FA07A]">{historyTasks.length}</span>
        </div>
        <div className="bg-white border border-[#EAE3D6] rounded-[10px] p-3.5 text-center">
          <span className="text-xs text-[#C7A96E] block">Клиент с</span>
          <span className="text-sm font-bold text-[#2B2A25] mt-1 block">
            {formatDateRu(company.created_at, 'MMM yyyy')}
          </span>
        </div>
      </div>

      {/* Tabs: Tasks, history, received company documents and audit trail */}
      <div className="border-b border-[#EAE3D6] mb-6 flex flex-wrap gap-4 sm:gap-6">
        <button
          onClick={() => setActiveTab('active')}
          className={`pb-3 text-sm font-semibold border-b-2 transition flex items-center gap-2 ${
            activeTab === 'active'
              ? 'border-[#5FA07A] text-[#5FA07A]'
              : 'border-transparent text-[#8C8577] hover:text-[#2B2A25]'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Текущие задачи ({activeTasks.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`pb-3 text-sm font-semibold border-b-2 transition flex items-center gap-2 ${
            activeTab === 'history'
              ? 'border-[#5FA07A] text-[#5FA07A]'
              : 'border-transparent text-[#8C8577] hover:text-[#2B2A25]'
          }`}
        >
          <CheckCircle2 className="w-4 h-4" />
          <span>Архив сдачи ({historyTasks.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('documents')}
          className={`pb-3 text-sm font-semibold border-b-2 transition flex items-center gap-2 ${
            activeTab === 'documents'
              ? 'border-[#5FA07A] text-[#5FA07A]'
              : 'border-transparent text-[#8C8577] hover:text-[#2B2A25]'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Документы</span>
        </button>
        <button
          onClick={() => setActiveTab('audit')}
          className={`pb-3 text-sm font-semibold border-b-2 transition flex items-center gap-2 ${
            activeTab === 'audit'
              ? 'border-[#5FA07A] text-[#5FA07A]'
              : 'border-transparent text-[#8C8577] hover:text-[#2B2A25]'
          }`}
        >
          <History className="w-4 h-4" />
          <span>История действий ({activityLogs.length})</span>
        </button>
      </div>

      {activeTab === 'documents' ? (
        user && (
          <CompanyDocumentsPanel
            companyId={company.id}
            userId={user.id}
            userName={user.full_name}
            companyName={company.name}
          />
        )
      ) : activeTab === 'audit' ? (
        <div className="bg-white border border-[#EAE3D6] rounded-[10px] p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3 mb-4 pb-3 border-b border-[#EAE3D6]">
            <div>
              <h3 className="text-sm font-bold text-[#2B2A25] flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#5FA07A]" />
                <span>Журнал действий и событий по компании</span>
              </h3>
              <p className="text-[11px] text-[#8C8577]">
                Фиксация всех действий сотрудников: сдача форм, изменение статусов, напоминания клиенту и эскалации.
              </p>
            </div>

            {activityLogs.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  const csv = exportActivityLogsToCsv(activityLogs);
                  downloadCsvFile(csv, `audit_log_${company.inn}_${new Date().toISOString().split('T')[0]}.csv`);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#EAE3D6] bg-white text-xs font-semibold text-[#2B2A25] hover:bg-[#FAF8F5] transition"
              >
                <Download className="w-3.5 h-3.5 text-[#5FA07A]" />
                <span>Экспорт в CSV</span>
              </button>
            )}
          </div>

          {activityLogs.length === 0 ? (
            <p className="text-xs text-[#8C8577] text-center py-8">
              Действий по компании пока не зафиксировано
            </p>
          ) : (
            <div className="divide-y divide-[#EAE3D6] overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-[#8C8577] text-[11px] pb-2">
                    <th className="py-2 px-3 font-semibold">Время</th>
                    <th className="py-2 px-3 font-semibold">Сотрудник</th>
                    <th className="py-2 px-3 font-semibold">Событие</th>
                    <th className="py-2 px-3 font-semibold">Описание</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EAE3D6]">
                  {activityLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-[#FAF8F5] transition">
                      <td className="py-2.5 px-3 text-[#8C8577] font-mono whitespace-nowrap">
                        {new Date(log.created_at).toLocaleString('ru-RU', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="py-2.5 px-3 font-medium text-[#2B2A25] whitespace-nowrap">
                        {log.user_name}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#FAF8F5] border border-[#EAE3D6] text-[#5FA07A]">
                          {ACTIVITY_ACTION_LABELS[log.action_type]}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-[#2B2A25] leading-relaxed">
                        {log.description}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : activeTab === 'active' ? (
        activeTasks.length === 0 ? (
          <div className="bg-white border border-[#EAE3D6] rounded-[10px] p-8 text-center text-xs text-[#8C8577]">
            <CheckCircle2 className="w-8 h-8 text-[#5FA07A] mx-auto mb-2 opacity-60" />
            <p className="font-semibold text-[#2B2A25] mb-1">Все задачи выполнены!</p>
            <p className="mb-4">Нет активных дедлайнов по этой компании</p>
            <Link
              to={`/tasks/new?company_id=${company.id}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] text-xs font-semibold text-white bg-[#5FA07A] hover:bg-[#528E6B]"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Создать задачу</span>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeTasks.map((t) => (
              <TaskCard
                key={t.id}
                task={t}
                onTaskUpdated={(upd) => {
                  setTasks((prev) => prev.map((item) => (item.id === upd.id ? upd : item)));
                }}
                onTaskDeleted={(delId) => {
                  setTasks((prev) => prev.filter((item) => item.id !== delId));
                }}
              />
            ))}
          </div>
        )
      ) : historyTasks.length === 0 ? (
        <div className="bg-white border border-[#EAE3D6] rounded-[10px] p-8 text-center text-xs text-[#8C8577]">
          История сданных документов пока пуста
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {historyTasks.map((t) => (
            <TaskCard
              key={t.id}
              task={t}
              onTaskUpdated={(upd) => {
                setTasks((prev) => prev.map((item) => (item.id === upd.id ? upd : item)));
              }}
              onTaskDeleted={(delId) => {
                setTasks((prev) => prev.filter((item) => item.id !== delId));
              }}
            />
          ))}
        </div>
      )}
        </div>

        <aside className="company-detail-aside">
          <section>
            <h2>О компании</h2>
            <div className="company-detail-field"><span>Форма</span><strong>{company.client_type}</strong></div>
            <div className="company-detail-field"><span>ИНН</span><strong>{company.inn}</strong></div>
            <div className="company-detail-field"><span>Режим</span><strong>{company.tax_type?.name || '—'}</strong></div>
            <div className="company-detail-field">
              <span>Бухгалтер</span>
              <strong>{company.owner?.full_name || 'Не назначен'}</strong>
            </div>
          </section>

          {company.tax_type?.rate_description && (
            <section className="company-tax-note">
              <strong>Ставки налогообложения</strong>
              <p>{company.tax_type.rate_description}</p>
            </section>
          )}

          {company.notes && (
            <section className="company-tax-note">
              <strong>Примечания</strong>
              <p>{company.notes}</p>
            </section>
          )}

          <div className="company-detail-actions">
            <Link to={`/tasks/new?company_id=${company.id}`} className="company-primary-action">
              + Новая задача
            </Link>
            <Link to={`/tax-calendar?tab=generator&company_id=${company.id}`} className="company-secondary-action">
              Задачи на год
            </Link>
            <button type="button" onClick={handleDeleteCompany} className="company-delete-action">
              Удалить компанию
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
};
