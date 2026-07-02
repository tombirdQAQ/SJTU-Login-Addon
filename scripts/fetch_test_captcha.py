"""Fetch one anonymous jAccount captcha for local parity testing."""

from pathlib import Path
import re

import requests


def main() -> None:
    session = requests.Session()
    page = session.get(
        "https://i.sjtu.edu.cn/jaccountlogin",
        allow_redirects=True,
        timeout=20,
    )
    page.raise_for_status()
    match = re.search(r'uuid\s*:\s*"([^"]+)', page.text)
    if not match:
        raise RuntimeError("jAccount page did not contain a captcha UUID")

    captcha = session.get(
        "https://jaccount.sjtu.edu.cn/jaccount/captcha",
        params={"uuid": match.group(1)},
        headers={"Referer": page.url},
        timeout=20,
    )
    captcha.raise_for_status()
    output = Path(__file__).resolve().parents[1] / "tests" / "fixtures"
    output.mkdir(parents=True, exist_ok=True)
    path = output / "jaccount-captcha.png"
    path.write_bytes(captcha.content)
    print(path)


if __name__ == "__main__":
    main()
