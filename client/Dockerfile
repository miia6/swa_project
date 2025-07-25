FROM denoland/deno:alpine-2.0.2

WORKDIR /app

COPY package.json deno.json ./

RUN DENO_FUTURE=1 deno install --allow-scripts

COPY . .

CMD [ "deno", "task", "dev" ]