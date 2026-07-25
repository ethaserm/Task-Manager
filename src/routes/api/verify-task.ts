import { createFileRoute } from "@tanstack/react-router";

const SYSTEM = `You verify photographic proof that a household task was completed.
Ignore camera angle, distance, lighting, image quality, clutter outside the task,
and minor imperfections such as small wrinkles or slight misalignment — never
reject for those. But be strict about the checklist itself: EVERY condition in
the checklist must be visibly true in the photo. If any listed condition is
missing, not visible, or clearly not met, reject and name which one.
Reply with strict JSON:
{"verdict":"APPROVED"|"REJECTED","reason":"one short line"}`;

export const Route = createFileRoute("/api/verify-task")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { taskName, criteria, image } = (await request.json()) as {
          taskName: string;
          criteria?: string;
          image: string;
        };
        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-3.6-flash",
            messages: [
              { role: "system", content: SYSTEM },
              {
                role: "user",
                content: [
                  {
                    type: "text",
                    text: `Task: "${taskName}".\nChecklist — approve ONLY if every condition below is visibly true: ${
                      criteria || `the task "${taskName}" clearly appears to be completed`
                    }\nDo not reject for angle, lighting, or minor untidiness.`,
                  },
                  { type: "image_url", image_url: { url: image } },
                ],
              },
            ],
            response_format: { type: "json_object" },
          }),
        });

        if (res.status === 429)
          return Response.json(
            { verdict: "REJECTED", reason: "Rate limit reached — try again shortly." },
            { status: 429 },
          );
        if (res.status === 402)
          return Response.json(
            { verdict: "REJECTED", reason: "AI credits exhausted." },
            { status: 402 },
          );
        if (!res.ok) return new Response(await res.text(), { status: res.status });

        const json = (await res.json()) as {
          choices?: { message?: { content?: string } }[];
        };
        const raw = json.choices?.[0]?.message?.content ?? "";
        let verdict = "REJECTED";
        let reason = "Could not read the photo clearly.";
        try {
          const parsed = JSON.parse(raw.replace(/```json|```/g, "").trim());
          verdict = String(parsed.verdict).toUpperCase().includes("APPROV")
            ? "APPROVED"
            : "REJECTED";
          reason = String(parsed.reason ?? "").slice(0, 140);
        } catch {
          if (/APPROVED/i.test(raw)) verdict = "APPROVED";
          reason = raw.slice(0, 140) || reason;
        }
        return Response.json({ verdict, reason });
      },
    },
  },
});
