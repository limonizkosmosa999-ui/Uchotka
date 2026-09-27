// supabase/functions/send-reminders/index.ts
// Supabase Edge Function (Deno) для отправки ежедневных напоминаний о дедлайнах сдачи отчётов
// Вызывается ежедневно по расписанию через pg_cron или внешним вебхуком

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TaskReminderRow {
  task_id: string;
  doc_type: string;
  due_date: string;
  status: string;
  company_name: string;
  company_inn: string;
  accountant_id: string;
  accountant_name: string;
  accountant_email: string;
  notification_email: string | null;
  days_left: number;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return new Response(
        JSON.stringify({ error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Текущая дата и целевые даты (через 1 день и через 3 дня)
    const today = new Date();
    const plus1Day = new Date(today);
    plus1Day.setDate(today.getDate() + 1);
    const dateStr1 = plus1Day.toISOString().split("T")[0];

    const plus3Days = new Date(today);
    plus3Days.setDate(today.getDate() + 3);
    const dateStr3 = plus3Days.toISOString().split("T")[0];

    // Выбираем не сданные задачи со сроком через 1 день и через 3 дня
    const { data: rawTasks, error: tasksError } = await supabase
      .from("tasks")
      .select(`
        id,
        doc_type,
        due_date,
        status,
        company:companies (
          name,
          inn,
          owner:users (
            id,
            full_name,
            email,
            notification_email
          )
        )
      `)
      .in("due_date", [dateStr1, dateStr3])
      .neq("status", "done")
      .neq("status", "submitted");

    if (tasksError) {
      console.error("Error fetching tasks:", tasksError);
      throw tasksError;
    }

    const tasks: TaskReminderRow[] = [];
    for (const item of (rawTasks || [])) {
      const comp: any = item.company;
      const owner: any = comp?.owner;
      if (!owner) continue;

      const dueDate = item.due_date;
      const daysLeft = dueDate === dateStr1 ? 1 : 3;

      tasks.push({
        task_id: item.id,
        doc_type: item.doc_type,
        due_date: dueDate,
        status: item.status,
        company_name: comp.name,
        company_inn: comp.inn,
        accountant_id: owner.id,
        accountant_name: owner.full_name,
        accountant_email: owner.email,
        notification_email: owner.notification_email,
        days_left: daysLeft,
      });
    }

    const results = {
      processed: tasks.length,
      notifications_created: 0,
      emails_sent: 0,
    };

    for (const t of tasks) {
      const recipientEmail = t.notification_email || t.accountant_email;
      const daysText = t.days_left === 1 ? "завтра (остался 1 день)" : "через 3 дня";
      const message = `Напоминание: Срок сдачи "${t.doc_type}" по компании "${t.company_name}" (ИНН: ${t.company_inn}) истекает ${daysText} (${t.due_date})!`;

      // 1. Создаем уведомление в БД (таблица notifications)
      const { error: notifErr } = await supabase.from("notifications").insert({
        user_id: t.accountant_id,
        task_id: t.task_id,
        message: message,
        is_read: false,
      });

      if (!notifErr) {
        results.notifications_created++;
      } else {
        console.warn("Could not insert notification:", notifErr);
      }

      // 2. Отправка Email через Resend (если настроен RESEND_API_KEY)
      if (resendApiKey && recipientEmail) {
        try {
          const emailHtml = `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #ffffff; border: 1px solid #EAE3D6; border-radius: 10px;">
              <h2 style="color: #2B2A25; margin-top: 0;">Уведомление о дедлайне сдачи</h2>
              <p style="color: #2B2A25; font-size: 15px;">Здравствуйте, <strong>${t.accountant_name}</strong>!</p>
              <div style="background-color: ${t.days_left === 1 ? '#FCE6E3' : '#FBEBD9'}; border-left: 4px solid ${t.days_left === 1 ? '#DD6B60' : '#DB8A3C'}; padding: 14px; border-radius: 6px; margin: 16px 0;">
                <p style="margin: 0; color: #2B2A25; font-size: 15px;">
                  Срок сдачи отчёта <strong>"${t.doc_type}"</strong> для компании <strong>"${t.company_name}"</strong> истекает <strong>${daysText}</strong> (${t.due_date}).
                </p>
              </div>
              <p style="color: #8C8577; font-size: 13px; line-height: 1.5;">
                Пожалуйста, проверьте статус документа и при необходимости переведите задачу в "Сдано" или "Ожидает ответа".
              </p>
              <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #EAE3D6; color: #8C8577; font-size: 12px;">
                Бухгалтерский сервис «Учётка»
              </div>
            </div>
          `;

          const emailRes = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${resendApiKey}`,
            },
            body: JSON.stringify({
              from: "Учётка Напоминания <reminders@uchotka.agency>",
              to: [recipientEmail],
              subject: `Дедлайн ${daysText}: ${t.doc_type} (${t.company_name})`,
              html: emailHtml,
            }),
          });

          if (emailRes.ok) {
            results.emails_sent++;
          } else {
            console.warn("Resend email failed:", await emailRes.text());
          }
        } catch (emailErr) {
          console.error("Error sending email:", emailErr);
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, ...results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
