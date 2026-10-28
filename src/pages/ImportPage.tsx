import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  FileSpreadsheet,
  Upload,
  Download,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Clipboard,
  Trash2,
  FileCheck,
  Check,
  AlertCircle
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  parseExcelOrCsvFile,
  parsePastedTableText,
  validateImportRows,
  executeBatchImport,
  downloadSampleImportExcel,
  ValidatedImportItem
} from '../lib/excelImporter';

export const ImportPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [inputMode, setInputMode] = useState<'file' | 'paste'>('file');
  const [pastedText, setPastedText] = useState('');
  const [items, setItems] = useState<ValidatedImportItem[]>([]);
  const [fileName, setFileName] = useState('');
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [successResult, setSuccessResult] = useState<{
    companiesCount: number;
    tasksCount: number;
  } | null>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setFileName(file.name);
    try {
      const rawRows = await parseExcelOrCsvFile(file);
      const validated = validateImportRows(rawRows);
      setItems(validated);
    } catch (err: any) {
      console.error('Failed to parse Excel file:', err);
      alert('Ошибка чтения файла Excel: ' + (err.message || 'Неверный формат'));
    } finally {
      setLoading(false);
    }
  };

  const handleParsePasted = () => {
    if (!pastedText.trim()) return;
    setLoading(true);
    try {
      const rawRows = parsePastedTableText(pastedText);
      const validated = validateImportRows(rawRows);
      setItems(validated);
      setFileName('Буфер обмена (Google Sheets / Excel)');
    } catch (err: any) {
      console.error('Failed to parse pasted text:', err);
      alert('Не удалось распознать скопированные данные: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleExecuteImport = async () => {
    if (!user) return;
    if (items.length === 0) return;

    setImporting(true);
    try {
      const result = await executeBatchImport(items, user, {});
      setSuccessResult({
        companiesCount: result.companiesCreated,
        tasksCount: result.tasksCreated,
      });
    } catch (err: any) {
      console.error('Import failed:', err);
      alert('Ошибка при импорте: ' + (err.message || 'Проверьте данные'));
    } finally {
      setImporting(false);
    }
  };

  const validCount = items.filter((i) => i.isValid).length;
  const warningsCount = items.reduce((acc, i) => acc + i.warnings.length, 0);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded-full bg-[#E7F3EB] text-[#5FA07A] text-[11px] font-bold">
              Миграция данных
            </span>
          </div>
          <h1 className="text-2xl font-bold text-[#2B2A25] tracking-tight">
            Импорт из Excel / Google Таблиц
          </h1>
          <p className="text-xs text-[#8C8577] mt-1 max-w-xl">
            Перенесите базу компаний и задач агентства из таблиц за пару минут. Автоматическое распознавание ИНН, налоговых режимов и дедлайнов.
          </p>
        </div>

        <button
          type="button"
          onClick={downloadSampleImportExcel}
          className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-[#EAE3D6] bg-white hover:bg-[#FAF8F5] text-xs font-semibold text-[#2B2A25] shadow-sm transition self-start sm:self-auto"
        >
          <Download className="w-4 h-4 text-[#5FA07A]" />
          <span>Скачать образец таблицы (.xlsx)</span>
        </button>
      </div>

      {/* Success banner */}
      {successResult && (
        <div className="p-6 rounded-2xl bg-[#E7F3EB] border border-[#5FA07A]/40 mb-6 animate-fade-in">
          <div className="flex items-center gap-3 mb-2">
            <CheckCircle2 className="w-6 h-6 text-[#5FA07A]" />
            <h3 className="text-base font-bold text-[#2B2A25]">
              Импорт успешно завершён!
            </h3>
          </div>
          <p className="text-xs text-[#2B2A25] mb-4">
            Создано компаний: <strong>{successResult.companiesCount}</strong> • Создано сопутствующих задач: <strong>{successResult.tasksCount}</strong>.
          </p>
          <div className="flex items-center gap-3">
            <Link
              to="/dashboard"
              className="px-4 py-2 rounded-xl bg-[#5FA07A] text-white text-xs font-semibold hover:bg-[#528E6B]"
            >
              Перейти к рабочему столу
            </Link>
            <Link
              to="/tax-calendar"
              className="px-4 py-2 rounded-xl bg-white border border-[#5FA07A]/40 text-[#5FA07A] text-xs font-semibold hover:bg-[#FAF8F5]"
            >
              Налоговый календарь
            </Link>
          </div>
        </div>
      )}

      {/* Input Options Card */}
      {!successResult && (
        <div className="bg-white border border-[#EAE3D6] rounded-2xl p-6 shadow-sm mb-6">
          <div className="flex items-center gap-2 border-b border-[#EAE3D6] pb-3 mb-4">
            <button
              type="button"
              onClick={() => setInputMode('file')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition ${
                inputMode === 'file'
                  ? 'bg-[#E7F3EB] text-[#5FA07A]'
                  : 'text-[#8C8577] hover:text-[#2B2A25]'
              }`}
            >
              <Upload className="w-4 h-4" />
              <span>Загрузить файл (.xlsx, .csv)</span>
            </button>

            <button
              type="button"
              onClick={() => setInputMode('paste')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition ${
                inputMode === 'paste'
                  ? 'bg-[#E7F3EB] text-[#5FA07A]'
                  : 'text-[#8C8577] hover:text-[#2B2A25]'
              }`}
            >
              <Clipboard className="w-4 h-4" />
              <span>Вставить из буфера Google Sheets</span>
            </button>
          </div>

          {inputMode === 'file' ? (
            <div className="border-2 border-dashed border-[#EAE3D6] rounded-2xl p-8 text-center hover:border-[#5FA07A] transition bg-[#FAF8F5]/50">
              <Upload className="w-10 h-10 text-[#5FA07A] mx-auto mb-3" />
              <p className="text-xs font-semibold text-[#2B2A25] mb-1">
                Выберите файл таблицы на компьютере
              </p>
              <p className="text-[11px] text-[#8C8577] mb-4">
                Поддерживаются форматы Excel (.xlsx, .xls) и CSV
              </p>
              <label className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#5FA07A] hover:bg-[#528E6B] text-white text-xs font-semibold cursor-pointer shadow-sm transition">
                <span>Выбрать файл</span>
                <input
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
              {fileName && (
                <div className="mt-3 text-xs text-[#5FA07A] font-medium flex items-center justify-center gap-1.5">
                  <FileCheck className="w-4 h-4" />
                  <span>Выбран файл: {fileName}</span>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-[#8C8577]">
                Выделите строки в вашей Google Таблице или Excel (включая строку заголовков), скопируйте (Ctrl+C / Cmd+C) и вставьте в поле ниже:
              </p>
              <textarea
                rows={6}
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
                placeholder="Вставьте скопированные строки таблицы сюда..."
                className="w-full p-3.5 border border-[#EAE3D6] rounded-xl text-xs font-mono text-[#2B2A25] focus:outline-none focus:border-[#5FA07A] resize-none bg-[#FAF8F5]/50"
              />
              <button
                type="button"
                onClick={handleParsePasted}
                disabled={!pastedText.trim() || loading}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#5FA07A] hover:bg-[#528E6B] text-white text-xs font-semibold transition disabled:opacity-50"
              >
                <span>Распознать данные</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Preview Table */}
      {!successResult && items.length > 0 && (
        <div className="bg-white border border-[#EAE3D6] rounded-2xl overflow-hidden shadow-sm">
          <div className="p-5 border-b border-[#EAE3D6] bg-[#FAF8F5] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-[#2B2A25]">
                Предпросмотр данных ({items.length} строк)
              </h3>
              <p className="text-[11px] text-[#8C8577]">
                Корректных строк: <strong className="text-[#5FA07A]">{validCount}</strong>
                {warningsCount > 0 && ` • Предупреждений: ${warningsCount}`}
              </p>
            </div>

            <button
              type="button"
              onClick={handleExecuteImport}
              disabled={importing || validCount === 0}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#5FA07A] hover:bg-[#528E6B] text-white text-xs font-semibold shadow-sm transition disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              <span>
                {importing ? 'Импортируем...' : `Импортировать ${validCount} компаний в базу`}
              </span>
            </button>
          </div>

          <div className="overflow-x-auto max-h-[500px]">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#EAE3D6] bg-[#FAF8F5] text-[#8C8577] text-[11px]">
                  <th className="py-2.5 px-4 font-semibold">Статус</th>
                  <th className="py-2.5 px-4 font-semibold">Компания</th>
                  <th className="py-2.5 px-4 font-semibold">ИНН</th>
                  <th className="py-2.5 px-4 font-semibold">Тип</th>
                  <th className="py-2.5 px-4 font-semibold">Режим</th>
                  <th className="py-2.5 px-4 font-semibold">Район УГНС</th>
                  <th className="py-2.5 px-4 font-semibold">Телефон/WA</th>
                  <th className="py-2.5 px-4 font-semibold">Telegram</th>
                  <th className="py-2.5 px-4 font-semibold">Задача</th>
                  <th className="py-2.5 px-4 font-semibold">Срок</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EAE3D6]">
                {items.map((item) => (
                  <tr key={item.id} className="hover:bg-[#FAF8F5] transition">
                    <td className="py-2.5 px-4">
                      {item.isValid ? (
                        <CheckCircle2 className="w-4 h-4 text-[#5FA07A]" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-[#DD6B60]" />
                      )}
                    </td>
                    <td className="py-2.5 px-4 font-semibold text-[#2B2A25]">
                      {item.name}
                      {item.errors.length > 0 && (
                        <span className="block text-[10px] text-[#DD6B60]">
                          {item.errors.join(', ')}
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-4 font-mono">
                      {item.inn || '—'}
                      {item.warnings.length > 0 && (
                        <span className="block text-[10px] text-[#DB8A3C]">
                          {item.warnings.join(', ')}
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-4">{item.client_type}</td>
                    <td className="py-2.5 px-4 text-[#8C8577]">{item.tax_type_name}</td>
                    <td className="py-2.5 px-4 text-[#8C8577]">{item.tax_office_district}</td>
                    <td className="py-2.5 px-4 font-mono">{item.phone || '—'}</td>
                    <td className="py-2.5 px-4">{item.telegram || '—'}</td>
                    <td className="py-2.5 px-4 font-medium text-[#2B2A25]">{item.doc_type || '—'}</td>
                    <td className="py-2.5 px-4 font-mono text-[#5FA07A]">{item.due_date || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
