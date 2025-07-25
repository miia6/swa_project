import { Hono } from "@hono/hono";
import { cors } from "@hono/hono/cors";
import { logger } from "@hono/hono/logger";
import { Redis } from "ioredis";
import postgres from "postgres";
import { levenshteinDistance } from "./grader-utils.js";

const app = new Hono();

app.use("/*", cors());
app.use("/*", logger());

const sql = postgres();

//const redisConsumer = new Redis(6379, "redis");
let redisConsumer;
if (Deno.env.get("REDIS_HOST")) {
    redisConsumer = new Redis(
        Number.parseInt(Deno.env.get("REDIS_PORT")),
        Deno.env.get("REDIS_HOST"),
    );
} else {
    redisConsumer = new Redis(6379, "redis");
}
const QUEUE_NAME = "submissions";

let consumeEnabled = false;

const consume = async () => {
    while (consumeEnabled) {
        const queueSize = await redisConsumer.llen(QUEUE_NAME);
        if (queueSize === 0) {
            await new Promise((resolve) => setTimeout(resolve, 250)); 
            continue;
        }

        const result = await redisConsumer.brpop(QUEUE_NAME, 0);
        if (result) {
            const [queue, submissionId] = result;  
            console.log("Updating grading status for submissionId:", submissionId, "processing");
            await sql`
                UPDATE exercise_submissions 
                SET grading_status = 'processing' 
                WHERE id = ${submissionId};
                `;

            const gradingTime = Math.floor(Math.random() * (3000 - 1000 + 1)) + 1000;
            await new Promise((resolve) => setTimeout(resolve, gradingTime));

            // Get submission and solution code
            const [submission] = await sql`
                SELECT es.source_code, e.solution_code
                FROM exercise_submissions es
                JOIN exercises e ON es.exercise_id = e.id
                WHERE es.id = ${submissionId}
            `;

            const submissionCode = submission.source_code;
            const solutionCode = submission.solution_code;

            // Calculate grade based on Levenshtein distance
            const distance = levenshteinDistance(submissionCode, solutionCode);
            const maxLength = Math.max(submissionCode.length, solutionCode.length);
            const grade = Math.ceil(100 * (1 - (distance / maxLength)));

            console.log("Grading completed for submissionId:", submissionId, "with grade:", grade);
            await sql`
                UPDATE exercise_submissions 
                SET grading_status = 'graded', grade = ${grade} 
                WHERE id = ${submissionId};
                `;

            console.log("graded succesfully")
        }
    } 
};

consume();

app.get("/api/status", async (c) => {
    const queueSize = await redisConsumer.llen(QUEUE_NAME);
    console.log("queue size: " + queueSize)
    return c.json({ queue_size: queueSize, consume_enabled: consumeEnabled });
});

app.post("/api/consume/enable", async (c) => {
    if (!consumeEnabled) {
        consumeEnabled = true;
        consume(); 
    }
    return c.json({ consume_enabled: true });
});

app.post("/api/consume/disable", async (c) => {
    consumeEnabled = false;
    return c.json({ consume_enabled: false });
});

export default app;

