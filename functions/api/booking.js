const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });

const limit = (value, max) => String(value ?? "").trim().slice(0, max);

export async function onRequestPost({ request, env }) {
  const origin = request.headers.get("Origin");
  const requestOrigin = new URL(request.url).origin;

  if (origin && origin !== requestOrigin) {
    return json({ error: "forbidden" }, 403);
  }

  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) {
    return json({ error: "not_configured" }, 503);
  }

  let data;
  try {
    data = await request.json();
  } catch {
    return json({ error: "invalid_request" }, 400);
  }

  const name = limit(data.name, 100);
  const contact = limit(data.contact, 160);
  const service = limit(data.service, 40);
  const consent = data.consent === "on";
  const services = {
    group: "Групповые занятия",
    individual: "Индивидуальная тренировка",
    telegram: "Подписка на Telegram",
  };

  if (!name || !contact || !services[service] || !consent) {
    return json({ error: "invalid_fields" }, 400);
  }

  const group = limit(data.group, 100);
  const time = limit(data.time, 160);
  const comment = limit(data.comment, 1000);
  const lines = [
    "Новая заявка с сайта Yoga Lizza",
    "",
    `Имя: ${name}`,
    `Контакт: ${contact}`,
    `Формат: ${services[service]}`,
  ];

  if (service === "group" && group) lines.push(`Группа: ${group}`);
  if (time) lines.push(`Удобное время: ${time}`);
  if (comment) lines.push(`Комментарий: ${comment}`);

  try {
    const telegramResponse = await fetch(
      `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          chat_id: env.TELEGRAM_CHAT_ID,
          text: lines.join("\n"),
          disable_web_page_preview: true,
        }),
      },
    );

    const result = await telegramResponse.json();
    if (!telegramResponse.ok || !result.ok) {
      return json({ error: "delivery_failed" }, 502);
    }

    return json({ ok: true });
  } catch {
    return json({ error: "delivery_failed" }, 502);
  }
}
