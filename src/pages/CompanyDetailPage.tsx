import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { 
  Building, 
  ArrowLeft, 
  PlusCircle, 
  FileText, 
  User, 
  Percent, 
  CheckCircle2, 
  Clock, 
  Trash2
} from 'lucide-react';
import { getCompanyById, getTasks, deleteCompany } from '../lib/api';
import { Company, Task } from '../types';
import { TaskCard } from '../components/TaskCard';
import { CompanyDocumentsPanel } from '../components/CompanyDocumentsPanel';
import { formatDateRu } from '../lib/dateUtils';
import { useAuth } from '../context/AuthContext';

export const CompanyDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [company, setCompany] = useState<Company | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'active' | 'history' | 'documents'>('active');

  const loadCompanyData = async () => {
    if (!id) return;
    try {
      setLoading(true);
      const [compData, tasksData] = await Promise.all([
        getCompanyById(id),
        getTasks({ companyId: id }),
      ]);
      setCompany(compData);
      setTasks(tasksData);
    } catch (err) {
      console.error('Error fetching company details:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCompanyData();
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
        <Link to="/dashboard" className="text-xs text-[#5FA07A] hover:underline">
          Вернуться на рабочий стол
        </Link>
      </div>
    );
  }

  const activeTasks = tasks.filter((t) => t.status !== 'done' && t.status !== 'submitted');
  const historyTasks = tasks.filter((t) => t.status === 'done' || t.status === 'submitted');

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Top breadcrumb & Back button */}
      <div className="mb-6">
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#8C8577] hover:text-[#2B2A25] transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Назад к задачам</span>
        </Link>
      </div>

      {/* Main Company Card Header */}
      <div className="bg-white border border-[#EAE3D6] rounded-[10px] p-6 mb-6">
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
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 self-start md:self-auto">
            <Link
              to={`/tasks/new?company_id=${company.id}`}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-[10px] text-xs font-medium text-white bg-[#5FA07A] hover:bg-[#528E6B] transition"
            >
              <PlusCircle className="w-4 h-4" />
              <span>+ Новая задача</span>
            </Link>
            <button
              onClick={handleDeleteCompany}
              className="p-2 rounded-[10px] border border-[#DD6B60]/30 text-[#DD6B60] hover:bg-[#FCE6E3] transition"
              title="Удалить компанию"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tax Details Box */}
        {company.tax_type?.rate_description && (
          <div className="mt-4 pt-4 border-t border-[#EAE3D6] bg-[#FAF8F5] p-3 rounded-[8px] flex items-start gap-2.5">
            <Percent className="w-4 h-4 text-[#C7A96E] flex-shrink-0 mt-0.5" />
            <div className="text-xs">
              <span className="font-semibold text-[#2B2A25]">Ставки налогообложения: </span>
              <span className="text-[#8C8577]">{company.tax_type.rate_description}</span>
            </div>
          </div>
        )}

        {/* Notes */}
        {company.notes && (
          <div className="mt-3 text-xs text-[#8C8577] bg-white border border-[#EAE3D6] p-3 rounded-[8px]">
            <span className="font-semibold text-[#2B2A25] block mb-0.5">Примечания по клиенту:</span>
            {company.notes}
          </div>
        )}
      </div>

      {/* Stats Summary Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 mb-6">
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

      {/* Tabs: Tasks, history and received company documents */}
      <div className="border-b border-[#EAE3D6] mb-6 flex flex-wrap gap-6">
        <button
          onClick={() => setActiveTab('active')}
          className={`pb-3 text-sm font-semibold border-b-2 transition flex items-center gap-2 ${
            activeTab === 'active'
              ? 'border-[#5FA07A] text-[#5FA07A]'
              : 'border-transparent text-[#8C8577] hover:text-[#2B2A25]'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Текущие задачи и сроки ({activeTasks.length})</span>
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
          <span>История сдачи и архив ({historyTasks.length})</span>
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
      </div>

      {activeTab === 'documents' ? (
        user && <CompanyDocumentsPanel companyId={company.id} userId={user.id} />
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
  );
};
