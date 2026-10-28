import { test, expect } from "@playwright/test";
test("placeholder loads without errors or business traffic", async ({
  page,
}) => {
  const errors: string[] = [];
  const traffic: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("request", (request) => {
    if (["xhr", "fetch", "websocket"].includes(request.resourceType()))
      traffic.push(request.url());
  });
  page.on("websocket", (socket) => traffic.push(socket.url()));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "KURIO", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Frontend challenge — project setup complete.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByText("Marketplace features have not been implemented yet.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(page).toHaveTitle("KURIO | Frontend Challenge");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
  expect(traffic).toEqual([]);
});
