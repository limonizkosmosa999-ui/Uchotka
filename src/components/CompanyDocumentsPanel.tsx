import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, CalendarDays, ExternalLink, FileText, MapPin, Upload } from 'lucide-react';
import {
  createCompanyDocument,
  getCompanyDocumentSizeLimit,
  getCompanyDocuments,
  getCompanyDocumentUrl,
} from '../lib/api';
import { CompanyDocument } from '../types';
import { formatDateRu } from '../lib/dateUtils';

interface CompanyDocumentsPanelProps {
  companyId: string;
  userId: string;
}

type CompanyDocumentWithUrl = CompanyDocument & { downloadUrl: string };

const getToday = () => {
  const today = new Date();
  today.setMinutes(today.getMinutes() - today.getTimezoneOffset());
  return today.toISOString().slice(0, 10);
};

export const CompanyDocumentsPanel: React.FC<CompanyDocumentsPanelProps> = ({
  companyId,
  userId,
}) => {
  const [documents, setDocuments] = useState<CompanyDocumentWithUrl[]>([]);
  const [title, setTitle] = useState('');
  const [receivedAddress, setReceivedAddress] = useState('');
  const [receivedAt, setReceivedAt] = useState(getToday);
  const [notes, setNotes] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const maxSizeMb = Math.floor(getCompanyDocumentSizeLimit() / (1024 * 1024));

  useEffect(() => {
    let cancelled = false;

    const loadDocuments = async () => {
      setLoading(true);
      setError(null);
      try {
        const items = await getCompanyDocuments(companyId);
        const documentsWithUrls = await Promise.all(
          items.map(async (document) => ({
            ...document,
            downloadUrl: await getCompanyDocumentUrl(document),
          }))
        );
        if (!cancelled) setDocuments(documentsWithUrls);
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Не удалось загрузить документы');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadDocuments();
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!file) {
      setError('Выберите отсканированный файл договора');
      return;
    }

    setError(null);
    setSaving(true);
    try {
      const document = await createCompanyDocument({
        companyId,
        createdBy: userId,
        title,
        receivedAddress,
        receivedAt,
        notes,
        file,
      });
      const downloadUrl = await getCompanyDocumentUrl(document);
      setDocuments((current) => [{ ...document, downloadUrl }, ...current]);
      setTitle('');
      setReceivedAddress('');
      setReceivedAt(getToday());
      setNotes('');
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Не удалось сохранить документ');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(300px,0.8fr)] gap-5 items-start">
      <section className="bg-white border border-[#EAE3D6] rounded-[10px] p-5">
        <div className="flex items-center gap-2 mb-4">
          <FileText className="w-4 h-4 text-[#5FA07A]" />
          <h2 className="text-sm font-bold text-[#2B2A25]">Полученные документы</h2>
          <span className="text-xs text-[#8C8577]">({documents.length})</span>
        </div>

        {loading ? (
          <p className="py-8 text-center text-xs text-[#8C8577]">Загружаем документы...</p>
        ) : documents.length === 0 ? (
          <div className="py-8 text-center">
            <FileText className="w-8 h-8 text-[#C7A96E] mx-auto mb-2 opacity-60" />
            <p className="text-sm font-semibold text-[#2B2A25]">Документов пока нет</p>
            <p className="text-xs text-[#8C8577] mt-1">Добавьте скан договора или другого полученного документа.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {documents.map((document) => (
              <article key={document.id} className="border border-[#EAE3D6] rounded-[10px] p-4">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-[#2B2A25] break-words">{document.title}</h3>
                    <p className="text-xs text-[#8C8577] mt-1 break-all">{document.file_name}</p>
                  </div>
                  <a
                    href={document.downloadUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex flex-shrink-0 items-center justify-center gap-1.5 px-3 py-2 rounded-[8px] bg-[#E7F3EB] text-xs font-semibold text-[#5FA07A] hover:bg-[#D8EBDD]"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Открыть скан
                  </a>
                </div>

                <div className="mt-3 flex flex-col gap-2 text-xs text-[#6B6558]">
                  <span className="inline-flex items-start gap-1.5">
                    <MapPin className="w-3.5 h-3.5 flex-shrink-0 text-[#C7A96E] mt-0.5" />
                    <span>{document.received_address}</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarDays className="w-3.5 h-3.5 text-[#C7A96E]" />
                    Получен {formatDateRu(document.received_at, 'd MMMM yyyy')}
                  </span>
                </div>

                {document.notes && (
                  <p className="mt-3 pt-3 border-t border-[#EAE3D6] text-xs text-[#6B6558] whitespace-pre-wrap">
                    {document.notes}
                  </p>
                )}
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="bg-white border border-[#EAE3D6] rounded-[10px] p-5">
        <div className="flex items-center gap-2 mb-4">
          <Upload className="w-4 h-4 text-[#5FA07A]" />
          <h2 className="text-sm font-bold text-[#2B2A25]">Добавить документ</h2>
        </div>

        {error && (
          <div role="alert" className="mb-4 p-3 rounded-[8px] bg-[#FCE6E3] border border-[#DD6B60]/30 text-xs text-[#C0392B] flex items-start gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label htmlFor="company-document-title" className="block text-xs font-semibold text-[#2B2A25] mb-1">
              Название документа *
            </label>
            <input
              id="company-document-title"
              required
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Договор с ОсОО «Партнёр»"
              className="w-full px-3 py-2 text-xs border border-[#EAE3D6] rounded-[8px] focus:outline-none focus:border-[#5FA07A]"
            />
          </div>

          <div>
            <label htmlFor="company-document-address" className="block text-xs font-semibold text-[#2B2A25] mb-1">
              Адрес получения *
            </label>
            <input
              id="company-document-address"
              required
              value={receivedAddress}
              onChange={(event) => setReceivedAddress(event.target.value)}
              placeholder="г. Бишкек, ул. Киевская, 10"
              className="w-full px-3 py-2 text-xs border border-[#EAE3D6] rounded-[8px] focus:outline-none focus:border-[#5FA07A]"
            />
          </div>

          <div>
            <label htmlFor="company-document-date" className="block text-xs font-semibold text-[#2B2A25] mb-1">
              Дата получения *
            </label>
            <input
              id="company-document-date"
              type="date"
              required
              value={receivedAt}
              onChange={(event) => setReceivedAt(event.target.value)}
              className="w-full px-3 py-2 text-xs border border-[#EAE3D6] rounded-[8px] focus:outline-none focus:border-[#5FA07A]"
            />
          </div>

          <div>
            <label htmlFor="company-document-file" className="block text-xs font-semibold text-[#2B2A25] mb-1">
              Скан документа *
            </label>
            <input
              id="company-document-file"
              ref={fileInputRef}
              type="file"
              required
              accept="application/pdf,image/jpeg,image/png,image/webp,.pdf,.jpg,.jpeg,.png,.webp"
              capture="environment"
              onChange={(event) => setFile(event.target.files?.[0] || null)}
              className="w-full text-xs text-[#6B6558] file:mr-3 file:px-3 file:py-2 file:border-0 file:rounded-[6px] file:bg-[#FAF8F5] file:text-xs file:font-semibold file:text-[#5FA07A]"
            />
            <p className="text-[11px] text-[#8C8577] mt-1">
              PDF или изображение, до {maxSizeMb} МБ. На телефоне можно выбрать камеру.
            </p>
          </div>

          <div>
            <label htmlFor="company-document-notes" className="block text-xs font-semibold text-[#2B2A25] mb-1">
              Комментарий
            </label>
            <textarea
              id="company-document-notes"
              rows={3}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="С кем заключён договор, номер или дополнительные сведения"
              className="w-full px-3 py-2 text-xs border border-[#EAE3D6] rounded-[8px] focus:outline-none focus:border-[#5FA07A] resize-y"
            />
          </div>

          <button
            type="submit"
            disabled={saving || loading}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-[8px] bg-[#5FA07A] text-xs font-semibold text-white hover:bg-[#528E6B] disabled:opacity-50"
          >
            <Upload className="w-3.5 h-3.5" />
            {saving ? 'Сохраняем документ...' : 'Сохранить в документы компании'}
          </button>
        </form>
      </section>
    </div>
  );
};
