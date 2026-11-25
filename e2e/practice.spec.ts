import { expect, test, type Page } from '@playwright/test';

async function prepare(page: Page, trainer: string) {
  await page.goto(`#/practice/${trainer}`);
  await page.getByLabel('BPM', { exact: true }).fill('120');
  if (trainer === 'scale') {
    await page.getByRole('combobox', { name: 'Руки', exact: true }).selectOption('left');
    await page.getByRole('combobox', { name: 'Ритм', exact: true }).selectOption('3');
    await page.getByText('Дополнительные настройки', { exact: true }).click();
    await page.getByRole('combobox', { name: 'Размер', exact: true }).selectOption('6/8');
    await page.getByLabel('Мелодия примера', { exact: true }).check();
  }
  await page.getByRole('button', { name: 'Подготовить тренировку' }).click();
  await expect(page.locator('.practice-session')).toHaveAttribute('data-phase', 'ready');
}

for (const trainer of ['degree', 'chord', 'style', 'fill', 'scale']) {
  test(`${trainer}: start, hint demonstration, repeat, live tempo, finish`, async ({
    page,
    browserName,
  }) => {
    test.skip(
      browserName === 'webkit' && process.platform === 'win32',
      'Windows WebKit has no Web Audio; these scenarios run in Chromium locally and WebKit on Linux CI.',
    );
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await prepare(page, trainer);
    const session = page.locator('.practice-session');
    const start = page.getByRole('button', { name: 'Start', exact: true });
    await expect(start).toBeInViewport();
    await start.click();
    await expect(session).toHaveAttribute('data-phase', 'countdown');
    await expect(session).toHaveAttribute('data-phase', 'playing');
    await page.getByRole('button', { name: 'Сложно', exact: true }).click();
    await page.getByRole('button', { name: 'Подсказка', exact: true }).click();
    await expect(session).toHaveAttribute('data-phase', 'hint');
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('heading', { name: 'Разбор задания' })).toBeVisible();
    await expect(dialog.locator('.example-melody button').first()).toBeVisible();
    await dialog.getByRole('button', { name: 'Слушать упражнение', exact: true }).click();
    await expect(
      dialog.getByRole('button', { name: 'Пауза воспроизведения', exact: true }),
    ).toBeVisible();
    await dialog.getByRole('button', { name: 'Повторить с отсчётом' }).click();
    await expect(session).toHaveAttribute('data-phase', 'playing');
    await page.getByLabel('BPM тренировки', { exact: true }).fill('140');
    await expect(page.getByLabel('Темп во время тренировки')).toHaveValue('140');
    await page.getByRole('button', { name: 'Пауза', exact: true }).click();
    await expect(session).toHaveAttribute('data-phase', 'paused');
    await page.getByRole('button', { name: 'Завершить', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Хорошая встреча с музыкой.' })).toBeVisible();
    await page.getByRole('link', { name: 'История', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Твоя история практики' })).toBeVisible();
    await expect(page.locator('.practice-history-list button')).toHaveCount(1);
    expect(errors).toEqual([]);
  });
}

test('restores a paused session and fits landscape without horizontal overflow', async ({
  page,
  browserName,
}) => {
  test.skip(
    browserName === 'webkit' && process.platform === 'win32',
    'Requires Web Audio, tested in Linux WebKit CI.',
  );
  await prepare(page, 'chord');
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await expect(page.locator('.practice-session')).toHaveAttribute('data-phase', 'playing');
  await page.getByRole('button', { name: 'Пауза', exact: true }).click();
  const chord = await page.locator('.practice-task-value').innerText();
  await page.reload();
  await expect(page.locator('.practice-session')).toHaveAttribute('data-phase', 'paused');
  await expect(page.locator('.practice-task-value')).toHaveText(chord);
  await page.setViewportSize({ width: 844, height: 390 });
  await expect(page.getByRole('button', { name: 'Продолжить', exact: true })).toBeInViewport();
  await expect(page.getByRole('button', { name: 'Завершить', exact: true })).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Продолжить', exact: true }).click();
  await expect(page.locator('.practice-session')).toHaveAttribute('data-phase', 'playing');
  // Browser lifecycle notifications pause and checkpoint the active audio session.
  await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
  await expect(page.locator('.practice-session')).toHaveAttribute('data-phase', 'paused');
});

test('offline app and both local voice languages survive a reload', async ({
  page,
  context,
  browserName,
}) => {
  test.setTimeout(90_000);
  test.skip(
    browserName === 'webkit' && process.platform === 'win32',
    'Requires Web Audio, tested in Linux WebKit CI.',
  );
  await page.goto('#/practice');
  await expect(page.getByText('Готово к занятиям офлайн')).toBeVisible({ timeout: 30_000 });
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Садись. Выбирай. Играй.' })).toBeVisible();
  for (const language of ['en', 'pl']) {
    await prepare(page, 'degree');
    await page.getByRole('button', { name: 'Настройки тренировки', exact: true }).click();
    await page.getByLabel('Голос ступеней', { exact: true }).check();
    await page.getByRole('combobox', { name: 'Язык голоса', exact: true }).selectOption(language);
    await page.getByRole('button', { name: 'Готово', exact: true }).click();
    await page.getByRole('button', { name: /^(Start|Продолжить)$/ }).click();
    await expect(page.locator('.practice-session')).toHaveAttribute('data-phase', 'playing');
    await page.getByRole('button', { name: 'Завершить', exact: true }).click();
  }
});

test('all five configuration screens load and retain custom tempo', async ({
  page,
  browserName,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  for (const trainer of ['degree', 'chord', 'style', 'fill', 'scale']) {
    await page.goto(`#/practice/${trainer}`);
    await page.getByLabel('BPM', { exact: true }).fill('73');
    await page.getByLabel('BPM', { exact: true }).blur();
    await page.reload();
    await expect(page.getByLabel('BPM', { exact: true })).toHaveValue('73');
  }
  await prepare(page, 'degree');
  if (browserName === 'webkit' && process.platform === 'win32') {
    await page.getByRole('button', { name: 'Start', exact: true }).click();
    await expect(page.getByText(/Этот браузер не поддерживает Web Audio/)).toBeVisible();
  }
  expect(errors).toEqual([]);
});
