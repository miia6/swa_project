import { Hono } from "@hono/hono";
import { cors } from "@hono/hono/cors";
import { logger } from "@hono/hono/logger";
import { cache } from "@hono/hono/cache";
import { Redis } from "ioredis";
import postgres from "postgres";
import { auth } from "./auth.js";

const app = new Hono();
const sql = postgres();

app.on(["POST", "GET"], "/api/auth/**", (c) => auth.handler(c.req.raw));

app.use("/*", cors());
app.use("/*", logger());

//const redisProducer = new Redis(6379, "redis");
let redisProducer;
if (Deno.env.get("REDIS_HOST")) {
  redisProducer = new Redis(
    Number.parseInt(Deno.env.get("REDIS_PORT")),
    Deno.env.get("REDIS_HOST"),
  );
} else {
  redisProducer = new Redis(6379, "redis");
}
const QUEUE_NAME = 'submissions';

app.use("*", async (c, next) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) {
    return next();
  }

  c.set("user", session.user.name);
  return next();
});

app.use("/api/exercises/:id/submissions", async (c, next) => {
  const user = c.get("user");
  if (!user) {
    c.status(401);
    return c.json({ message: "Unauthorized" });
  }

  return next();
});

app.use("/api/submissions/:id/status", async (c, next) => {
  const user = c.get("user");
  if (!user) {
    c.status(401);
    return c.json({ message: "Unauthorized" });
  }

  return next();
});

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
    const user = c.get("user");
    
    // Get user ID from session
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    const userId = session.user.id;
    
    console.log("id, source_code, user_id: ", id, source_code, userId);

    const [submission] = await sql`
        INSERT INTO exercise_submissions (exercise_id, source_code, grading_status, user_id)
        VALUES (${id}, ${source_code}, 'pending', ${userId})
        RETURNING id;`

    await redisProducer.lpush(QUEUE_NAME, submission.id);
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
  
  // Get user ID from session
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  const userId = session.user.id;
  
  // Query submission with user_id check
  const submission = await sql`
    SELECT grading_status, grade 
    FROM exercise_submissions 
    WHERE id = ${id} AND user_id = ${userId}
  `;

  if (submission.length === 0) {
      return new Response("Submission not found", { status: 404 });
  }

  const submissionData = submission[0];

  const response = new Response(JSON.stringify(submissionData), {
    headers: { "Content-Type": "application/json" },
  });

  return response;
});

app.get("/api/lgtm-test", (c) => {
  console.log("Hello log collection :)");
  return c.json({ message: "Hello, world!" });
});


export default app;