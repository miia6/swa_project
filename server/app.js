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
  console.log("HEREEEEEEEEEEE ")
    const id = c.req.param("id");
    const { source_code } = await c.req.json();
    console.log("id, source_code: ", id, source_code);

    const [submission] = await sql`
        INSERT INTO exercise_submissions (exercise_id, source_code, grading_status)
        VALUES (${id}, ${source_code}, 'pending')
        RETURNING id;`

    await redisConsumer.lpush(QUEUE_NAME, submission.id);
    return c.json({ id: submission.id });
});

app.get("/api/exercises/:id", async (c) => {
    const id = c.req.param("id");
    const exercise = await sql`SELECT id, title, description FROM exercises WHERE id = ${id}`;

    if (exercise.length === 0) {
        return new Response("Exercise not found", { status: 404 });
    }

    const exerciseData = exercise[0];

    const response = new Response(JSON.stringify(exerciseData), {
      headers: { "Content-Type": "application/json" },
    });
    
    //console.log(response);
    return response;
});

app.get("/api/submissions/:id/status", async (c) => {
  const id = c.req.param("id");
  const submission = await sql`SELECT grading_status, grade FROM exercise_submissions WHERE id = ${id}`;

  if (submission.length === 0) {
      return new Response("Submission not found", { status: 404 });
  }

  const submissionData = submission[0];

  const response = new Response(JSON.stringify(submissionData), {
    headers: { "Content-Type": "application/json" },
  });

  //console.log(response);
  return response;
});


export default app;