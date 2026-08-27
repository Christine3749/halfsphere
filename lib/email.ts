import { Resend } from "resend";

let resend: Resend | null = null;
function getResend() {
  if (!resend) {
    const key = process.env.RESEND_API_KEY;
    if (!key) throw new Error("Missing RESEND_API_KEY");
    resend = new Resend(key);
  }
  return resend;
}

const FROM = "穹弯 <noreply@halfsphere.com>";

function escapeHtml(value: string) {
  return value.replace(
    /[&<>'"]/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[
        character
      ]!,
  );
}

function secureActionLink(value: string) {
  const url = new URL(value);
  if (url.protocol !== "https:") throw new Error("Approval link must use HTTPS");
  return escapeHtml(url.toString());
}

const base = (content: string) => `
<!DOCTYPE html>
<html lang="zh">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>穹弯</title>
</head>
<body style="margin:0;padding:0;background:#0A0A0B;font-family:'Courier New',Courier,monospace;-webkit-font-smoothing:antialiased">
  <div style="max-width:540px;margin:48px auto;padding:0 16px 48px">

    <!-- Logo -->
    <div style="text-align:center;margin-bottom:40px">
      <img src="https://halfsphere.com/favicon.svg" width="40" height="40" alt="穹弯" style="display:inline-block;vertical-align:middle;margin-right:10px">
      <span style="font-size:18px;font-weight:600;color:#E5E5E7;vertical-align:middle;letter-spacing:0.05em">穹弯</span>
    </div>

    <!-- Card -->
    <div style="background:#121214;border:1px solid #26262A;border-radius:8px;padding:40px">
      ${content}
    </div>

    <!-- Footer -->
    <div style="margin-top:24px;text-align:center">
      <p style="margin:0;font-size:11px;color:#4A4A4F;letter-spacing:0.12em;text-transform:uppercase">
        穹弯 · Internal Command Center
      </p>
      <p style="margin:8px 0 0;font-size:11px;color:#4A4A4F">
        个人作战面板 · <a href="https://halfsphere.com" style="color:#FFB020;text-decoration:none">halfsphere.com</a>
      </p>
    </div>
  </div>
</body>
</html>`;

export async function sendApprovalEmail(
  email: string,
  displayName: string,
  actionLink: string,
) {
  const safeEmail = escapeHtml(email);
  const safeDisplayName = escapeHtml(displayName);
  const safeActionLink = secureActionLink(actionLink);
  const content = `
    <!-- Badge -->
    <div style="margin-bottom:24px">
      <span style="display:inline-block;background:#FFB020;color:#0A0A0B;font-size:10px;font-weight:700;letter-spacing:0.2em;padding:4px 10px;border-radius:3px;text-transform:uppercase">
        ACCESS GRANTED · 已通过
      </span>
    </div>

    <!-- Title -->
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:600;color:#E5E5E7;letter-spacing:-0.02em">
      申请已通过
    </h1>
    <p style="margin:0 0 32px;font-size:13px;color:#8E8E93">
      你好，${safeDisplayName} · Your application has been approved.
    </p>

    <!-- One-time access -->
    <div style="background:#0A0A0B;border:1px solid #26262A;border-radius:6px;padding:24px;margin-bottom:28px">
      <p style="margin:0 0 16px;font-size:10px;letter-spacing:0.18em;color:#8E8E93;text-transform:uppercase">
        一次性链接 / One-time Link
      </p>
      <table style="width:100%;border-collapse:collapse">
        <tr>
          <td style="padding:8px 0;border-bottom:1px solid #1a1a1c;font-size:11px;color:#6E6E76;letter-spacing:0.1em;text-transform:uppercase;width:100px">
            邮箱 / Email
          </td>
          <td style="padding:8px 0;border-bottom:1px solid #1a1a1c;font-size:13px;color:#E5E5E7">
            ${safeEmail}
          </td>
        </tr>
        <tr>
          <td style="padding:8px 0;font-size:11px;color:#6E6E76;letter-spacing:0.1em;text-transform:uppercase">
            安全 / Security
          </td>
          <td style="padding:8px 0;font-size:12px;color:#8E8E93;line-height:1.6">
            链接仅用于本次设置密码，请勿转发。
          </td>
        </tr>
      </table>
    </div>

    <!-- CTA -->
    <div style="text-align:center;margin-bottom:28px">
      <a href="${safeActionLink}" style="display:inline-block;background:#FFB020;color:#0A0A0B;font-size:13px;font-weight:700;letter-spacing:0.08em;padding:12px 32px;border-radius:6px;text-decoration:none;text-transform:uppercase">
        设置密码 · Set Password
      </a>
    </div>

    <!-- Note -->
    <p style="margin:0;font-size:12px;color:#4A4A4F;line-height:1.7;text-align:center">
      如果你没有申请访问，请忽略此邮件。<br>
      Ignore this message if you did not request access.
    </p>`;

  await getResend().emails.send({
    from: FROM,
    to: email,
    subject: "你的穹弯申请已通过 · Access Granted",
    html: base(content),
  });
}

export async function sendRejectionEmail(email: string, displayName: string) {
  const content = `
    <!-- Badge -->
    <div style="margin-bottom:24px">
      <span style="display:inline-block;background:#26262A;color:#8E8E93;font-size:10px;font-weight:700;letter-spacing:0.2em;padding:4px 10px;border-radius:3px;text-transform:uppercase">
        APPLICATION UPDATE · 申请更新
      </span>
    </div>

    <!-- Title -->
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:600;color:#E5E5E7;letter-spacing:-0.02em">
      关于你的申请
    </h1>
    <p style="margin:0 0 32px;font-size:13px;color:#8E8E93">
      你好，${displayName} · Regarding your application.
    </p>

    <!-- Body -->
    <div style="background:#0A0A0B;border:1px solid #26262A;border-radius:6px;padding:24px;margin-bottom:28px">
      <p style="margin:0 0 12px;font-size:13px;color:#6E6E76;line-height:1.8">
        感谢你申请加入穹弯，本次暂未通过审核。
      </p>
      <p style="margin:0;font-size:13px;color:#6E6E76;line-height:1.8">
        Thank you for applying to Qiongwan. Unfortunately, your application was not approved at this time.
      </p>
    </div>

    <p style="margin:0;font-size:12px;color:#4A4A4F;line-height:1.7;text-align:center">
      如有疑问，请回复此邮件。<br>
      If you have questions, please reply to this email.
    </p>`;

  await getResend().emails.send({
    from: FROM,
    to: email,
    subject: "关于你的穹弯申请 · Application Update",
    html: base(content),
  });
}
