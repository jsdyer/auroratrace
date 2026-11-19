"""Exercise the built starter at a project subpath in Chromium."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import shutil
import tempfile
import threading
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def main():
    screenshots = ROOT / "browser-checks"
    screenshots.mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory() as temporary:
        shutil.copytree(ROOT / "dist", Path(temporary) / "example-tool")
        server = ThreadingHTTPServer(("127.0.0.1", 0), partial(QuietHandler, directory=temporary))
        threading.Thread(target=server.serve_forever, daemon=True).start()
        try:
            with sync_playwright() as p:
                browser = p.chromium.launch()
                page = browser.new_page(viewport={"width": 1280, "height": 1000})
                errors = []
                page.on("pageerror", lambda error: errors.append(str(error)))
                page.goto(f"http://127.0.0.1:{server.server_port}/example-tool/")
                page.wait_for_selector("#cursor:enabled")
                page.locator("#peak").click()
                assert page.locator("#selected").inner_text() == "10 May 21:00 UTC"
                assert page.locator("#kp-value").inner_text() == "9"
                assert page.locator("#bars button[aria-pressed=true]").count() == 1
                page.locator("#shock").click()
                assert page.locator("#selected").inner_text() == "10 May 16:35 UTC"
                page.locator("#cursor").press("ArrowRight")
                assert page.locator("#selected").inner_text() == "10 May 16:40 UTC"
                page.locator("#cursor").press("Home")
                assert page.locator("#kp-value").inner_text() == "—"
                page.locator("#bars button").nth(2).click()
                assert page.locator("#selected").inner_text() == "10 May 21:00 UTC"
                assert page.locator("#event-list li").count() == 7
                assert page.locator("#chart path.line").count() == 2
                page.screenshot(path=str(screenshots / "desktop.png"), full_page=True)
                page.set_viewport_size({"width": 390, "height": 844})
                assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth")
                page.screenshot(path=str(screenshots / "mobile.png"), full_page=True)
                page.locator("#night").select_option("2024-10-10")
                page.wait_for_url("**/?night=2024-10-10")
                page.wait_for_selector("#cursor:enabled")
                assert "Oct" in page.locator("#selected").inner_text()
                assert page.locator("#case-link").get_attribute("href").endswith("?night=2024-10-10")
                assert page.locator("#data-download").get_attribute("href").endswith("october.json")
                assert page.locator("#event-list li").count() == 4
                assert page.locator("#bars button").count() == 8
                assert "magnetopause" in page.locator("#event-list").inner_text()
                page.locator("#shock").click()
                assert page.locator("#selected").inner_text() == "10 Oct 14:45 UTC"
                page.locator("#evening").select_option(label="Victoria · 10 Oct at 21:00")
                assert page.locator("#selected").inner_text() == "11 Oct 04:00 UTC"
                assert "Victoria 10 Oct 21:00" in page.locator("#local-times").inner_text()
                assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth")
                page.screenshot(path=str(screenshots / "october-mobile.png"), full_page=True)
                page.reload()
                page.wait_for_selector("#cursor:enabled")
                assert page.locator("#night").input_value() == "2024-10-10"
                page.locator("#night").select_option("2024-05-10")
                page.wait_for_url("**/?night=2024-05-10")
                page.wait_for_selector("#cursor:enabled")
                assert page.locator("#event-list li").count() == 7
                assert not errors, errors
                browser.close()
            print("Browser checks passed: project subpath, matching UTC signals, interval boundaries, event links and mobile layout")
        finally:
            server.shutdown()


if __name__ == "__main__":
    main()
