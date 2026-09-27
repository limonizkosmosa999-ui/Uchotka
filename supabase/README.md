# Backend & Database (Supabase)

Этот каталог содержит структуру базы данных, миграции, RLS политики и Edge Function для бухгалтерского агентства «Учётка».

## 1. Схема базы данных
- `tax_types` — справочник налоговых режимов («Единый налог», «Общий режим» и др.) с автоматическим описанием ставок `rate_description`.
- `users` — профили сотрудников агентства с ролями `'accountant'` (бухгалтер) и `'manager'` (руководитель).
- `companies` — карточки обслуживаемых компаний и ИП (клиентов агентства). Бухгалтер привязан через `owner_id`.
- `tasks` — задачи по сдаче отчетности и документов (`doc_type`, `due_date`, `status`, `wait_until`).
- `notifications` — журнал уведомлений для каждого бухгалтера о дедлайнах и изменениях.

## 2. Развертывание в Supabase
1. Создайте проект на [supabase.com](https://supabase.com).
2. Перейдите в **SQL Editor** и выполните скрипт из файла:
   `supabase/migrations/20260927000000_init_accounting_schema.sql`
3. Для включения ежедневных напоминаний выполните:
   `supabase/migrations/20260927000001_setup_reminders_cron.sql`
4. В **Project Settings -> API** скопируйте:
   - `Project URL` -> в `.env` как `VITE_SUPABASE_URL`
   - `anon public key` -> в `.env` как `VITE_SUPABASE_ANON_KEY`

## 3. Edge Function (Напоминания на Email)
Функция расположена в `supabase/functions/send-reminders/index.ts`.
Для деплоя через Supabase CLI:
```bash
supabase functions deploy send-reminders --no-verify-jwt
supabase secrets set RESEND_API_KEY=re_your_api_key
```

## 4. Realtime
В миграции автоматически включена публикация `supabase_realtime` для таблиц `tasks`, `companies`, `notifications`. Это обеспечивает мгновенное обновление панели руководителя (`/manager`) при любых изменениях задач бухгалтерами без перезагрузки страницы.
