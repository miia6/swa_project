import { Hono } from "@hono/hono";
import { cors } from "@hono/hono/cors";
import { logger } from "@hono/hono/logger";
import { cache } from "@hono/hono/cache";
import { Redis } from "ioredis";
import postgres from "postgres";

const app = new Hono();
const sql = postgres();

app.use("/*", cors());
app.use("/*", logger());

/*let redis;
if (Deno.env.get("REDIS_HOST")) {
  redis = new Redis(
    Number.parseInt(Deno.env.get("REDIS_PORT")),
    Deno.env.get("REDIS_HOST"),
  );
} else {
  redis = new Redis(6379, "redis");
}*/

const redisConsumer = new Redis(6379, "redis");
const QUEUE_NAME = 'submissions';

app.get(
    "/api/languages",
    cache({
      cacheName: "language-cache",
      wait: true,
    }),
);

//app.get("/", (c) => c.json({ message: "Hello world!" }));

app.get("/api/languages", async (c) => {
    const cache = await caches.open("language-cache");
    const cachedResponse = await cache.match(c.req.url);

    if (cachedResponse) {
        return cachedResponse;
    }

    const languages = await sql`SELECT * FROM languages`;
    const response = new Response(JSON.stringify(languages), {
        headers: { "Content-Type": "application/json" },
    });

    await cache.put(c.req.url, response.clone());
    return response;
});

app.get(
    "/api/languages/:id/exercises",
    cache({
      cacheName: "language-cache",
      wait: true,
    })
);

app.get("/api/languages/:id/exercises", async (c) => {
    const id = c.req.param("id");
    const cache = await caches.open("language-cache");
    const cachedResponse = await cache.match(c.req.url);

    if (cachedResponse) {
        return cachedResponse;
    }

    const exercises = await sql`SELECT id, title, description FROM exercises WHERE language_id = ${id}`;
    const response = new Response(JSON.stringify(exercises), {
        headers: { "Content-Type": "application/json" },
    });

    await cache.put(c.req.url, response.clone());
    return response;
});

app.post("/api/exercises/:id/submissions", async (c) => {
    const id = c.req.param("id");
    const { source_code } = await c.req.json();

    const [submission] = await sql`
        INSERT INTO exercise_submissions (exercise_id, source_code, grading_status)
        VALUES (${id}, ${source_code}, 'pending')
        RETURNING id;`

    await redis.lpush(QUEUE_NAME, submission.id);
    return c.json({ id: submission.id });
})

export default app;