import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Building, ArrowLeft, Percent, Check, AlertCircle } from 'lucide-react';
import { getTaxTypes, createCompany, getAllUsers } from '../lib/api';
import { TaxType, ClientType, UserProfile } from '../types';
import { useAuth } from '../context/AuthContext';

export const CompanyNewPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [taxTypes, setTaxTypes] = useState<TaxType[]>([]);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);

  // Form State
  const [name, setName] = useState('');
  const [inn, setInn] = useState('');
  const [clientType, setClientType] = useState<ClientType>('ОсОО');
  const [taxTypeId, setTaxTypeId] = useState<string>('');
  const [ownerId, setOwnerId] = useState<string>(user?.id || '');
  const [taxOfficeDistrict, setTaxOfficeDistrict] = useState('');
  const [curatorId, setCuratorId] = useState(user?.role === 'accountant' ? user.id : '');
  const [notes, setNotes] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isManager = user?.role === 'manager';

  useEffect(() => {
    getTaxTypes().then((types) => {
      setTaxTypes(types);
      if (types.length > 0) {
        setTaxTypeId(types[0].id);
      }
    });

    if (isManager) {
      getAllUsers().then((users) => {
        setAllUsers(users);
        if (users.length > 0 && !ownerId) {
          setOwnerId(users[0].id);
        }
      });
    }
  }, [isManager, ownerId]);

  // Selected tax type info for auto-fill description
  const selectedTax = taxTypes.find((t) => t.id === taxTypeId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Укажите наименование компании или ИП');
      return;
    }
    if (!inn.trim()) {
      setError('Укажите ИНН');
      return;
    }

    setLoading(true);
    try {
      const created = await createCompany({
        name: name.trim(),
        inn: inn.trim(),
        client_type: clientType,
        tax_type_id: taxTypeId,
        tax_office_district: taxOfficeDistrict.trim() || null,
        curator_id: curatorId || null,
        owner_id: ownerId || user?.id || '',
        notes: notes.trim() || null,
      });

      navigate(`/companies/${created.id}`);
    } catch (err: any) {
      setError(err.message || 'Ошибка при создании компании');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      {/* Back button */}
      <div className="mb-6">
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#8C8577] hover:text-[#2B2A25] transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Назад</span>
        </Link>
      </div>

      <div className="bg-white border border-[#EAE3D6] rounded-[10px] p-6 sm:p-8">
        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-[#EAE3D6]">
          <div className="w-10 h-10 rounded-[10px] bg-[#E7F3EB] text-[#5FA07A] flex items-center justify-center">
            <Building className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[#2B2A25]">
              Новая компания / Клиент агентства
            </h1>
            <p className="text-xs text-[#8C8577]">
              Добавление компании в реестр обслуживания и настройка налогообложения
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-3 rounded-[8px] bg-[#FCE6E3] border border-[#DD6B60]/30 text-xs text-[#DD6B60] flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Client Type Selector */}
          <div>
            <label className="block text-xs font-semibold text-[#2B2A25] mb-2">
              Тип клиента (Организационно-правовая форма)
            </label>
            <div className="grid grid-cols-2 gap-3">
              {(['ИП', 'ОсОО', 'ОО', 'ОФ'] as ClientType[]).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setClientType(type)}
                  className={`p-3 rounded-[10px] border text-xs font-medium text-center transition flex items-center justify-center gap-2 ${
                    clientType === type
                      ? 'bg-[#FBEBD9] border-[#DB8A3C] text-[#DB8A3C] font-semibold'
                      : 'border-[#EAE3D6] text-[#2B2A25] hover:bg-[#FAF8F5]'
                  }`}
                >
                  <span>{type}</span>
                  {clientType === type && <Check className="w-3.5 h-3.5" />}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#2B2A25] mb-1">
                Район налоговой
              </label>
              <input
                type="text"
                value={taxOfficeDistrict}
                onChange={(e) => setTaxOfficeDistrict(e.target.value)}
                placeholder="Например, Первомайский"
                className="w-full px-3 py-2 text-xs bg-white border border-[#EAE3D6] rounded-[8px] focus:outline-none focus:border-[#5FA07A]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#2B2A25] mb-1">
                Сопровождающий куратор
              </label>
              <select
                value={curatorId}
                onChange={(e) => setCuratorId(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-[#EAE3D6] rounded-[8px] focus:outline-none focus:border-[#5FA07A]"
              >
                <option value="">Не выбран</option>
                {allUsers.filter((u) => u.role === 'accountant').map((u) => (
                  <option key={u.id} value={u.id}>{u.full_name}</option>
                ))}
                {!isManager && user?.role === 'accountant' && (
                  <option value={user.id}>{user.full_name}</option>
                )}
              </select>
            </div>
          </div>

          {/* Name & INN */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#2B2A25] mb-1">
                Наименование {clientType === 'ОсОО' ? 'компании' : 'ИП'} *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={clientType === 'ОсОО' ? 'ОсОО «Ала-Тоо Трейд»' : 'ИП Смирнов А. В.'}
                className="w-full px-3 py-2 text-xs bg-white border border-[#EAE3D6] rounded-[8px] focus:outline-none focus:border-[#5FA07A]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#2B2A25] mb-1">
                ИНН (14 цифр) *
              </label>
              <input
                type="text"
                required
                value={inn}
                onChange={(e) => setInn(e.target.value)}
                placeholder="02503202110192"
                maxLength={14}
                className="w-full px-3 py-2 text-xs bg-white border border-[#EAE3D6] rounded-[8px] focus:outline-none focus:border-[#5FA07A]"
              />
            </div>
          </div>

          {/* Tax Type Selection with Automatic Rate Description Preview */}
          <div>
            <label className="block text-xs font-semibold text-[#2B2A25] mb-1">
              Система налогообложения *
            </label>
            <select
              value={taxTypeId}
              onChange={(e) => setTaxTypeId(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-white border border-[#EAE3D6] rounded-[8px] focus:outline-none focus:border-[#5FA07A] text-[#2B2A25]"
            >
              {taxTypes.map((tax) => (
                <option key={tax.id} value={tax.id}>
                  {tax.name}
                </option>
              ))}
            </select>

            {/* Read-only Hint: Automatically fetched rate_description from tax_types */}
            {selectedTax && (
              <div className="mt-2.5 p-3 rounded-[8px] bg-[#FAF8F5] border border-[#EAE3D6] flex items-start gap-2.5">
                <Percent className="w-4 h-4 text-[#5FA07A] flex-shrink-0 mt-0.5" />
                <div className="text-xs">
                  <span className="font-semibold text-[#2B2A25]">Автоматические ставки: </span>
                  <p className="text-[#8C8577] mt-0.5 leading-relaxed">
                    {selectedTax.rate_description}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Responsible Accountant (for Manager) */}
          {isManager && (
            <div>
              <label className="block text-xs font-semibold text-[#2B2A25] mb-1">
                Ответственный бухгалтер
              </label>
              <select
                value={ownerId}
                onChange={(e) => setOwnerId(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-[#EAE3D6] rounded-[8px] focus:outline-none focus:border-[#5FA07A] text-[#2B2A25]"
              >
                {allUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.full_name} ({u.role === 'manager' ? 'Руководитель' : 'Бухгалтер'})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-[#2B2A25] mb-1">
              Особенности ведения учета / Примечания
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Специфика деятельности, наличие кассового аппарата (ККМ), валютные счета, количество сотрудников..."
              className="w-full px-3 py-2 text-xs bg-white border border-[#EAE3D6] rounded-[8px] focus:outline-none focus:border-[#5FA07A] text-[#2B2A25]"
            />
          </div>

          {/* Action buttons */}
          <div className="pt-4 border-t border-[#EAE3D6] flex items-center justify-end gap-3">
            <Link
              to="/dashboard"
              className="px-4 py-2 rounded-[8px] text-xs font-medium text-[#8C8577] hover:bg-[#FAF8F5] transition"
            >
              Отмена
            </Link>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 rounded-[8px] bg-[#5FA07A] text-white text-xs font-semibold hover:bg-[#528E6B] transition disabled:opacity-50"
            >
              {loading ? 'Сохранение...' : 'Создать компанию'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
