<template>
  <div class="min-h-screen bg-stone-950 text-stone-100 antialiased">
    <main class="mx-auto flex min-h-screen max-w-5xl items-center px-6 py-16">
      <div class="grid w-full gap-10 lg:grid-cols-[1.3fr_0.9fr]">
        <section class="rounded-[2rem] border border-white/10 bg-white/5 p-8 shadow-2xl shadow-black/20 backdrop-blur">
          <p class="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300/80">
            Altals OAuth Bridge
          </p>
          <h1 class="mt-4 max-w-xl text-4xl font-semibold tracking-tight text-white sm:text-5xl">
            GitHub authorization endpoint for the desktop app.
          </h1>
          <p class="mt-5 max-w-2xl text-base leading-7 text-stone-300 sm:text-lg">
            This service only handles the GitHub OAuth handoff used by Altals. It does not host accounts,
            billing, AI proxying, analytics, or any other cloud features.
          </p>
          <div class="mt-8 flex flex-wrap gap-3">
            <a
              href="/api/v1/auth/github/connect?state=demo"
              class="inline-flex items-center rounded-full bg-white px-5 py-2.5 text-sm font-medium text-stone-950 transition hover:bg-stone-200"
            >
              Test GitHub OAuth
            </a>
            <a
              href="https://github.com/CaHLiNa/Altals"
              target="_blank"
              rel="noreferrer"
              class="inline-flex items-center rounded-full border border-white/15 px-5 py-2.5 text-sm font-medium text-stone-100 transition hover:border-white/30 hover:bg-white/5"
            >
              View repository
            </a>
          </div>
        </section>

        <section class="rounded-[2rem] border border-cyan-400/20 bg-cyan-400/10 p-8">
          <h2 class="text-lg font-semibold text-white">Required environment</h2>
          <dl class="mt-6 space-y-5 text-sm text-stone-200">
            <div>
              <dt class="font-mono text-cyan-200">NUXT_BASE_URL</dt>
              <dd class="mt-1 leading-6 text-stone-300">
                Public origin for this bridge, used to build the GitHub callback URL.
              </dd>
            </div>
            <div>
              <dt class="font-mono text-cyan-200">NUXT_GITHUB_CLIENT_ID</dt>
              <dd class="mt-1 leading-6 text-stone-300">
                GitHub OAuth app client ID.
              </dd>
            </div>
            <div>
              <dt class="font-mono text-cyan-200">NUXT_GITHUB_CLIENT_SECRET</dt>
              <dd class="mt-1 leading-6 text-stone-300">
                GitHub OAuth app client secret.
              </dd>
            </div>
          </dl>

          <div class="mt-8 rounded-2xl border border-white/10 bg-black/20 p-4">
            <p class="text-xs font-semibold uppercase tracking-[0.18em] text-stone-400">Status</p>
            <p class="mt-2 text-sm leading-6 text-stone-200">
              If you are seeing this page, the bridge is running. Launch the desktop app and connect GitHub from
              <span class="font-medium text-white">Settings -> GitHub</span>.
            </p>
          </div>
        </section>
      </div>
    </main>
  </div>
</template>
