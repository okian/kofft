import { vi, test, expect, beforeEach } from "vitest";
import { registerServiceWorker } from "../src/register-sw";

beforeEach(() => {
  Object.defineProperty(global.navigator, "serviceWorker", {
    value: { register: vi.fn() },
    configurable: true,
  });
});

test("registers service worker relative to base url", () => {
  const addEventListenerSpy = vi.spyOn(window, "addEventListener");
  registerServiceWorker();
  const [[, loadHandler]] = addEventListenerSpy.mock.calls;
  loadHandler();
  expect(navigator.serviceWorker.register).toHaveBeenCalledWith(
    `${import.meta.env.BASE_URL}sw.js`,
  );
});
