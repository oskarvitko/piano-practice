const site = new URL(process.argv[2] ?? process.env.DEPLOYMENT_URL);
const attempts = Number(process.env.DEPLOYMENT_CHECK_ATTEMPTS ?? 1);
if (
  !['https:', 'http:'].includes(site.protocol) ||
  !Number.isInteger(attempts) ||
  attempts < 1 ||
  attempts > 12
) {
  throw new Error('Expected an HTTP(S) deployment URL and 1–12 attempts.');
}

async function request(url) {
  const response = await fetch(url, {
    headers: { 'Cache-Control': 'no-cache' },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`${response.status}: ${url}`);
  return response;
}

async function verify() {
  const page = new URL(site);
  page.searchParams.set('deployment-check', process.env.GITHUB_SHA ?? String(Date.now()));
  const html = await (await request(page)).text();
  if (html.includes('%BASE_URL%') || /src=["'][^"']*\/src\/[^"']+\.[jt]sx?["']/i.test(html)) {
    throw new Error(
      'GitHub Pages serves source files. Set Pages Source to GitHub Actions and allow the deployment branch in the github-pages environment.',
    );
  }
  const scripts = [...html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi)].map(
    (match) => match[1],
  );
  const styles = [...html.matchAll(/<link\b[^>]*\bhref=["']([^"']+\.css)["'][^>]*>/gi)].map(
    (match) => match[1],
  );
  if (!scripts.length || !styles.length)
    throw new Error('The deployed page has no built JavaScript or CSS.');
  for (const asset of [...scripts, ...styles]) {
    const url = new URL(asset, site);
    if (url.origin !== site.origin || !url.pathname.startsWith(site.pathname)) {
      throw new Error(`Asset is outside the deployment path: ${url}`);
    }
    const response = await request(url);
    const expected = url.pathname.endsWith('.css') ? /text\/css/i : /(?:java|ecma)script/i;
    if (!expected.test(response.headers.get('content-type') ?? '')) {
      throw new Error(
        `Unexpected content type for ${url}: ${response.headers.get('content-type')}`,
      );
    }
    if (!(await response.text()).trim()) throw new Error(`Empty asset: ${url}`);
  }
  console.log(
    `Deployment verified: ${site} (${scripts.length} scripts, ${styles.length} stylesheets)`,
  );
}

for (let attempt = 1; attempt <= attempts; attempt++) {
  try {
    await verify();
    break;
  } catch (error) {
    if (attempt === attempts) {
      console.error(`Deployment verification failed: ${error.message}`);
      process.exitCode = 1;
      break;
    }
    console.warn(`Deployment check ${attempt}/${attempts}: ${error.message}. Retrying in 10s.`);
    await new Promise((resolve) => setTimeout(resolve, 10_000));
  }
}
