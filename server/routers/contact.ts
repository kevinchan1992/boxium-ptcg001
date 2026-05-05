/**
 * Contact router — handles the public contact form submission.
 * Sends an email to boxium.asia@gmail.com using the existing emailService infrastructure.
 */
import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { sendEmail } from "../emailService";

const CONTACT_EMAIL = "boxium.asia@gmail.com";

const SUBJECT_LABELS: Record<string, string> = {
  general: "一般查詢",
  order: "訂單問題",
  seller: "賣家申請",
  grading: "PSA 鑑定",
  technical: "技術支援",
  other: "其他",
};

function buildContactEmailHtml(data: {
  name: string;
  email: string;
  subject: string;
  message: string;
}): string {
  const subjectLabel = SUBJECT_LABELS[data.subject] ?? data.subject;
  const now = new Date().toLocaleString("zh-HK", { timeZone: "Asia/Hong_Kong" });

  return `
<!DOCTYPE html>
<html lang="zh-TW">
<head><meta charset="UTF-8" /></head>
<body style="margin:0;padding:0;background:#f0f2ff;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f2ff;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(6,3,141,0.08);">
        <!-- Header -->
        <tr>
          <td style="background:#06038d;padding:28px 32px;">
            <h1 style="margin:0;color:#FEDD00;font-size:22px;font-weight:800;letter-spacing:1px;">BOXIUM</h1>
            <p style="margin:6px 0 0;color:rgba(255,255,255,0.75);font-size:13px;">新的聯絡表單訊息</p>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:28px 32px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding:10px 0;border-bottom:1px solid #f0f2ff;">
                  <span style="color:#888;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">主題</span><br/>
                  <span style="color:#06038d;font-size:15px;font-weight:700;">${subjectLabel}</span>
                </td>
              </tr>
              <tr>
                <td style="padding:10px 0;border-bottom:1px solid #f0f2ff;">
                  <span style="color:#888;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">姓名</span><br/>
                  <span style="color:#1a1a2e;font-size:15px;">${data.name}</span>
                </td>
              </tr>
              <tr>
                <td style="padding:10px 0;border-bottom:1px solid #f0f2ff;">
                  <span style="color:#888;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">回覆電郵</span><br/>
                  <a href="mailto:${data.email}" style="color:#06038d;font-size:15px;text-decoration:none;">${data.email}</a>
                </td>
              </tr>
              <tr>
                <td style="padding:10px 0;border-bottom:1px solid #f0f2ff;">
                  <span style="color:#888;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">訊息內容</span><br/>
                  <p style="color:#1a1a2e;font-size:15px;line-height:1.7;white-space:pre-wrap;margin:6px 0 0;">${data.message.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>
                </td>
              </tr>
              <tr>
                <td style="padding:10px 0;">
                  <span style="color:#888;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">提交時間</span><br/>
                  <span style="color:#888;font-size:13px;">${now} (HKT)</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background:#f8f9ff;padding:16px 32px;border-top:1px solid #e8eaff;">
            <p style="margin:0;color:#aaa;font-size:12px;">此郵件由 BOXIUM 聯絡表單自動發送 · <a href="https://boxium.asia" style="color:#06038d;text-decoration:none;">boxium.asia</a></p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
  `.trim();
}

export const contactRouter = router({
  sendMessage: publicProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100),
        email: z.string().email(),
        subject: z.string().min(1).max(100),
        message: z.string().min(10).max(5000),
      })
    )
    .mutation(async ({ input }) => {
      const subjectLabel = SUBJECT_LABELS[input.subject] ?? input.subject;
      const html = buildContactEmailHtml(input);

      const sent = await sendEmail({
        to: CONTACT_EMAIL,
        subject: `[BOXIUM 聯絡表單] ${subjectLabel} — ${input.name}`,
        html,
        emailType: "contact_form",
        skipUnsubscribeCheck: true,
      });

      if (!sent) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "電郵發送失敗，請稍後再試或直接發送電郵至 boxium.asia@gmail.com",
        });
      }

      return { success: true };
    }),
});
